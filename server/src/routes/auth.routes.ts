import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';
import { Profile } from '../config/db.js';

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

async function generateUniqueUsername(email: string | undefined, fullName: string | undefined): Promise<string> {
  let base = 'user';
  if (email) {
    base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
  } else if (fullName) {
    base = fullName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }
  
  if (base.length < 3) {
    base = 'user_' + base;
  }
  base = base.substring(0, 20);

  let username = base;
  let exists = await Profile.findOne({ username });
  let counter = 1;
  
  while (exists && counter < 1000) {
    username = `${base}${counter}`;
    exists = await Profile.findOne({ username });
    counter++;
  }
  
  if (exists) {
    username = `${base}${Math.floor(Math.random() * 10000)}`;
  }
  
  return username;
}

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
      profile = await Profile.findById(userId);
    } catch (dbErr) {
      console.error('[Auth Sync] Database profile fetch failed:', dbErr);
    }

    if (!profile) {
      if (!username) {
        // Auto-create profile (e.g. Google OAuth login)
        const metadata = user.user_metadata || {};
        const generatedUsername = await generateUniqueUsername(user.email, metadata.full_name || metadata.name);
        try {
          profile = await Profile.create({
            _id: userId,
            username: generatedUsername,
            name: metadata.full_name || metadata.name || generatedUsername,
            age: 18,
            gender: 'other',
            bio: '',
          });
        } catch (insertErr) {
          console.error('[Auth Sync] Database profile insert failed during auto-create:', insertErr);
          res.status(500).json({ error: 'Database connection failed during signup.' });
          return;
        }
      } else {
        // Check username uniqueness before inserting
        const existingUser = await Profile.findOne({ username: username.toLowerCase() });

        if (existingUser) {
          res.status(409).json({ error: 'Username is already taken' });
          return;
        }

        // User is completing signup, insert a new profile record
        try {
          profile = await Profile.create({
            _id: userId,
            username: username.toLowerCase(),
            name: name || username,
            age: age || 18,
            gender: gender || 'other',
            bio: bio || '',
          });
        } catch (insertErr) {
          console.error('[Auth Sync] Database profile insert failed:', insertErr);
          res.status(500).json({ error: 'Database connection failed during signup.' });
          return;
        }
      }
    } else {
      // Profile exists, perform updates if new metadata values are supplied
      if (username || name || age || gender || bio) {
        try {
          const updates: any = {};
          if (username) updates.username = username.toLowerCase();
          if (name) updates.name = name;
          if (age) updates.age = age;
          if (gender) updates.gender = gender;
          if (bio) updates.bio = bio;
          
          await Profile.findByIdAndUpdate(userId, updates);
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
    const data = await Profile.findOne({ username: sanitizedUsername });

    res.status(200).json({ available: !data });
  } catch (err) {
    console.error('[Username Check] Error checking profiles:', err);
    res.status(503).json({ error: 'Unable to check username availability. Please try again.' });
  }
});

// 4. Guest Upgrade Endpoint
router.post('/guest/upgrade', async (req, res) => {
  const { name, email, password, age, gender, bio, interests } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required for upgrade.' });
    return;
  }

  try {
    // 1. Register user with Supabase
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password: password,
    });

    if (signUpError || !data.user) {
      console.error('[Guest Upgrade] Supabase signUp failed:', signUpError?.message);
      res.status(400).json({ error: signUpError?.message || 'Failed to register with Supabase.' });
      return;
    }

    const userId = data.user.id;

    // 2. Create profile in MongoDB
    try {
      const generatedUsername = await generateUniqueUsername(email, name);
      await Profile.create({
        _id: userId,
        username: generatedUsername,
        name: name || generatedUsername,
        age: age || 18,
        gender: gender || 'other',
        bio: bio || '',
        interests: interests || [],
      });
    } catch (dbErr) {
      console.error('[Guest Upgrade] Database profile creation failed:', dbErr);
      res.status(500).json({ error: 'Database profile creation failed.' });
      return;
    }

    // 3. Return session token if session exists
    if (data.session) {
      res.status(200).json({ token: data.session.access_token });
    } else {
      res.status(200).json({ 
        token: null,
        message: 'Registration successful! Please check your email to verify your account before logging in.' 
      });
    }
  } catch (err: any) {
    console.error('[Guest Upgrade] Upgrade failed:', err?.message || err);
    res.status(500).json({ error: err?.message || 'An error occurred during upgrade.' });
  }
});

// 5. Logout Endpoint
router.post('/logout', (req, res) => {
  res.status(200).json({ success: true });
});

export default router;
