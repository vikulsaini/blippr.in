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

    // Sync profile to database using the service role client
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          username: username || payload.email?.split('@')[0],
          name: name || username || payload.email?.split('@')[0],
          age: age || 18,
          gender: gender || 'other',
          bio: bio || '',
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('[Auth Sync] Supabase profile sync error:', error.message);
      }
    } catch (dbErr) {
      console.error('[Auth Sync] Database profile write failed:', dbErr);
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
