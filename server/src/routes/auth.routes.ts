import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

const router = Router();

// In-memory rate limiting (simple; for production use a proper store like Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count++;
  return true;
}

// 1. Guest Authentication Endpoint (Public)
router.post('/guest', (req, res) => {
  const { name, age, gender, bio } = req.body;

  // Validate name
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Name is required to sign in as guest.' });
    return;
  }
  if (name.trim().length > 50) {
    res.status(400).json({ error: 'Name must be under 50 characters.' });
    return;
  }

  // Rate limit guest creation per IP (10 per hour)
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(`guest:${ip}`, 10, 60 * 60 * 1000)) {
    res.status(429).json({ error: 'Too many guest accounts created. Please try again later.' });
    return;
  }

  const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const sanitizedName = name.trim().substring(0, 50);

  // Sign a JWT token using our secret so that it can be locally verified in the socket handshake
  const token = jwt.sign(
    {
      sub: guestId,
      role: 'guest',
      email: `${guestId}@blippr.guest`,
      user_metadata: {
        name: sanitizedName,
        age: age || null,
        gender: gender || null,
        bio: bio || '',
      },
    },
    env.SUPABASE_JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.status(200).json({ token });
});

// 2. Supabase Session Sync Endpoint (Public)
router.post('/supabase', async (req, res) => {
  const { accessToken, username, name, age, gender, bio } = req.body;

  if (!accessToken) {
    res.status(400).json({ error: 'Access token is required.' });
    return;
  }

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      console.error('[Auth Sync] Supabase auth.getUser failed:', authError?.message || 'No user found');
      res.status(401).json({ error: 'Invalid or expired Supabase access token.', details: authError?.message });
      return;
    }
    const userId = user.id;

    // Validate username if provided
    if (username && (typeof username !== 'string' || username.length < 3 || username.length > 30)) {
      res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
      return;
    }

    // Check if a profile already exists for this user ID
    let profile = null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[Auth Sync] Profile check error:', error.message);
      } else {
        profile = data;
      }
    } catch (dbErr) {
      console.error('[Auth Sync] Database profile fetch failed:', dbErr);
    }

    if (!profile) {
      // If there is no existing profile and the user is not completing signup (no username sent)
      if (!username) {
        res.status(400).json({
          code: 'PROFILE_REQUIRED',
          message: 'No account found. Please sign up first!'
        });
        return;
      }

      // Check username uniqueness before inserting
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .maybeSingle();

      if (existingUser) {
        res.status(409).json({ error: 'Username is already taken' });
        return;
      }

      // User is completing signup, insert a new profile record
      try {
        const { error } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            username: username.toLowerCase(),
            name: name || username,
            age: age || 18,
            gender: gender || 'other',
            bio: bio || '',
            updated_at: new Date().toISOString(),
          });

        if (error) {
          console.error('[Auth Sync] Supabase profile insert error:', error.message);
          res.status(500).json({ error: 'Failed to create user profile.' });
          return;
        }
      } catch (insertErr) {
        console.error('[Auth Sync] Database profile insert failed:', insertErr);
        res.status(500).json({ error: 'Database connection failed during signup.' });
        return;
      }
    } else {
      // Profile exists, perform updates if new metadata values are supplied
      if (username || name || age || gender || bio) {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({
              ...(username && { username: username.toLowerCase() }),
              ...(name && { name }),
              ...(age && { age }),
              ...(gender && { gender }),
              ...(bio && { bio }),
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          if (error) {
            console.error('[Auth Sync] Profile update error:', error.message);
          }
        } catch (updateErr) {
          console.error('[Auth Sync] Database profile update failed:', updateErr);
        }
      }
    }

    res.status(200).json({ token: accessToken });
  } catch (err: any) {
    console.error('[Auth Sync] JWT verification failed:', err?.message || err);
    res.status(401).json({ error: 'Invalid or expired Supabase access token.', details: err?.message });
  }
});

// 3. Username Availability Check (Public)
router.get('/username-check', async (req, res) => {
  const { username } = req.query;

  if (!username || typeof username !== 'string') {
    res.status(400).json({ error: 'Username parameter is required.' });
    return;
  }

  const sanitizedUsername = username.trim().toLowerCase();
  
  if (sanitizedUsername.length < 3 || sanitizedUsername.length > 30) {
    res.status(200).json({ available: false, error: 'Username must be between 3 and 30 characters' });
    return;
  }

  // Only allow alphanumeric and underscores
  if (!/^[a-z0-9_]+$/.test(sanitizedUsername)) {
    res.status(200).json({ available: false, error: 'Username can only contain letters, numbers, and underscores' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', sanitizedUsername)
      .maybeSingle();

    if (error) {
      throw error;
    }

    res.status(200).json({ available: !data });
  } catch (err) {
    console.error('[Username Check] Error checking profiles:', err);
    res.status(503).json({ error: 'Unable to check username availability. Please try again.' });
  }
});

// 4. Logout Endpoint
router.post('/logout', (req, res) => {
  res.status(200).json({ success: true });
});

export default router;
