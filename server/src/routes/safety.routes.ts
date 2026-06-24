import { Router } from 'express';
import { Block, Profile, Report } from '../config/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { deleteMutualFriendRequests, cleanupSharedRooms } from '../utils/helpers.js';

const router = Router();

// 1. Get blocked users (Authenticated)
router.get('/blocked', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const blockedRecords = await Block.find({ blocker_id: userId }).lean();

    if (!blockedRecords || blockedRecords.length === 0) {
      res.status(200).json({ users: [] });
      return;
    }

    const blockedIds = blockedRecords.map((b) => b.blocked_id);

    const profiles = await Profile.find({ _id: { $in: blockedIds } }).lean();

    const formattedUsers = profiles.map((p) => ({
      _id: p._id,
      name: p.name,
      username: p.username,
      avatar_url: p.avatar_url || '',
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
    await Block.findOneAndUpdate(
      { blocker_id: blockerId, blocked_id: blockedId },
      {},
      { upsert: true, new: true }
    );

    // Automatically clean up friend request relation if exists
    await deleteMutualFriendRequests(blockerId, blockedId);

    // Clean up direct rooms shared by both users
    await cleanupSharedRooms(blockerId, blockedId);

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
    await Block.deleteMany({ blocker_id: blockerId, blocked_id: blockedId });
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
    await Report.create({
      reporter_id: reporterId,
      reported_id: reportedId,
      reason: reason || 'unspecified',
      notes: notes || '',
    });

    res.status(201).json({ success: true, message: 'Report submitted successfully' });
  } catch (err) {
    console.error('[Safety API] Error reporting user:', err);
    res.status(500).json({ error: 'Failed to submit report.' });
  }
});

export default router;
