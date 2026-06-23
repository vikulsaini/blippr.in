import { Router } from 'express';
import { query } from '../config/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

async function findMutualFriendRequest(userId1: string, userId2: string) {
  const res = await query(
    'SELECT * FROM friend_requests WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) LIMIT 1',
    [userId1, userId2]
  );
  return res.rows[0] || null;
}

async function deleteMutualFriendRequests(userId1: string, userId2: string) {
  await query(
    'DELETE FROM friend_requests WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)',
    [userId1, userId2]
  );
}

async function findSharedRoomIds(userId1: string, userId2: string) {
  const res = await query(
    `SELECT rm1.room_id 
     FROM room_members rm1 
     JOIN room_members rm2 ON rm1.room_id = rm2.room_id 
     WHERE rm1.user_id = $1 AND rm2.user_id = $2`,
    [userId1, userId2]
  );
  return res.rows.map((row: any) => row.room_id);
}

router.get('/requests', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const requestsRes = await query('SELECT * FROM friend_requests WHERE receiver_id = $1 AND status = $2', [userId, 'pending']);
    const requests = requestsRes.rows;
    if (!requests || requests.length === 0) { res.status(200).json({ requests: [] }); return; }
    
    const senderIds = requests.map((r) => r.sender_id);
    const profilesRes = await query(
      'SELECT id, username, name, avatar_url FROM profiles WHERE id = ANY($1)',
      [senderIds]
    );
    const profiles = profilesRes.rows;

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
    const formatted = requests.map((r) => {
      const p = profileMap.get(r.sender_id);
      return { 
        _id: r.id, 
        from: p ? { _id: p.id, username: p.username, name: p.name, avatar_url: p.avatar_url } : { _id: r.sender_id }, 
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
    const requestsRes = await query('SELECT * FROM friend_requests WHERE sender_id = $1 AND status = $2', [userId, 'pending']);
    const requests = requestsRes.rows;
    if (!requests || requests.length === 0) { res.status(200).json({ requests: [] }); return; }
    
    const receiverIds = requests.map((r) => r.receiver_id);
    const profilesRes = await query(
      'SELECT id, username, name, avatar_url FROM profiles WHERE id = ANY($1)',
      [receiverIds]
    );
    const profiles = profilesRes.rows;

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
    const formatted = requests.map((r) => {
      const p = profileMap.get(r.receiver_id);
      return { 
        _id: r.id, 
        to: p ? { _id: p.id, username: p.username, name: p.name, avatar_url: p.avatar_url } : { _id: r.receiver_id }, 
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
      await query('DELETE FROM friend_requests WHERE id = $1', [existing.id]);
    }
    const insertRes = await query(
      'INSERT INTO friend_requests (sender_id, receiver_id, status, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [senderId, userId, 'pending']
    );
    const newRequest = insertRes.rows[0];
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
    await query('DELETE FROM friend_requests WHERE sender_id = $1 AND receiver_id = $2 AND status = $3', [senderId, userId, 'pending']);
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
    const reqRes = await query('SELECT * FROM friend_requests WHERE id = $1 AND receiver_id = $2 LIMIT 1', [id, receiverId]);
    const request = reqRes.rows[0];
    if (!request) { res.status(404).json({ error: 'Friend request not found.' }); return; }
    
    await query('UPDATE friend_requests SET status = $1 WHERE id = $2', [status, id]);
    
    if (status === 'accepted') {
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      const roomRes = await query('INSERT INTO rooms (id, updated_at) VALUES ($1, NOW()) RETURNING *', [roomId]);
      const room = roomRes.rows[0];
      if (room) {
        await query(
          'INSERT INTO room_members (room_id, user_id) VALUES ($1, $2), ($3, $4)',
          [room.id, request.sender_id, room.id, receiverId]
        );
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
      await query('DELETE FROM rooms WHERE id = ANY($1)', [sharedRoomIds]);
    }
    res.status(200).json({ success: true, message: 'Unfriended successfully' });
  } catch (err) {
    console.error('[Friends API] Error:', err);
    res.status(500).json({ error: 'Failed to unfriend user.' });
  }
});

export default router;
