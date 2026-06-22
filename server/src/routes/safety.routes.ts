import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// 1. Get blocked users (Authenticated)
router.get('/blocked', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { data: blockedRecords, error } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', userId);

    if (error) throw error;

    if (!blockedRecords || blockedRecords.length === 0) {
      res.status(200).json({ users: [] });
      return;
    }

    const blockedIds = blockedRecords.map((b) => b.blocked_id);

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, username, avatar_url')
      .in('id', blockedIds);

    if (profilesError) throw profilesError;

    const formattedUsers = (profiles || []).map((p) => ({
      _id: p.id,
      name: p.name,
      username: p.username,
      avatar_url: p.avatar_url,
    }));

    res.status(200).json({ users: formattedUsers });
  } catch (err) {
    console.error('[Safety API] Error getting blocked users:', err);
    res.status(200).json({ users: [] });
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
    const { error: blockError } = await supabase
      .from('blocks')
      .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' });

    if (blockError) throw blockError;

    // Automatically clean up friend request relation if exists
    await supabase
      .from('friend_requests')
      .delete()
      .or(`and(sender_id.eq.${blockerId},receiver_id.eq.${blockedId}),and(sender_id.eq.${blockedId},receiver_id.eq.${blockerId})`);

    // Clean up direct rooms shared by both users
    const { data: userRooms } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', blockerId);

    const { data: targetRooms } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', blockedId);

    if (userRooms && targetRooms) {
      const userRoomIds = new Set(userRooms.map((rm) => rm.room_id));
      const sharedRoomIds = targetRooms.map((rm) => rm.room_id).filter((id) => userRoomIds.has(id));

      if (sharedRoomIds.length > 0) {
        await supabase
          .from('rooms')
          .delete()
          .in('id', sharedRoomIds);
      }
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
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);

    if (error) throw error;

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

  try {
    const { error } = await supabase
      .from('reports')
      .insert({
        reporter_id: reporterId,
        reported_id: reportedId,
        reason: reason || 'unspecified',
        notes: notes || '',
        created_at: new Date().toISOString(),
      });

    if (error) throw error;

    res.status(200).json({ success: true, message: 'Report submitted successfully' });
  } catch (err) {
    console.error('[Safety API] Error reporting user:', err);
    res.status(500).json({ error: 'Failed to submit report.' });
  }
});

export default router;
