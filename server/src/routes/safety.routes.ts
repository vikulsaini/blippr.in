import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Helper: find shared room IDs between two users
async function findSharedRoomIds(userId1: string, userId2: string): Promise<string[]> {
  const { data: userRooms } = await supabase
    .from('room_members')
    .select('room_id')
    .eq('user_id', userId1);

  const { data: targetRooms } = await supabase
    .from('room_members')
    .select('room_id')
    .eq('user_id', userId2);

  if (!userRooms || !targetRooms) return [];

  const userRoomIds = new Set(userRooms.map((rm) => rm.room_id));
  return targetRooms
    .map((rm) => rm.room_id)
    .filter((id) => userRoomIds.has(id));
}

// Helper: delete mutual friend requests (safe separate queries)
async function deleteMutualFriendRequests(userId1: string, userId2: string) {
  await supabase
    .from('friend_requests')
    .delete()
    .eq('sender_id', userId1)
    .eq('receiver_id', userId2);

  await supabase
    .from('friend_requests')
    .delete()
    .eq('sender_id', userId2)
    .eq('receiver_id', userId1);
}

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

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        console.warn('[Safety API] blocks table does not exist. Returning empty blocked list.');
        res.status(200).json({ users: [] });
        return;
      }
      throw error;
    }

    if (!blockedRecords || blockedRecords.length === 0) {
      res.status(200).json({ users: [] });
      return;
    }

    const blockedIds = blockedRecords.map((b) => b.blocked_id);

    let { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, username, avatar_url')
      .in('id', blockedIds);

    if (profilesError) {
      if (profilesError.code === '42703') {
        console.warn('[Safety API] avatar_url column does not exist. Running fallback.');
        const fallback = await supabase
          .from('profiles')
          .select('id, name, username')
          .in('id', blockedIds);
        if (fallback.error) throw fallback.error;
        profiles = (fallback.data || []).map((p) => ({ ...p, avatar_url: '' }));
      } else if (profilesError.code !== 'PGRST205' && profilesError.code !== '42P01') {
        throw profilesError;
      }
    }

    const formattedUsers = (profiles || []).map((p) => ({
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
    const { error: blockError } = await supabase
      .from('blocks')
      .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' });

    if (blockError) {
      throw blockError;
    }

    // Automatically clean up friend request relation if exists (safe separate queries)
    await deleteMutualFriendRequests(blockerId, blockedId);

    // Clean up direct rooms shared by both users
    const sharedRoomIds = await findSharedRoomIds(blockerId, blockedId);

    if (sharedRoomIds.length > 0) {
      await supabase
        .from('rooms')
        .delete()
        .in('id', sharedRoomIds);
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

    if (error) {
      throw error;
    }

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
    const { error } = await supabase
      .from('reports')
      .insert({
        reporter_id: reporterId,
        reported_id: reportedId,
        reason: reason || 'unspecified',
        notes: notes || '',
        created_at: new Date().toISOString(),
      });

    if (error) {
      throw error;
    }

    res.status(201).json({ success: true, message: 'Report submitted successfully' });
  } catch (err) {
    console.error('[Safety API] Error reporting user:', err);
    res.status(500).json({ error: 'Failed to submit report.' });
  }
});

export default router;
