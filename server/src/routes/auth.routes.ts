import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

const router = Router();

// 1. Guest Authentication Endpoint (Public)
router.post('/guest', (req, res) => {
  const { name, age, gender, bio } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Name is required to sign in as guest.' });
    return;
  }

  const guestId = `guest_${Math.random().toString(36).substring(2, 15)}`;

  // Sign a JWT token using our secret so that it can be locally verified in the socket handshake
  const token = jwt.sign(
    {
      sub: guestId,
      role: 'guest',
      email: `${guestId}@blippr.guest`,
      user_metadata: {
        name,
        age,
        gender,
        bio,
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
    const payload = jwt.verify(accessToken, env.SUPABASE_JWT_SECRET) as any;
    const userId = payload.sub;

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
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired Supabase access token.' });
  }
});

// 3. Username Availability Check (Public)
router.get('/username-check', async (req, res) => {
  const { username } = req.query;

  if (!username) {
    res.status(400).json({ error: 'Username parameter is required.' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', String(username).toLowerCase())
      .maybeSingle();

    if (error) {
      throw error;
    }

    res.status(200).json({ available: !data });
  } catch (err) {
    console.error('[Username Check] Error checking profiles:', err);
    // Fallback in case table doesn't exist or during development
    res.status(200).json({ available: true });
  }
});

// 4. Logout Endpoint
router.post('/logout', (req, res) => {
  res.status(200).json({ success: true });
});

export default router;
