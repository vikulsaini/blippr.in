import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { Server } from 'socket.io';

const router = Router();

// 1. Get all active chats/rooms (Authenticated)
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select(`
        id,
        updated_at,
        room_members (user_id)
      `);

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
    res.status(200).json([]);
  }
});

// 2. Get messages history for a specific room (Authenticated)
router.get('/:chatId/messages', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { chatId } = req.params;

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
    res.status(200).json({ messages: [] });
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

  try {
    const timestamp = new Date().toISOString();
    const msgId = `msg_${Math.random().toString(36).substring(2, 15)}`;

    // Persist to Supabase messages table in background
    try {
      await supabase
        .from('messages')
        .insert({
          id: msgId,
          room_id: chatId,
          sender_id: userId,
          content: text || '',
          created_at: timestamp,
        });
    } catch (dbErr) {
      console.error('[Chats API] Supabase write failed:', dbErr);
    }

    const message = {
      _id: msgId,
      chat: chatId,
      sender: userId,
      text: text || '',
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

    res.status(200).json({ message });
  } catch (err) {
    console.error('[Chats API] Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// 4. Mark messages as read in a room
router.patch('/:chatId/read', authMiddleware, (req, res) => {
  res.status(200).json({ success: true });
});

// 5. Retrieve calls history for room
router.get('/:chatId/calls', authMiddleware, (req, res) => {
  res.status(200).json({ calls: [] });
});

export default router;
