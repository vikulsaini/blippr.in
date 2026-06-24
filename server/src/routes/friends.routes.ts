import { Router } from 'express';
import { FriendRequest, Profile, Room, RoomMember } from '../config/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { findMutualFriendRequest, deleteMutualFriendRequests, cleanupSharedRooms } from '../utils/helpers.js';

const router = Router();

router.get('/requests', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const requests = await FriendRequest.find({ receiver_id: userId, status: 'pending' }).lean();
    if (!requests || requests.length === 0) { res.status(200).json({ requests: [] }); return; }
    
    const senderIds = requests.map((r) => r.sender_id);
    const profiles = await Profile.find({ _id: { $in: senderIds } }).lean();

    const profileMap = new Map(profiles?.map((p) => [p._id, p]) || []);
    const formatted = requests.map((r) => {
      const p = profileMap.get(r.sender_id);
      return { 
        _id: r._id, 
        from: p ? { _id: p._id, username: p.username, name: p.name, avatar_url: p.avatar_url || '' } : { _id: r.sender_id }, 
        to: r.receiver_id, 
        status: r.status, 
        createdAt: r.created_at || new Date().toISOString() 
      };
    });
    res.status(200).json({ requests: formatted });
  } catch (err) {
    console.error('[Friends API] Error:', err);
    res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

router.get('/requests/sent', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const requests = await FriendRequest.find({ sender_id: userId, status: 'pending' }).lean();
    if (!requests || requests.length === 0) { res.status(200).json({ requests: [] }); return; }
    
    const receiverIds = requests.map((r) => r.receiver_id);
    const profiles = await Profile.find({ _id: { $in: receiverIds } }).lean();

    const profileMap = new Map(profiles?.map((p) => [p._id, p]) || []);
    const formatted = requests.map((r) => {
      const p = profileMap.get(r.receiver_id);
      return { 
        _id: r._id, 
        to: p ? { _id: p._id, username: p.username, name: p.name, avatar_url: p.avatar_url || '' } : { _id: r.receiver_id }, 
        from: r.sender_id, 
        status: r.status, 
        createdAt: r.created_at || new Date().toISOString() 
      };
    });
    res.status(200).json({ requests: formatted });
  } catch (err) {
    console.error('[Friends API] Error:', err);
    res.status(500).json({ error: 'Failed to fetch sent requests' });
  }
});

router.post('/requests', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const senderId = req.user?.id;
  const { userId } = req.body;
  if (!senderId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!userId || typeof userId !== 'string') { res.status(400).json({ error: 'Target userId is required.' }); return; }
  if (senderId === userId) { res.status(400).json({ error: 'You cannot send a friend request to yourself.' }); return; }
  try {
    const existing = await findMutualFriendRequest(senderId, userId);
    if (existing) {
      if (existing.status === 'accepted') { res.status(400).json({ error: 'You are already friends.' }); return; }
      if (existing.status === 'pending') { res.status(400).json({ error: 'A friend request is already pending.' }); return; }
      await FriendRequest.findByIdAndDelete(existing._id);
    }
    const newRequest = await FriendRequest.create({ sender_id: senderId, receiver_id: userId, status: 'pending' });
    res.status(201).json({ success: true, request: newRequest });
  } catch (err) {
    console.error('[Friends API] Error:', err);
    res.status(500).json({ error: 'Failed to send friend request.' });
  }
});

router.delete('/requests/sent/:userId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const senderId = req.user?.id;
  const { userId } = req.params;
  if (!senderId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    await FriendRequest.deleteMany({ sender_id: senderId, receiver_id: userId, status: 'pending' });
    res.status(200).json({ success: true, message: 'Friend request cancelled' });
  } catch (err) {
    console.error('[Friends API] Error:', err);
    res.status(500).json({ error: 'Failed to cancel friend request' });
  }
});

router.patch('/requests/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const receiverId = req.user?.id;
  const { id } = req.params;
  const { status } = req.body;
  if (!receiverId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (status !== 'accepted' && status !== 'rejected') { res.status(400).json({ error: 'Invalid status.' }); return; }
  try {
    const request = await FriendRequest.findOne({ _id: id, receiver_id: receiverId });
    if (!request) { res.status(404).json({ error: 'Friend request not found.' }); return; }
    
    await FriendRequest.findByIdAndUpdate(id, { status });
    
    if (status === 'accepted') {
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      const room = await Room.create({ _id: roomId });
      if (room) {
        await RoomMember.create([
          { room_id: roomId, user_id: request.sender_id },
          { room_id: roomId, user_id: receiverId }
        ]);
      }
    }
    res.status(200).json({ success: true, status });
  } catch (err) {
    console.error('[Friends API] Error:', err);
    res.status(500).json({ error: 'Failed to update friend request.' });
  }
});

router.delete('/:userId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const { userId: targetId } = req.params;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    await deleteMutualFriendRequests(userId, targetId);
    await cleanupSharedRooms(userId, targetId);
    res.status(200).json({ success: true, message: 'Unfriended successfully' });
  } catch (err) {
    console.error('[Friends API] Error:', err);
    res.status(500).json({ error: 'Failed to unfriend user.' });
  }
});

export default router;
