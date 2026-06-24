import { Router } from 'express';
import { FriendRequest, Profile, Room, RoomMember, Block } from '../config/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { findMutualFriendRequest, deleteMutualFriendRequests, cleanupSharedRooms } from '../utils/helpers.js';

const router = Router();

interface FormattedProfile {
  _id: string;
  username?: string;
  name?: string;
  avatar_url: string;
}

interface FormattedRequest {
  _id: string;
  from: FormattedProfile;
  to: FormattedProfile;
  status: string;
  createdAt: string;
}

function formatProfile(p: { _id: string; username?: string; name?: string; avatar_url?: string }): FormattedProfile {
  return {
    _id: p._id,
    username: p.username,
    name: p.name,
    avatar_url: p.avatar_url || '',
  };
}

function formatDate(date: unknown): string {
  if (!date) return new Date().toISOString();
  if (typeof date === 'string') return date;
  if (date instanceof Date) return date.toISOString();
  return new Date().toISOString();
}

async function fetchProfilesMap(userIds: string[]): Promise<Map<string, FormattedProfile>> {
  const profiles = await Profile.find({ _id: { $in: userIds } }).lean();
  const map = new Map<string, FormattedProfile>();
  for (const p of profiles) {
    map.set(p._id, formatProfile(p));
  }
  return map;
}

async function formatFriendRequests(
  requests: Array<{ _id: unknown; sender_id: string; receiver_id: string; status: string; created_at?: unknown }>
): Promise<FormattedRequest[]> {
  const allIds = [...new Set(requests.flatMap(r => [r.sender_id, r.receiver_id]))];
  const profileMap = await fetchProfilesMap(allIds);

  return requests.map((r) => ({
    _id: String(r._id),
    from: profileMap.get(r.sender_id) || { _id: r.sender_id, avatar_url: '' },
    to: profileMap.get(r.receiver_id) || { _id: r.receiver_id, avatar_url: '' },
    status: r.status,
    createdAt: formatDate(r.created_at),
  }));
}

// Helper: check if user is blocked by or has blocked the target
async function isBlocked(userId: string, targetId: string): Promise<boolean> {
  const block = await Block.findOne({
    $or: [
      { blocker_id: userId, blocked_id: targetId },
      { blocker_id: targetId, blocked_id: userId },
    ],
  }).lean();
  return !!block;
}

// 1. Get pending incoming friend requests
router.get('/requests', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const requests = await FriendRequest.find({ receiver_id: userId, status: 'pending' }).lean();
    if (!requests || requests.length === 0) { res.status(200).json({ requests: [] }); return; }

    const formatted = await formatFriendRequests(requests);

    res.status(200).json({ requests: formatted });
  } catch (err) {
    console.error('[Friends API] Error fetching incoming requests:', err);
    res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

// 2. Get pending sent friend requests
router.get('/requests/sent', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const requests = await FriendRequest.find({ sender_id: userId, status: 'pending' }).lean();
    if (!requests || requests.length === 0) { res.status(200).json({ requests: [] }); return; }

    const formatted = await formatFriendRequests(requests);

    res.status(200).json({ requests: formatted });
  } catch (err) {
    console.error('[Friends API] Error fetching sent requests:', err);
    res.status(500).json({ error: 'Failed to fetch sent requests' });
  }
});

// 3. Send a friend request
router.post('/requests', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const senderId = req.user?.id;
  const { userId: targetId } = req.body;

  if (!senderId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!targetId || typeof targetId !== 'string') { res.status(400).json({ error: 'Target userId is required.' }); return; }
  if (senderId === targetId) { res.status(400).json({ error: 'You cannot send a friend request to yourself.' }); return; }

  try {
    // Check if either user has blocked the other
    const blocked = await isBlocked(senderId, targetId);
    if (blocked) {
      res.status(403).json({ error: 'Unable to send friend request due to privacy settings.' });
      return;
    }

    // Check for existing mutual request
    const existing = await findMutualFriendRequest(senderId, targetId);
    if (existing) {
      if (existing.status === 'accepted') {
        res.status(400).json({ error: 'You are already friends.' });
        return;
      }
      if (existing.status === 'pending') {
        res.status(400).json({ error: 'A friend request is already pending.' });
        return;
      }
      // For 'rejected' status, delete the old one before creating a new one
      await FriendRequest.findByIdAndDelete(existing._id);
    }

    // Create the friend request
    const newRequest = await FriendRequest.create({ sender_id: senderId, receiver_id: targetId, status: 'pending' });

    // Fetch sender and receiver profiles for the response
    const profiles = await fetchProfilesMap([senderId, targetId]);

    const formatted = {
      _id: String(newRequest._id),
      from: profiles.get(senderId) || { _id: senderId, avatar_url: '' },
      to: profiles.get(targetId) || { _id: targetId, avatar_url: '' },
      status: 'pending',
      createdAt: formatDate(newRequest.created_at),
    };

    res.status(201).json({ success: true, request: formatted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Friends API] Error sending friend request:', message);

    // Handle duplicate key error (race condition)
    if (err && typeof err === 'object' && 'code' in err && (err as any).code === 11000) {
      res.status(409).json({ error: 'A friend request already exists between you and this user.' });
      return;
    }

    res.status(500).json({ error: 'Failed to send friend request.' });
  }
});

// 4. Cancel a sent friend request
router.delete('/requests/sent/:userId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const senderId = req.user?.id;
  const { userId: targetId } = req.params;

  if (!senderId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const result = await FriendRequest.deleteMany({ sender_id: senderId, receiver_id: targetId, status: 'pending' });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'No pending friend request found to cancel.' });
      return;
    }

    res.status(200).json({ success: true, message: 'Friend request cancelled' });
  } catch (err) {
    console.error('[Friends API] Error cancelling friend request:', err);
    res.status(500).json({ error: 'Failed to cancel friend request' });
  }
});

// 5. Accept or reject a friend request
router.patch('/requests/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const receiverId = req.user?.id;
  const { id } = req.params;
  const { status } = req.body;

  if (!receiverId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (status !== 'accepted' && status !== 'rejected') {
    res.status(400).json({ error: 'Status must be either "accepted" or "rejected".' });
    return;
  }

  try {
    const request = await FriendRequest.findOne({ _id: id, receiver_id: receiverId, status: 'pending' });
    if (!request) {
      res.status(404).json({ error: 'Friend request not found or already processed.' });
      return;
    }

    // Check if blocked
    const blocked = await isBlocked(receiverId, request.sender_id);
    if (blocked) {
      res.status(403).json({ error: 'Unable to process friend request due to privacy settings.' });
      return;
    }

    await FriendRequest.findByIdAndUpdate(id, { status });

    if (status === 'accepted') {
      // Create a shared room
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      await Room.create({ _id: roomId });
      await RoomMember.create([
        { room_id: roomId, user_id: request.sender_id },
        { room_id: roomId, user_id: receiverId },
      ]);
    }

    // Return formatted response with profile data
    const profiles = await fetchProfilesMap([request.sender_id, receiverId]);
    const formatted = {
      _id: String(request._id),
      from: profiles.get(request.sender_id) || { _id: request.sender_id, avatar_url: '' },
      to: profiles.get(receiverId) || { _id: receiverId, avatar_url: '' },
      status,
      createdAt: formatDate(request.created_at),
    };

    res.status(200).json({ success: true, request: formatted });
  } catch (err) {
    console.error('[Friends API] Error updating friend request:', err);
    res.status(500).json({ error: 'Failed to update friend request.' });
  }
});

// 6. Unfriend a user
router.delete('/:userId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const { userId: targetId } = req.params;

  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    await deleteMutualFriendRequests(userId, targetId);
    await cleanupSharedRooms(userId, targetId);
    res.status(200).json({ success: true, message: 'Unfriended successfully' });
  } catch (err) {
    console.error('[Friends API] Error unfriending user:', err);
    res.status(500).json({ error: 'Failed to unfriend user.' });
  }
});

export default router;
