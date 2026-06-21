import jwt from 'jsonwebtoken';
import { redis } from '../config/redis.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signJwt } from '../utils/tokens.js';
import { avatarForGender, createUniqueUsername, guestIdentity } from '../utils/identity.js';
import { getClientIp } from '../utils/clientIp.js';
import { issueEmailVerification, verifyEmailCode } from '../services/emailVerification.service.js';
import { issuePasswordReset, validatePasswordReset } from '../services/passwordReset.service.js';
import { clearAuthCookie, setAuthCookie } from '../utils/authCookie.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';

async function recordLogin(req, user) {
  const ip = getClientIp(req);
  user.lastSeenAt = new Date();
  if (!ip) {
    await user.save();
    return;
  }
  user.lastIp = ip;
  user.ipHistory = [...(user.ipHistory || []), { ip, at: new Date() }].slice(-8);
  await user.save();
}

function notifyAdminOfNewUser(req, user) {
  try {
    const io = req.app?.get('io');
    if (io) {
      io.to('admin').emit('admin:user-registered', {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email || '',
        role: user.role,
        isVerified: user.isVerified,
        avatar: user.avatar,
        createdAt: user.createdAt
      });
    }
  } catch (err) {
    console.warn('Failed to emit user registration socket event:', err.message);
  }
}

function sendAuth(res, token, user, status = 200, extra = {}) {
  setAuthCookie(res, token);
  return res.status(status).json({ ok: true, token, user, ...extra });
}

function emailVerificationEnabled() {
  if (process.env.NODE_ENV === 'test' || process.env.DISABLE_EMAIL_VERIFICATION === 'true') {
    return false;
  }
  return true;
}

async function sendEmailVerificationResponse(res, user, status = 200, pushSubscription = null) {
  const { code, delivery } = await issueEmailVerification(user.email);
  return res.status(status).json({
    ok: true,
    verificationRequired: true,
    email: user.email,
    emailSent: delivery.sent,
    pushSent: false,
    message: delivery.sent 
      ? 'Verification code sent to your email.' 
      : 'Email provider is not configured. Check server console for code.'
  });
}

export const requestPasswordReset = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return res.json({ ok: true, message: 'If an account exists, a reset code was sent.' });
  }

  await issuePasswordReset(user.email);
  return res.json({ ok: true, message: 'If an account exists, a reset code was sent.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const valid = await validatePasswordReset(req.body.email, req.body.code);
  if (!valid) {
    const error = new Error('Invalid or expired reset code');
    error.status = 401;
    error.code = 'RESET_CODE_INVALID';
    throw error;
  }

  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    const error = new Error('Account not found');
    error.status = 404;
    throw error;
  }

  if (supabaseAdmin && user.supabaseId) {
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.supabaseId, {
      password: req.body.password
    });
    if (updateError) throw updateError;
  }
  
  return res.json({ ok: true, message: 'Password reset successfully. You can now log in.' });
});

export const signupWithEmail = asyncHandler(async (req, res) => {
  const existing = await User.findOne({ email: req.body.email });
  if (existing) {
    const error = new Error('Email is already registered');
    error.status = 409;
    throw error;
  }
  const usernameExists = await User.exists({ username: req.body.username });
  if (usernameExists) {
    const error = new Error('Username is already taken');
    error.status = 409;
    throw error;
  }

  // 1. Create the user in Supabase Auth (delegating password hashing & storage)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: req.body.email.toLowerCase(),
    password: req.body.password,
    email_confirm: !emailVerificationEnabled()
  });
  if (authError) throw authError;

  // 2. Create the public profile in PostgreSQL profiles
  const user = await User.create({
    _id: authData.user.id,
    supabaseId: authData.user.id,
    name: req.body.name,
    email: req.body.email.toLowerCase(),
    username: req.body.username.toLowerCase(),
    age: req.body.age,
    dob: req.body.dob,
    contact: req.body.contact || '',
    gender: req.body.gender,
    avatar: avatarForGender(req.body.gender, req.body.username),
    bio: req.body.bio || '',
    interests: req.body.interests || [],
    emailVerifiedAt: emailVerificationEnabled() ? undefined : new Date(),
    isGuest: false
  });

  if (emailVerificationEnabled()) {
    notifyAdminOfNewUser(req, user);
    return sendEmailVerificationResponse(res, user, 201, req.body.pushSubscription);
  }

  notifyAdminOfNewUser(req, user);
  return sendAuth(res, signJwt(user), user, 201);
});

export const loginWithEmail = asyncHandler(async (req, res) => {
  // 1. Authenticate with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: req.body.email.toLowerCase(),
    password: req.body.password
  });

  if (authError) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  // 2. Fetch the matching public profile
  const user = await User.findOne({ supabaseId: authData.user.id });
  if (!user) {
    const error = new Error('Account profile not found');
    error.status = 404;
    throw error;
  }

  // 3. Handle verification code redirect if needed
  if (emailVerificationEnabled() && !user.emailVerifiedAt) {
    const { code, delivery } = await issueEmailVerification(user.email);
    return res.status(403).json({
      ok: false,
      code: 'EMAIL_NOT_VERIFIED',
      message: delivery.sent 
        ? 'Please verify your email. We sent a fresh code.' 
        : 'Email provider is not configured. Check server console for code.',
      emailSent: delivery.sent,
      pushSent: false
    });
  }

  user.isGuest = false;
  await recordLogin(req, user);
  return sendAuth(res, signJwt(user), user);
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const valid = await verifyEmailCode(req.body.email, req.body.code);
  if (!valid) {
    const error = new Error('Invalid or expired verification code');
    error.status = 401;
    error.code = 'EMAIL_CODE_INVALID';
    throw error;
  }

  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    const error = new Error('Account not found');
    error.status = 404;
    throw error;
  }

  user.emailVerifiedAt = new Date();
  user.isGuest = false;
  await recordLogin(req, user);

  // Confirm email status in Supabase Auth
  if (supabaseAdmin && user.supabaseId) {
    await supabaseAdmin.auth.admin.updateUserById(user.supabaseId, { email_confirm: true });
  }

  return sendAuth(res, signJwt(user), user);
});

export const resendEmailVerification = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    const error = new Error('Account not found');
    error.status = 404;
    throw error;
  }
  if (!emailVerificationEnabled() || user.emailVerifiedAt) {
    return res.json({ ok: true, verificationRequired: false, message: 'Email is already verified.' });
  }
  return sendEmailVerificationResponse(res, user, 200, req.body.pushSubscription);
});

export const continueAsGuest = asyncHandler(async (req, res) => {
  const ip = getClientIp(req);
  const reuseSince = new Date(Date.now() - Number(process.env.GUEST_REUSE_HOURS || 24) * 60 * 60 * 1000);

  if (ip) {
    const existingGuest = await User.findOne({
      isGuest: true,
      lastIp: ip,
      updatedAt: { $gte: reuseSince }
    });

    if (existingGuest) {
      existingGuest.lastIp = ip;
      existingGuest.lastSeenAt = new Date();
      existingGuest.guestExpiresAt = undefined;
      if (req.body.name) {
        existingGuest.name = req.body.name;
        existingGuest.username = await createUniqueUsername(req.body.name);
        existingGuest.avatar = avatarForGender(req.body.gender || existingGuest.gender, existingGuest.username);
      }
      existingGuest.ipHistory = [...(existingGuest.ipHistory || []), { ip, at: new Date() }].slice(-8);
      await existingGuest.save();
      return sendAuth(res, signJwt(existingGuest), existingGuest, 200, { reused: true });
    }
  }

  const identity = await guestIdentity(req.body.gender);
  if (req.body.name) {
    identity.name = req.body.name;
    identity.username = await createUniqueUsername(req.body.name);
    identity.avatar = avatarForGender(req.body.gender, identity.username);
  }
  const user = await User.create({
    ...identity,
    age: req.body.age,
    gender: req.body.gender,
    bio: req.body.bio || '',
    isGuest: true,
    guestExpiresAt: undefined,
    lastIp: ip || undefined,
    lastSeenAt: new Date(),
    ipHistory: ip ? [{ ip, at: new Date() }] : []
  });

  notifyAdminOfNewUser(req, user);
  return sendAuth(res, signJwt(user), user, 201);
});

export const upgradeGuest = asyncHandler(async (req, res) => {
  if (!req.user.isGuest) {
    const error = new Error('Only guest accounts can be upgraded');
    error.status = 409;
    throw error;
  }

  const existing = await User.findOne({ email: req.body.email });
  if (existing) {
    const error = new Error('Email is already registered');
    error.status = 409;
    throw error;
  }

  // 1. Create the user in Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: req.body.email.toLowerCase(),
    password: req.body.password,
    email_confirm: true
  });
  if (authError) throw authError;

  const oldId = req.user.id;
  const newId = authData.user.id;
  const username = req.user.username || (await createUniqueUsername(req.body.name));

  // 2. Create the new profile referencing the new Supabase Auth User ID
  const user = await User.create({
    _id: newId,
    supabaseId: newId,
    email: req.body.email.toLowerCase(),
    username,
    name: req.body.name,
    age: Number(req.body.age),
    dob: req.body.dob,
    contact: req.body.contact || '',
    gender: req.body.gender,
    avatar: req.user.avatar || avatarForGender(req.body.gender, username),
    bio: req.body.bio || req.user.bio || '',
    interests: req.body.interests || req.user.interests || [],
    isGuest: false,
    emailVerifiedAt: new Date()
  });

  // 3. Delete old guest profile row
  await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', oldId);

  return sendAuth(res, signJwt(user), user);
});

export const logout = asyncHandler(async (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : readAuthCookie(req);
  if (token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        const remaining = decoded.exp - Math.floor(Date.now() / 1000);
        if (remaining > 0) {
          await redis.set(`jwt_blacklist:${token}`, '1', 'EX', remaining);
        }
      }
    } catch (err) {
      console.warn('JWT blacklist error on logout:', err.message);
    }
  }
  clearAuthCookie(res);
  res.json({ ok: true });
});

export const supabaseLogin = asyncHandler(async (req, res) => {
  if (!supabase) {
    const err = new Error('Supabase integration is not configured on the server');
    err.status = 503;
    throw err;
  }
  const { accessToken, name, username, age, gender, bio, interests } = req.body;

  // Verify access token with Supabase Auth
  const { data, error } = await supabase.auth.getUser(accessToken);
  const supabaseUser = data?.user;
  
  if (error || !supabaseUser) {
    const err = new Error(error?.message || 'Invalid Supabase access token');
    err.status = 401;
    throw err;
  }

  const supabaseId = supabaseUser.id;
  const email = supabaseUser.email ? supabaseUser.email.toLowerCase() : null;
  const phone = supabaseUser.phone || null;

  // Find user by supabaseId first
  let user = await User.findOne({ supabaseId });

  const isGoogleAuth = supabaseUser.app_metadata?.provider === 'google';
  let isNewUser = false;

  if (!user) {
    let finalUsername = username;
    let finalAge = age;
    let finalGender = gender;

    if (isGoogleAuth) {
      if (!finalUsername) {
        const baseName = supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'google_user';
        finalUsername = await createUniqueUsername(baseName);
      }
      if (!finalAge) finalAge = 18;
      if (!finalGender) finalGender = 'male';
    } else {
      if (!finalUsername || !finalAge || !finalGender) {
        return res.status(400).json({
          ok: false,
          code: 'PROFILE_REQUIRED',
          message: 'Profile details (username, age, gender) are required to complete signup.'
        });
      }
    }

    const usernameExists = await User.exists({ username: finalUsername.toLowerCase() });
    if (usernameExists) {
      const err = new Error('Username is already taken');
      err.status = 409;
      throw err;
    }

    isNewUser = true;
    user = await User.create({
      supabaseId,
      name: name || supabaseUser.user_metadata?.full_name || finalUsername,
      email: email || undefined,
      contact: phone || undefined,
      username: finalUsername.toLowerCase(),
      age: Number(finalAge),
      gender: finalGender,
      avatar: avatarForGender(finalGender, finalUsername),
      bio: bio || '',
      interests: interests || [],
      emailVerifiedAt: email ? new Date() : undefined,
      isGuest: false
    });

    notifyAdminOfNewUser(req, user);
  } else {
    if (email && !user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date();
      await user.save();
    }
  }

  user.isGuest = false;
  await recordLogin(req, user);

  await syncToSupabaseDb(user);

  return sendAuth(res, signJwt(user), user, isNewUser ? 201 : 200);
});

export const syncToSupabaseDb = async (user) => {
  if (!supabaseAdmin || !user.supabaseId) return;
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.supabaseId,
        username: user.username,
        name: user.name,
        avatar_url: user.avatar,
        updated_at: new Date()
      });
    if (error) {
      console.warn('Supabase DB sync warning:', error.message);
    }
  } catch (err) {
    console.warn('Supabase DB sync error:', err.message);
  }
};

export const checkUsernameAvailable = asyncHandler(async (req, res) => {
  const username = (req.query.username || '').trim().toLowerCase();
  if (!username || !/^[a-z0-9_]{3,24}$/.test(username)) {
    return res.json({ ok: true, available: false, message: 'Invalid username format' });
  }
  const exists = await User.exists({ username });
  return res.json({ ok: true, available: !exists });
});

export const runDiagnostic = asyncHandler(async (req, res) => {
  const results = {
    supabaseInitialized: !!supabase,
    supabaseAdminInitialized: !!supabaseAdmin,
    hasUrl: !!process.env.SUPABASE_URL,
    hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    nodeEnv: process.env.NODE_ENV,
    storageBucket: process.env.SUPABASE_BUCKET || 'media',
    uploadTest: null
  };

  res.json({ ok: true, diagnostics: results });
});
