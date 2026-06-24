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

// Helper: map MIME type to allowed media_type enum value
function mimeToMediaType(mime?: string): string | undefined {
  if (!mime) return undefined;
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'document';
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

    const formattedMessages = messages.map((msg) => {
      const formatted: Record<string, unknown> = {
        _id: msg._id,
        chat: msg.room_id,
        sender: msg.sender_id,
        senderProfile: profileMap.get(msg.sender_id) || null,
        text: msg.content || null,
        reactions: [],
        status: 'seen',
        createdAt: msg.created_at,
      };

      // Include media fields if present
      if (msg.media_url) {
        formatted.mediaUrl = msg.media_url;
        formatted.mediaType = msg.media_type || 'image';
      }

      // Include location if present
      if (msg.location && typeof msg.location.latitude === 'number' && typeof msg.location.longitude === 'number') {
        formatted.location = {
          latitude: msg.location.latitude,
          longitude: msg.location.longitude,
        };
      }

      return formatted;
    });

    res.status(200).json({ messages: formattedMessages });
  } catch (err) {
    console.error('[Chats API] Error fetching message history:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// 3. Post a new message in a room (supports text, media, location)
// Accepts both flat format (mediaUrl, mediaType) and client's nested format ({ media: { url, mimeType } })
router.post('/:chatId/messages', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { chatId } = req.params;
  const { text, mediaUrl, mediaType, mediaName, mediaSize, location, media } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const sanitizedText = typeof text === 'string' ? text.trim().substring(0, 10000) : '';

  // Handle nested media object (client format: { media: { url, mimeType, ... } })
  const resolvedMediaUrl = mediaUrl || media?.url || undefined;
  const resolvedMediaType = mediaType || mimeToMediaType(media?.mimeType) || (media?.url ? 'image' : undefined);
  const resolvedMediaName = mediaName || media?.name || undefined;
  const resolvedMediaSize = mediaSize || media?.size || undefined;

  // Must have either text, media, or location
  if (!sanitizedText && !resolvedMediaUrl && !location) {
    res.status(400).json({ error: 'Message must contain text, media, or location.' });
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

    // Validate location data - handle both flat format and client format (coordinates array)
    let locationData = undefined;
    if (location) {
      if (typeof location.latitude === 'number' && typeof location.longitude === 'number') {
        // Flat format: { latitude, longitude }
        locationData = { latitude: location.latitude, longitude: location.longitude };
      } else if (Array.isArray(location.coordinates) && location.coordinates.length === 2) {
        // Client format: { coordinates: [longitude, latitude], type, accuracy }
        locationData = {
          latitude: location.coordinates[1],
          longitude: location.coordinates[0],
        };
      } else {
        res.status(400).json({ error: 'Location must have valid latitude and longitude.' });
        return;
      }
    }

    await Message.create({
      _id: msgId,
      room_id: chatId,
      sender_id: userId,
      content: sanitizedText || undefined,
      media_url: resolvedMediaUrl,
      media_type: resolvedMediaType,
      location: locationData,
      created_at: timestamp,
    });

    const message: Record<string, unknown> = {
      _id: msgId,
      chat: chatId,
      sender: userId,
      text: sanitizedText || null,
      reactions: [],
      status: 'sent',
      createdAt: timestamp,
    };

    if (resolvedMediaUrl) {
      message.mediaUrl = resolvedMediaUrl;
      message.mediaType = resolvedMediaType || 'image';
      if (resolvedMediaName) message.mediaName = resolvedMediaName;
      if (resolvedMediaSize) message.mediaSize = resolvedMediaSize;
    }

    if (locationData) {
      message.location = locationData;
    }

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
