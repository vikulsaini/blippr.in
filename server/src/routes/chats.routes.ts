import { Router } from 'express';
import { query } from '../config/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { Server } from 'socket.io';

const router = Router();

// Helper: verify user is a member of a room
async function isRoomMember(roomId: string, userId: string): Promise<boolean> {
  try {
    console.log(`[Chats] isRoomMember check: roomId=${roomId}, userId=${userId}`);
    
    const result = await query(
      'SELECT room_id, user_id FROM room_members WHERE room_id = $1 AND user_id = $2 LIMIT 1',
      [roomId, userId]
    );
    
    if (result.rows.length > 0) {
      console.log(`[Chats] isRoomMember: user ${userId} IS a member of room ${roomId}`);
      return true;
    }
    
    // Check if room exists and has no members (legacy room)
    const allMembersRes = await query('SELECT user_id FROM room_members WHERE room_id = $1', [roomId]);
    const allMembers = allMembersRes.rows;
    
    if (allMembers.length === 0) {
      // Legacy room with no members — auto-enroll this user
      console.log(`[Chats] Auto-enrolling user ${userId} into legacy room ${roomId}`);
      await query('INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)', [roomId, userId]);
      return true;
    }

    console.warn(`[Chats] isRoomMember: user ${userId} NOT found in room ${roomId}`);
    console.log(`[Chats] isRoomMember: room ${roomId} has ${allMembers.length} members:`, allMembers.map(m => m.user_id));
    return false;
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
    const membershipsRes = await query('SELECT room_id FROM room_members WHERE user_id = $1', [userId]);
    const memberships = membershipsRes.rows;

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

    const roomsRes = await query(
      'SELECT id, updated_at FROM rooms WHERE id = ANY($1)',
      [roomIds]
    );
    const rooms = roomsRes.rows;

    const membersRes = await query(
      'SELECT room_id, user_id FROM room_members WHERE room_id = ANY($1)',
      [roomIds]
    );
    const members = membersRes.rows;

    const membersMap: Record<string, Array<{ _id: string }>> = {};
    for (const member of members) {
      if (!membersMap[member.room_id]) {
        membersMap[member.room_id] = [];
      }
      membersMap[member.room_id].push({ _id: member.user_id });
    }

    const chats = rooms.map((room) => ({
      _id: room.id,
      type: 'direct',
      temporary: false,
      updatedAt: room.updated_at,
      unreadCount: 0,
      lastMessage: null,
      members: membersMap[room.id] || [],
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
    const msgRes = await query(
      'SELECT * FROM messages WHERE room_id = $1 ORDER BY created_at ASC',
      [chatId]
    );
    const messages = msgRes.rows;

    const formattedMessages = messages.map((msg) => ({
      _id: msg.id,
      chat: msg.room_id,
      sender: msg.sender_id,
      text: msg.content,
      reactions: [],
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

    // Persist to messages table
    await query(
      'INSERT INTO messages (id, room_id, sender_id, content, created_at) VALUES ($1, $2, $3, $4, $5)',
      [msgId, chatId, userId, sanitizedText, timestamp]
    );

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

// 6. Update nicknames in a room (Authenticated)
router.patch('/:chatId/nicknames', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { chatId } = req.params;
  res.status(200).json({
    success: true,
    chat: {
      _id: chatId,
      type: 'direct',
      temporary: false,
      unreadCount: 0,
      lastMessage: null,
      members: [],
    }
  });
});

// 7. Toggle room config settings like pin, mute, archive (Authenticated)
router.post('/:chatId/:configPath(pin|unpin|mute|unmute|archive|unarchive)', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { chatId } = req.params;
  res.status(200).json({
    success: true,
    chat: {
      _id: chatId,
      type: 'direct',
      temporary: false,
      unreadCount: 0,
      lastMessage: null,
      members: [],
    }
  });
});

// 8. Delete a chat room (Authenticated)
router.delete('/:chatId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { chatId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    // Clean up room from database
    await query('DELETE FROM rooms WHERE id = $1', [chatId]);
    res.status(200).json({ success: true, message: 'Chat room deleted successfully' });
  } catch (err) {
    console.error('[Chats API] Error deleting room:', err);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

export default router;
