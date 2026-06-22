import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

async function findMutualFriendRequest(userId1: string, userId2: string) {
  const { data: direct } = await supabase.from('friend_requests').select('*').eq('sender_id', userId1).eq('receiver_id', userId2).maybeSingle();
  if (direct) return direct;
  const { data: reverse } = await supabase.from('friend_requests').select('*').eq('sender_id', userId2).eq('receiver_id', userId1).maybeSingle();
  return reverse || null;
}

async function deleteMutualFriendRequests(userId1: string, userId2: string) {
  await supabase.from('friend_requests').delete().eq('sender_id', userId1).eq('receiver_id', userId2);
  await supabase.from('friend_requests').delete().eq('sender_id', userId2).eq('receiver_id', userId1);
}

async function findSharedRoomIds(userId1: string, userId2: string) {
  const userRooms = (await supabase.from('room_members').select('room_id').eq('user_id', userId1)).data;
  const targetRooms = (await supabase.from('room_members').select('room_id').eq('user_id', userId2)).data;
  if (!userRooms || !targetRooms) return [];
  const userRoomIds = new Set(userRooms.map((rm) => rm.room_id));
  return targetRooms.map((rm) => rm.room_id).filter((id) => userRoomIds.has(id));
}

router.get('/requests', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const { data: requests, error: requestsError } = await supabase.from('friend_requests').select('*').eq('receiver_id', userId).eq('status', 'pending');
    if (requestsError) {
      if (requestsError.code === 'PGRST205' || requestsError.code === '42P01') {
        console.warn('[Friends API] friend_requests table does not exist. Returning empty requests.');
        res.status(200).json({ requests: [] });
        return;
      }
      throw requestsError;
    }
    if (!requests || requests.length === 0) { res.status(200).json({ requests: [] }); return; }
    const senderIds = requests.map((r) => r.sender_id);
    const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, username, name, avatar_url').in('id', senderIds);
    if (profilesError && profilesError.code !== 'PGRST205' && profilesError.code !== '42P01') {
      throw profilesError;
    }
    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
    const formatted = requests.map((r) => {
      const p = profileMap.get(r.sender_id);
      return { _id: r.id, from: p ? { _id: p.id, username: p.username, name: p.name, avatar_url: p.avatar_url } : { _id: r.sender_id }, to: r.receiver_id, status: r.status, createdAt: r.created_at || new Date().toISOString() };
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
    const { data: requests, error: requestsError } = await supabase.from('friend_requests').select('*').eq('sender_id', userId).eq('status', 'pending');
    if (requestsError) {
      if (requestsError.code === 'PGRST205' || requestsError.code === '42P01') {
        console.warn('[Friends API] friend_requests table does not exist. Returning empty sent requests.');
        res.status(200).json({ requests: [] });
        return;
      }
      throw requestsError;
    }
    if (!requests || requests.length === 0) { res.status(200).json({ requests: [] }); return; }
    const receiverIds = requests.map((r) => r.receiver_id);
    const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, username, name, avatar_url').in('id', receiverIds);
    if (profilesError && profilesError.code !== 'PGRST205' && profilesError.code !== '42P01') {
      throw profilesError;
    }
    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
    const formatted = requests.map((r) => {
      const p = profileMap.get(r.receiver_id);
      return { _id: r.id, to: p ? { _id: p.id, username: p.username, name: p.name, avatar_url: p.avatar_url } : { _id: r.receiver_id }, from: r.sender_id, status: r.status, createdAt: r.created_at || new Date().toISOString() };
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
      await supabase.from('friend_requests').delete().eq('id', existing.id);
    }
    const newRequest = (await supabase.from('friend_requests').insert({ sender_id: senderId, receiver_id: userId, status: 'pending', created_at: new Date().toISOString() }).select().single()).data;
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
    await supabase.from('friend_requests').delete().eq('sender_id', senderId).eq('receiver_id', userId).eq('status', 'pending');
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
    const request = (await supabase.from('friend_requests').select('*').eq('id', id).eq('receiver_id', receiverId).maybeSingle()).data;
    if (!request) { res.status(404).json({ error: 'Friend request not found.' }); return; }
    await supabase.from('friend_requests').update({ status }).eq('id', id);
    if (status === 'accepted') {
      const room = (await supabase.from('rooms').insert({ updated_at: new Date().toISOString() }).select().single()).data;
      if (room) {
        await supabase.from('room_members').insert([{ room_id: room.id, user_id: request.sender_id }, { room_id: room.id, user_id: receiverId }]);
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
    const sharedRoomIds = await findSharedRoomIds(userId, targetId);
    if (sharedRoomIds.length > 0) {
      await supabase.from('rooms').delete().in('id', sharedRoomIds);
    }
    res.status(200).json({ success: true, message: 'Unfriended successfully' });
  } catch (err) {
    console.error('[Friends API] Error:', err);
    res.status(500).json({ error: 'Failed to unfriend user.' });
  }
});

export default router;
