import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { Server } from 'socket.io';

const router = Router();

// Helper: verify user is a member of a room
async function isRoomMember(roomId: string, userId: string): Promise<boolean> {
  try {
    console.log(`[Chats] isRoomMember check: roomId=${roomId}, userId=${userId}`);
    
    const { data, error } = await supabase
      .from('room_members')
      .select('room_id, user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      console.error('[Chats] isRoomMember query error:', JSON.stringify(error, null, 2));
      return false;
    }
    
    if (!data) {
      // Check if room exists and has no members (legacy room)
      const { data: allMembers, error: allMembersError } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', roomId);
      
      if (!allMembersError && allMembers && allMembers.length === 0) {
        // Legacy room with no members — auto-enroll this user
        console.log(`[Chats] Auto-enrolling user ${userId} into legacy room ${roomId}`);
        await supabase
          .from('room_members')
          .insert({ room_id: roomId, user_id: userId });
        return true;
      }

      console.warn(`[Chats] isRoomMember: user ${userId} NOT found in room ${roomId}`);
      if (allMembersError) {
        console.error('[Chats] isRoomMember: error fetching all members:', JSON.stringify(allMembersError, null, 2));
      } else {
        console.log(`[Chats] isRoomMember: room ${roomId} has ${allMembers?.length || 0} members:`, allMembers?.map(m => m.user_id) || []);
      }
      return false;
    }
    
    console.log(`[Chats] isRoomMember: user ${userId} IS a member of room ${roomId}`);
    return true;
  } catch (err: any) {
    console.error('[Chats] isRoomMember exception:', err?.message || err);
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
      if (membershipError.code === 'PGRST205' || membershipError.code === '42P01') {
        console.warn('[Chats API] room_members table does not exist. Returning empty chats.');
        res.status(200).json({
          chats: [],
          pageInfo: {
            hasMore: false,
            nextCursor: null
          }
        });
        return;
      }
      console.error('[Chats API] Membership query error:', JSON.stringify(membershipError, null, 2));
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
      if (error.code === 'PGRST205' || error.code === '42P01') {
        console.warn('[Chats API] rooms table does not exist. Returning empty chats.');
        res.status(200).json({
          chats: [],
          pageInfo: {
            hasMore: false,
            nextCursor: null
          }
        });
        return;
      }
      console.error('[Chats API] Rooms query error:', JSON.stringify(error, null, 2));
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
  } catch (err: any) {
    console.error('[Chats API] Error fetching rooms:', err?.message || err);
    res.status(500).json({ error: 'Failed to fetch chats', details: err?.message });
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
      if (error.code === 'PGRST205' || error.code === '42P01') {
        console.warn('[Chats API] messages table does not exist. Returning empty messages list.');
        res.status(200).json({ messages: [] });
        return;
      }
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
