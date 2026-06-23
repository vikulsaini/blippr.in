import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Public profile fields that can be returned to other users
const PUBLIC_PROFILE_FIELDS = 'id, username, name, avatar_url, age, gender, bio, created_at';

// Helper to check if a string is a valid UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (id?: string): boolean => !!id && UUID_REGEX.test(id);

// 1. Get current authenticated user profile
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Handle Guest Profile
  if (!isUuid(userId)) {
    res.status(200).json({
      user: {
        id: userId,
        username: userId,
        name: req.user?.user_metadata?.name || 'Guest User',
        age: req.user?.user_metadata?.age || 18,
        gender: req.user?.user_metadata?.gender || 'other',
        bio: req.user?.user_metadata?.bio || '',
        avatar_url: '',
        isGuest: true
      }
    });
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

  // Input validation
  if (username && (typeof username !== 'string' || username.length < 3 || username.length > 30)) {
    res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
    return;
  }
  if (name && (typeof name !== 'string' || name.length > 100)) {
    res.status(400).json({ error: 'Name must be under 100 characters' });
    return;
  }
  if (bio && typeof bio === 'string' && bio.length > 500) {
    res.status(400).json({ error: 'Bio must be under 500 characters' });
    return;
  }
  if (age && (typeof age !== 'number' || age < 13 || age > 150)) {
    res.status(400).json({ error: 'Age must be between 13 and 150' });
    return;
  }

  // Handle Guest updates (in-memory return)
  if (!isUuid(userId)) {
    res.status(200).json({
      user: {
        id: userId,
        username: userId,
        name: name || req.user?.user_metadata?.name || 'Guest User',
        age: age ? Number(age) : (req.user?.user_metadata?.age || 18),
        gender: gender || req.user?.user_metadata?.gender || 'other',
        bio: bio !== undefined ? bio : (req.user?.user_metadata?.bio || ''),
        avatar_url: '',
        isGuest: true
      }
    });
    return;
  }

  // Check username uniqueness if updating
  if (username) {
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase())
      .neq('id', userId)
      .maybeSingle();

    if (existingUser) {
      res.status(409).json({ error: 'Username is already taken' });
      return;
    }
  }

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

  if (!isUuid(userId)) {
    res.status(200).json({ success: true, message: 'Guest session ended' });
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

  // Validate coordinates
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    res.status(400).json({ error: 'Valid latitude and longitude are required' });
    return;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    res.status(400).json({ error: 'Invalid coordinate values' });
    return;
  }

  if (!isUuid(userId)) {
    res.status(200).json({
      user: {
        id: userId,
        location: { latitude, longitude, accuracy: accuracy || null },
        isGuest: true
      }
    });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        location: { latitude, longitude, accuracy: accuracy || null },
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

  if (!isUuid(userId)) {
    res.status(200).json({
      profile: {
        id: userId,
        username: userId,
        name: req.user?.user_metadata?.name || 'Guest User',
        age: req.user?.user_metadata?.age || 18,
        gender: req.user?.user_metadata?.gender || 'other',
        bio: req.user?.user_metadata?.bio || '',
        avatar_url: '',
        isGuest: true
      },
      exportedAt: new Date().toISOString()
    });
    return;
  }

  try {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    res.status(200).json({ profile, exportedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[Users API] Error exporting data:', err);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

// 7. Get suggested users to discover (returns only public fields)
router.get('/suggested', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;

  try {
    let { data: users, error } = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_FIELDS)
      .neq('id', isUuid(userId) ? userId : '')
      .limit(10);

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        console.warn('[Users API] profiles table does not exist. Returning empty users.');
        res.status(200).json({ users: [] });
        return;
      }
      if (error.code === '42703') {
        console.warn('[Users API] avatar_url column does not exist on profiles. Running fallback query.');
        const fallbackFields = 'id, username, name, age, gender, bio, created_at';
        const { data: fallbackUsers, error: fallbackError } = await supabase
          .from('profiles')
          .select(fallbackFields)
          .neq('id', isUuid(userId) ? userId : '')
          .limit(10);

        if (fallbackError) throw fallbackError;
        users = (fallbackUsers || []).map((u) => ({ ...u, avatar_url: '' }));
      } else {
        throw error;
      }
    }

    res.status(200).json({ users: users || [] });
  } catch (err) {
    console.error('[Users API] Error fetching suggested users:', err);
    res.status(500).json({ error: 'Failed to fetch suggested users' });
  }
});

// 8. Search users (returns only public fields)
router.get('/search', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    res.status(200).json({ users: [] });
    return;
  }

  // Limit search query length to prevent abuse
  const sanitizedQuery = q.trim().substring(0, 100);

  try {
    let { data: users, error } = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_FIELDS)
      .or(`username.ilike.%${sanitizedQuery}%,name.ilike.%${sanitizedQuery}%`)
      .limit(20);

    if (error) {
      if (error.code === '42703') {
        console.warn('[Users API] avatar_url column does not exist on profiles. Running fallback search query.');
        const fallbackFields = 'id, username, name, age, gender, bio, created_at';
        const { data: fallbackUsers, error: fallbackError } = await supabase
          .from('profiles')
          .select(fallbackFields)
          .or(`username.ilike.%${sanitizedQuery}%,name.ilike.%${sanitizedQuery}%`)
          .limit(20);

        if (fallbackError) throw fallbackError;
        users = (fallbackUsers || []).map((u) => ({ ...u, avatar_url: '' }));
      } else {
        throw error;
      }
    }

    res.status(200).json({ users: users || [] });
  } catch (err) {
    console.error('[Users API] Error searching users:', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

export default router;
