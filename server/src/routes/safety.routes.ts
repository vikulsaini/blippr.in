import { Router } from 'express';
import { query } from '../config/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Helper: find shared room IDs between two users
async function findSharedRoomIds(userId1: string, userId2: string): Promise<string[]> {
  const res = await query(
    `SELECT rm1.room_id 
     FROM room_members rm1 
     JOIN room_members rm2 ON rm1.room_id = rm2.room_id 
     WHERE rm1.user_id = $1 AND rm2.user_id = $2`,
    [userId1, userId2]
  );
  return res.rows.map((row: any) => row.room_id);
}

// Helper: delete mutual friend requests (safe separate queries)
async function deleteMutualFriendRequests(userId1: string, userId2: string) {
  await query(
    'DELETE FROM friend_requests WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)',
    [userId1, userId2]
  );
}

// 1. Get blocked users (Authenticated)
router.get('/blocked', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await query('SELECT blocked_id FROM blocks WHERE blocker_id = $1', [userId]);
    const blockedRecords = result.rows;

    if (!blockedRecords || blockedRecords.length === 0) {
      res.status(200).json({ users: [] });
      return;
    }

    const blockedIds = blockedRecords.map((b) => b.blocked_id);

    const profilesRes = await query(
      'SELECT id, name, username, avatar_url FROM profiles WHERE id = ANY($1)',
      [blockedIds]
    );
    const profiles = profilesRes.rows || [];

    const formattedUsers = profiles.map((p) => ({
      _id: p.id,
      name: p.name,
      username: p.username,
      avatar_url: p.avatar_url,
    }));

    res.status(200).json({ users: formattedUsers });
  } catch (err) {
    console.error('[Safety API] Error getting blocked users:', err);
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});

// 2. Block a user (Authenticated)
router.post('/block', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const blockerId = req.user?.id;
  const { userId: blockedId } = req.body;

  if (!blockerId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!blockedId) {
    res.status(400).json({ error: 'Target userId is required.' });
    return;
  }
  if (blockerId === blockedId) {
    res.status(400).json({ error: 'You cannot block yourself.' });
    return;
  }

  try {
    // Upsert block record
    await query(
      `INSERT INTO blocks (blocker_id, blocked_id, created_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [blockerId, blockedId]
    );

    // Automatically clean up friend request relation if exists (safe separate queries)
    await deleteMutualFriendRequests(blockerId, blockedId);

    // Clean up direct rooms shared by both users
    const sharedRoomIds = await findSharedRoomIds(blockerId, blockedId);

    if (sharedRoomIds.length > 0) {
      await query('DELETE FROM rooms WHERE id = ANY($1)', [sharedRoomIds]);
    }

    res.status(200).json({ success: true, message: 'User blocked successfully' });
  } catch (err) {
    console.error('[Safety API] Error blocking user:', err);
    res.status(500).json({ error: 'Failed to block user.' });
  }
});

// 3. Unblock a user (Authenticated)
router.post('/unblock', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const blockerId = req.user?.id;
  const { userId: blockedId } = req.body;

  if (!blockerId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!blockedId) {
    res.status(400).json({ error: 'Target userId is required.' });
    return;
  }

  try {
    await query('DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2', [blockerId, blockedId]);
    res.status(200).json({ success: true, message: 'User unblocked successfully' });
  } catch (err) {
    console.error('[Safety API] Error unblocking user:', err);
    res.status(500).json({ error: 'Failed to unblock user.' });
  }
});

// 4. Report a user (Authenticated)
router.post('/report', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const reporterId = req.user?.id;
  const { userId: reportedId, reason, notes } = req.body;

  if (!reporterId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!reportedId) {
    res.status(400).json({ error: 'Target userId is required for reporting.' });
    return;
  }

  // Validate inputs
  if (reason && typeof reason === 'string' && reason.length > 200) {
    res.status(400).json({ error: 'Reason must be under 200 characters' });
    return;
  }
  if (notes && typeof notes === 'string' && notes.length > 1000) {
    res.status(400).json({ error: 'Notes must be under 1000 characters' });
    return;
  }

  try {
    await query(
      'INSERT INTO reports (reporter_id, reported_id, reason, notes, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [reporterId, reportedId, reason || 'unspecified', notes || '']
    );

    res.status(201).json({ success: true, message: 'Report submitted successfully' });
  } catch (err) {
    console.error('[Safety API] Error reporting user:', err);
    res.status(500).json({ error: 'Failed to submit report.' });
  }
});

export default router;
