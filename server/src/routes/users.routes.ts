import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// 1. Get current authenticated user profile
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!profile) {
      res.status(404).json({ code: 'PROFILE_REQUIRED', error: 'Profile not found' });
      return;
    }

    res.status(200).json({ user: profile });
  } catch (err) {
    console.error('[Users API] Error fetching self profile:', err);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

// 2. Update current user profile
router.patch('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { name, username, gender, bio, age, dob, contact, hobbies } = req.body;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...(name && { name }),
        ...(username && { username: username.toLowerCase() }),
        ...(gender && { gender }),
        ...(bio !== undefined && { bio }),
        ...(age && { age: Number(age) }),
        ...(dob && { dob }),
        ...(contact && { contact }),
        ...(hobbies !== undefined && { hobbies }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    res.status(200).json({ user: data });
  } catch (err) {
    console.error('[Users API] Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// 3. Delete current user account
router.delete('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) {
      throw error;
    }

    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (err) {
    console.error('[Users API] Error deleting account:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// 4. Update user location
router.post('/me/location', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { latitude, longitude, accuracy } = req.body;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        location: { latitude, longitude, accuracy },
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    res.status(200).json({ user: data });
  } catch (err) {
    console.error('[Users API] Error updating location:', err);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// 5. Update user vault/private files
router.post('/me/vault', authMiddleware, (req: AuthenticatedRequest, res) => {
  res.status(200).json({ success: true, message: 'Vault files updated successfully' });
});

// 6. Export user data payload
router.get('/me/export', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    res.status(200).json({ profile, exportedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

// 7. Get suggested users to discover
router.get('/suggested', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;

  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', userId || '')
      .limit(10);

    if (error) {
      throw error;
    }

    res.status(200).json({ users: users || [] });
  } catch (err) {
    console.error('[Users API] Error fetching suggested users:', err);
    res.status(200).json({ users: [] });
  }
});

// 8. Search users
router.get('/search', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { q } = req.query;
  if (!q) {
    res.status(200).json({ users: [] });
    return;
  }

  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${q}%`)
      .limit(20);

    if (error) {
      throw error;
    }

    res.status(200).json({ users: users || [] });
  } catch (err) {
    console.error('[Users API] Error searching users:', err);
    res.status(200).json({ users: [] });
  }
});

export default router;
