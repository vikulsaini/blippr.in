import { Router } from 'express';
import { Room, RoomMember, Message, Profile } from '../config/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { Server } from 'socket.io';

const router = Router();

// Helper: verify user is a member of a room
async function isRoomMember(roomId: string, userId: string): Promise<boolean> {
  try {
    const member = await RoomMember.findOne({ room_id: roomId, user_id: userId });
    if (member) return true;

    // Check if room exists and has no members (legacy room)
    const allMembers = await RoomMember.find({ room_id: roomId });
    if (allMembers.length === 0) {
      await RoomMember.create({ room_id: roomId, user_id: userId });
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// Helper: fetch profile data for a list of user IDs
async function getMemberProfiles(userIds: string[]): Promise<Map<string, { _id: string; name?: string; username?: string; avatar_url: string }>> {
  const profiles = await Profile.find({ _id: { $in: userIds } }).lean();
  const map = new Map<string, { _id: string; name?: string; username?: string; avatar_url: string }>();
  for (const p of profiles) {
    map.set(p._id, {
      _id: p._id,
      name: p.name,
      username: p.username,
      avatar_url: p.avatar_url || '',
    });
  }
  return map;
}

// Helper: broadcast a message to a room excluding the sender's sockets
function broadcastMessage(io: Server, chatId: string, message: unknown, senderUserId: string): void {
  // Get all sockets in the room
  const room = io.sockets.adapter.rooms.get(chatId);
  if (!room) return;

  // Emit to all sockets in the room except those belonging to the sender
  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.data.userId !== senderUserId) {
      socket.emit('message:new', { message });
    }
  }
}

// 1. Get all active chats/rooms for the authenticated user
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const memberships = await RoomMember.find({ user_id: userId }).lean();

    if (!memberships || memberships.length === 0) {
      res.status(200).json({ chats: [], pageInfo: { hasMore: false, nextCursor: null } });
      return;
    }

    const roomIds = memberships.map((m) => m.room_id);
    const [rooms, members] = await Promise.all([
      Room.find({ _id: { $in: roomIds } }).lean(),
      RoomMember.find({ room_id: { $in: roomIds } }).lean(),
    ]);

    // Build map of room members and collect all member user IDs for profile lookup
    const membersMap: Record<string, string[]> = {};
    const allMemberIds = new Set<string>();

    for (const member of members) {
      if (!membersMap[member.room_id]) {
        membersMap[member.room_id] = [];
      }
      membersMap[member.room_id].push(member.user_id);
      allMemberIds.add(member.user_id);
    }

    // Fetch profile data for all members in one query
    const profileMap = await getMemberProfiles([...allMemberIds]);

    const chats = rooms.map((room) => ({
      _id: room._id,
      type: 'direct' as const,
      temporary: false,
      updatedAt: room.updated_at,
      unreadCount: 0,
      lastMessage: null,
      members: (membersMap[room._id] || []).map((uid) => {
        const profile = profileMap.get(uid);
        return profile || { _id: uid, name: uid, username: uid, avatar_url: '' };
      }),
    }));

    res.status(200).json({ chats, pageInfo: { hasMore: false, nextCursor: null } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Chats API] Error fetching rooms:', message);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// 2. Get messages history for a specific room
router.get('/:chatId/messages', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { chatId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const isMember = await isRoomMember(chatId, userId);
  if (!isMember) {
    res.status(403).json({ error: 'Access denied: you are not a member of this room' });
    return;
  }

  try {
    const messages = await Message.find({ room_id: chatId }).sort({ created_at: 1 }).lean();

    // Collect unique sender IDs to fetch their profiles
    const senderIds = [...new Set(messages.map((msg) => msg.sender_id))];
    const profileMap = await getMemberProfiles(senderIds);

    const formattedMessages = messages.map((msg) => ({
      _id: msg._id,
      chat: msg.room_id,
      sender: msg.sender_id,
      senderProfile: profileMap.get(msg.sender_id) || null,
      text: msg.content,
      reactions: [] as string[],
      status: 'seen' as const,
      createdAt: msg.created_at,
    }));

    res.status(200).json({ messages: formattedMessages });
  } catch (err) {
    console.error('[Chats API] Error fetching message history:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// 3. Post a new message in a room
router.post('/:chatId/messages', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { chatId } = req.params;
  const { text } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const sanitizedText = typeof text === 'string' ? text.trim().substring(0, 10000) : '';
  if (!sanitizedText) {
    res.status(400).json({ error: 'Message text is required' });
    return;
  }

  const isMember = await isRoomMember(chatId, userId);
  if (!isMember) {
    res.status(403).json({ error: 'Access denied: you are not a member of this room' });
    return;
  }

  try {
    const timestamp = new Date().toISOString();
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    await Message.create({
      _id: msgId,
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
      reactions: [] as string[],
      status: 'sent' as const,
      createdAt: timestamp,
    };

    // Relay the message via WebSockets — exclude the sender to avoid duplicates
    const io: Server = req.app.get('io');
    if (io) {
      broadcastMessage(io, chatId, message, userId);
    }

    res.status(201).json({ message });
  } catch (err) {
    console.error('[Chats API] Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// 4. Mark messages as read in a room
router.patch('/:chatId/read', authMiddleware, (_req: AuthenticatedRequest, res) => {
  res.status(200).json({ success: true });
});

// 5. Get calls history for a room (client depends on this)
router.get('/:chatId/calls', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { chatId } = req.params;
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const isMember = await isRoomMember(chatId, userId);
  if (!isMember) { res.status(403).json({ error: 'Access denied' }); return; }

  res.status(200).json({ calls: [] });
});

// 6. Update nicknames in a room (client depends on this)
router.patch('/:chatId/nicknames', authMiddleware, (req: AuthenticatedRequest, res) => {
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
    },
  });
});

// 7. Delete a chat room
router.delete('/:chatId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { chatId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    await Room.findByIdAndDelete(chatId);
    await RoomMember.deleteMany({ room_id: chatId });
    await Message.deleteMany({ room_id: chatId });

    res.status(200).json({ success: true, message: 'Chat room deleted successfully' });
  } catch (err) {
    console.error('[Chats API] Error deleting room:', err);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

export default router;
