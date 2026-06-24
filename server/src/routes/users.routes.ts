import { Router } from 'express';
import { Profile } from '../config/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Helper to check if a string is a valid UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (id?: string): boolean => !!id && UUID_REGEX.test(id);

const serializeProfile = (p: any) => {
  if (!p) return null;
  return {
    id: p._id,
    username: p.username,
    name: p.name,
    avatar_url: p.avatar_url || '',
    bio: p.bio || '',
    age: p.age || null,
    dob: p.dob || null,
    gender: p.gender || 'other',
    contact: p.contact || '',
    hobbies: p.hobbies || '',
    location: p.location || null,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
};

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
    const profile = await Profile.findById(userId).lean();

    if (!profile) {
      res.status(404).json({ code: 'PROFILE_REQUIRED', error: 'Profile not found' });
      return;
    }

    res.status(200).json({ user: serializeProfile(profile) });
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
    const existingUser = await Profile.findOne({ username: username.toLowerCase(), _id: { $ne: userId } });

    if (existingUser) {
      res.status(409).json({ error: 'Username is already taken' });
      return;
    }
  }

  try {
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (username !== undefined) updates.username = username.toLowerCase();
    if (gender !== undefined) updates.gender = gender;
    if (bio !== undefined) updates.bio = bio;
    if (age !== undefined) updates.age = Number(age);
    if (dob !== undefined) updates.dob = dob;
    if (contact !== undefined) updates.contact = contact;
    if (hobbies !== undefined) updates.hobbies = hobbies;

    const data = await Profile.findByIdAndUpdate(userId, updates, { new: true }).lean();

    res.status(200).json({ user: serializeProfile(data) });
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
    await Profile.findByIdAndDelete(userId);
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
    const data = await Profile.findByIdAndUpdate(
      userId,
      { location: { latitude, longitude, accuracy: accuracy || null } },
      { new: true }
    ).lean();

    res.status(200).json({ user: serializeProfile(data) });
  } catch (err) {
    console.error('[Users API] Error updating location:', err);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// 5. Export user data payload
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
    const profile = await Profile.findById(userId).lean();
    res.status(200).json({ profile: serializeProfile(profile), exportedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[Users API] Error exporting data:', err);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

// Haversine distance formula helper
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 7. Get suggested users to discover (returns only public fields)
router.get('/suggested', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;

  try {
    // 1. Fetch own location
    let myLocation: { latitude: number; longitude: number } | null = null;
    if (isUuid(userId)) {
      const myProfile = await Profile.findById(userId).select('location').lean();
      if (myProfile?.location && typeof myProfile.location === 'object') {
        const loc = myProfile.location as any;
        if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
          myLocation = { latitude: loc.latitude, longitude: loc.longitude };
        }
      }
    }

    // 2. Fetch candidate users (limit to 100 so we have a good pool for sorting)
    const targetUserId = isUuid(userId) ? userId : '';
    const users = await Profile.find({ _id: { $ne: targetUserId } }).limit(100).lean();

    const resultUsers = users.map((u: any) => {
      let distance: number | null = null;
      if (
        myLocation &&
        u.location &&
        typeof u.location === 'object' &&
        typeof (u.location as any).latitude === 'number' &&
        typeof (u.location as any).longitude === 'number'
      ) {
        distance = getDistance(
          myLocation.latitude,
          myLocation.longitude,
          (u.location as any).latitude,
          (u.location as any).longitude
        );
      }
      return { ...serializeProfile(u), distance };
    });

    // Sort: users with closest distance first, then users without location/distance
    resultUsers.sort((a, b) => {
      if (a.distance !== null && b.distance !== null) {
        return a.distance - b.distance;
      }
      if (a.distance !== null) return -1;
      if (b.distance !== null) return 1;
      return 0;
    });

    res.status(200).json({ users: resultUsers });
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
    const users = await Profile.find({
      $or: [
        { username: { $regex: sanitizedQuery, $options: 'i' } },
        { name: { $regex: sanitizedQuery, $options: 'i' } },
      ],
    }).limit(20).lean();

    res.status(200).json({ users: (users || []).map(u => serializeProfile(u)) });
  } catch (err) {
    console.error('[Users API] Error searching users:', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

export default router;
