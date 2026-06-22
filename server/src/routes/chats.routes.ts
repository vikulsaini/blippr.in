import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { Server } from 'socket.io';

const router = Router();

// Helper: verify user is a member of a room
async function isRoomMember(roomId: string, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

// 1. Get all active chats/rooms for the authenticated user (Authenticated)
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    // First, get the rooms the user is a member of
    const { data: memberships, error: membershipError } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', userId);

    if (membershipError) {
      throw membershipError;
    }

    if (!memberships || memberships.length === 0) {
      res.status(200).json({
        chats: [],
        pageInfo: {
          hasMore: false,
          nextCursor: null
        }
      });
      return;
    }

    const roomIds = memberships.map((m) => m.room_id);

    const { data: rooms, error } = await supabase
      .from('rooms')
      .select(`
        id,
        updated_at,
        room_members (user_id)
      `)
      .in('id', roomIds);

    if (error) {
      throw error;
    }

    const chats = (rooms || []).map((room) => ({
      _id: room.id,
      type: 'direct',
      temporary: false,
      updatedAt: room.updated_at,
      unreadCount: 0,
      lastMessage: null,
      members: room.room_members?.map((m: any) => ({ _id: m.user_id })) || [],
    }));

    res.status(200).json({
      chats,
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });
  } catch (err) {
    console.error('[Chats API] Error fetching rooms:', err);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// 2. Get messages history for a specific room (Authenticated)
router.get('/:chatId/messages', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { chatId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Verify room membership
  const isMember = await isRoomMember(chatId, userId);
  if (!isMember) {
    res.status(403).json({ error: 'Access denied: you are not a member of this room' });
    return;
  }

  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const formattedMessages = (messages || []).map((msg) => ({
      _id: msg.id,
      chat: msg.room_id,
      sender: msg.sender_id,
      text: msg.content,
      reactions: msg.reactions || [],
      status: 'seen',
      createdAt: msg.created_at,
    }));

    res.status(200).json({ messages: formattedMessages });
  } catch (err) {
    console.error('[Chats API] Error fetching message history:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// 3. Post a new message in a room (Authenticated)
router.post('/:chatId/messages', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { chatId } = req.params;
  const { text, replyTo } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Sanitize input: prevent empty or excessively large messages
  const sanitizedText = typeof text === 'string' ? text.trim().substring(0, 10000) : '';
  if (!sanitizedText && !req.body.media && !req.body.location) {
    res.status(400).json({ error: 'Message content is required' });
    return;
  }

  // Verify room membership
  const isMember = await isRoomMember(chatId, userId);
  if (!isMember) {
    res.status(403).json({ error: 'Access denied: you are not a member of this room' });
    return;
  }

  try {
    const timestamp = new Date().toISOString();
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    // Persist to Supabase messages table
    await supabase
      .from('messages')
      .insert({
        id: msgId,
        room_id: chatId,
        sender_id: userId,
        content: sanitizedText,
        created_at: timestamp,
      });

    const message = {
      _id: msgId,
      chat: chatId,
      sender: userId,
      text: sanitizedText,
      reactions: [],
      status: 'sent',
      createdAt: timestamp,
      replyTo: replyTo ? { _id: replyTo } : null,
    };

    // Relay the message immediately via Sockets
    const io: Server = req.app.get('io');
    if (io) {
      io.to(chatId).emit('message:new', { message });
    }

    res.status(201).json({ message });
  } catch (err) {
    console.error('[Chats API] Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// 4. Mark messages as read in a room
router.patch('/:chatId/read', authMiddleware, async (req: AuthenticatedRequest, res) => {
  res.status(200).json({ success: true });
});

// 5. Retrieve calls history for room
router.get('/:chatId/calls', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { chatId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Verify room membership
  const isMember = await isRoomMember(chatId, userId);
  if (!isMember) {
    res.status(403).json({ error: 'Access denied: you are not a member of this room' });
    return;
  }

  res.status(200).json({ calls: [] });
});

export default router;
