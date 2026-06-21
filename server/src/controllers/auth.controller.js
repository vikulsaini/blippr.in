import Joi from 'joi';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { redis } from '../config/redis.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signJwt } from '../utils/tokens.js';
import { avatarForGender, createUniqueUsername, guestIdentity } from '../utils/identity.js';
import { getClientIp } from '../utils/clientIp.js';
import { issueEmailVerification, verifyEmailCode } from '../services/emailVerification.service.js';
import { issuePasswordReset, validatePasswordReset } from '../services/passwordReset.service.js';
import { notifyUser, sendDirectPushNotification } from '../services/notification.service.js';
import { clearAuthCookie, setAuthCookie, readAuthCookie } from '../utils/authCookie.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';

async function recordLogin(req, user) {
  const ip = getClientIp(req);
  user.lastSeenAt = new Date();
  if (!ip) {
    await user.save();
    return;
  }
  const previousIp = user.lastIp;
  const isNewLocation = previousIp && previousIp !== ip;

  user.lastIp = ip;
  user.ipHistory = [...(user.ipHistory || []), { ip, at: new Date() }].slice(-8);
  await user.save();

  if (isNewLocation) {
    const { notification } = await notifyUser(user._id, {
      title: 'New login detected',
      body: 'Your Blippr account was used on another device or network.',
      url: '/app/profile',
      type: 'login',
      actor: user._id
    });
    req.app.get('io')?.to(`user:${user._id}`).emit('notification:new', { notification });
  }
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
  let pushSent = false;
  if (pushSubscription && pushSubscription.endpoint) {
    pushSent = await sendDirectPushNotification(pushSubscription, {
      title: 'Blippr Verification Code',
      body: `Your verification code is: ${code}`,
      url: '/auth',
      type: 'otp'
    });
  }
  return res.status(status).json({
    ok: true,
    verificationRequired: true,
    email: user.email,
    emailSent: delivery.sent,
    pushSent,
    message: pushSent 
      ? 'Verification code sent via Push Notification.' 
      : (delivery.sent ? 'Verification code sent to your email.' : 'Email provider is not configured. Check server console for code.')
  });
}

const pushSubscriptionSchema = Joi.object({
  endpoint: Joi.string().uri().required(),
  keys: Joi.object({
    p256dh: Joi.string().required(),
    auth: Joi.string().required()
  }).required()
}).optional();

export const emailSignupSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  username: Joi.string().lowercase().pattern(/^[a-z0-9_]{3,24}$/).required(),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(8).max(72).required(),
  age: Joi.number().integer().min(18).max(120).required(),
  dob: Joi.date().iso().optional(),
  contact: Joi.string().trim().max(40).allow('').optional(),
  gender: Joi.string().valid('male', 'female').required(),
  bio: Joi.string().max(160).allow('').optional(),
  interests: Joi.array().items(Joi.string().trim().max(40)).max(12).optional(),
  pushSubscription: pushSubscriptionSchema
});

export const emailLoginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(8).max(72).required(),
  pushSubscription: pushSubscriptionSchema
});

export const emailVerifySchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  code: Joi.string().length(6).required()
});

export const emailResendSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  pushSubscription: pushSubscriptionSchema
});


export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().lowercase().required()
});

export const resetPasswordSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  code: Joi.string().length(6).required(),
  password: Joi.string().min(8).max(72).required()
});

export const guestUpgradeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(8).max(72).required(),
  age: Joi.number().integer().min(18).max(120).required(),
  dob: Joi.date().iso().optional(),
  contact: Joi.string().trim().max(40).allow('').optional(),
  gender: Joi.string().valid('male', 'female').required(),
  bio: Joi.string().max(160).allow('').optional(),
  interests: Joi.array().items(Joi.string().trim().max(40)).max(12).optional()
});

export const guestSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  age: Joi.number().integer().min(18).max(120).required(),
  gender: Joi.string().valid('male', 'female').required(),
  bio: Joi.string().max(160).allow('').optional()
});

export const requestPasswordReset = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    // Return a success message even if user not found to prevent email enumeration
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

  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  await user.save();
  
  // Clear any existing tokens in redis cache if applicable
  // Or simply let them expire and force new login
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

  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    passwordHash,
    username: req.body.username,
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
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash +lastIp +ipHistory');
  const passwordMatches = user ? await bcrypt.compare(req.body.password, user.passwordHash || '') : false;

  if (!passwordMatches) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  if (emailVerificationEnabled() && !user.emailVerifiedAt) {
    const { code, delivery } = await issueEmailVerification(user.email);
    let pushSent = false;
    if (req.body.pushSubscription && req.body.pushSubscription.endpoint) {
      pushSent = await sendDirectPushNotification(req.body.pushSubscription, {
        title: 'Blippr Verification Code',
        body: `Your verification code is: ${code}`,
        url: '/auth',
        type: 'otp'
      });
    }
    return res.status(403).json({
      ok: false,
      code: 'EMAIL_NOT_VERIFIED',
      message: pushSent
        ? 'Verification code sent via Push Notification.'
        : (delivery.sent ? 'Please verify your email. We sent a fresh code.' : 'Email provider is not configured. Check server console for code.'),
      email: user.email,
      emailSent: delivery.sent,
      pushSent
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

  const user = await User.findOne({ email: req.body.email }).select('+lastIp +ipHistory');
  if (!user) {
    const error = new Error('Account not found');
    error.status = 404;
    throw error;
  }

  user.emailVerifiedAt = new Date();
  user.isGuest = false;
  await recordLogin(req, user);
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
    }).select('+lastIp +ipHistory');

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
    email: req.body.email,
    password: req.body.password,
    email_confirm: true
  });
  if (authError) throw authError;

  const oldId = req.user.id;
  const newId = authData.user.id;
  const username = req.user.username || (await createUniqueUsername(req.body.name));

  // 2. Create the new profile
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

  // 3. Migrate references in chats table
  const { data: chatsToUpdate } = await supabaseAdmin
    .from('chats')
    .select('id, members')
    .contains('members', [oldId]);

  if (chatsToUpdate && chatsToUpdate.length > 0) {
    for (const chat of chatsToUpdate) {
      const updatedMembers = chat.members.map(m => m === oldId ? newId : m);
      await supabaseAdmin
        .from('chats')
        .update({ members: updatedMembers })
        .eq('id', chat.id);
    }
  }

  // Migrate references in messages table
  await supabaseAdmin
    .from('messages')
    .update({ sender_id: newId })
    .eq('sender_id', oldId);

  // Migrate references in friend_requests table
  await supabaseAdmin
    .from('friend_requests')
    .update({ sender_id: newId })
    .eq('sender_id', oldId);

  await supabaseAdmin
    .from('friend_requests')
    .update({ receiver_id: newId })
    .eq('receiver_id', oldId);

  // Migrate references in calls table
  await supabaseAdmin
    .from('calls')
    .update({ host_id: newId })
    .eq('host_id', oldId);

  await supabaseAdmin
    .from('calls')
    .update({ peer_id: newId })
    .eq('peer_id', oldId);

  // Migrate references in notifications table
  await supabaseAdmin
    .from('notifications')
    .update({ user_id: newId })
    .eq('user_id', oldId);

  await supabaseAdmin
    .from('notifications')
    .update({ actor_id: newId })
    .eq('actor_id', oldId);

  // Migrate references in reports table
  await supabaseAdmin
    .from('reports')
    .update({ reporter_id: newId })
    .eq('reporter_id', oldId);

  await supabaseAdmin
    .from('reports')
    .update({ reported_id: newId })
    .eq('reported_id', oldId);

  // 4. Delete old guest profile row
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

export const supabaseAuthSchema = Joi.object({
  accessToken: Joi.string().required(),
  name: Joi.string().trim().min(2).max(80).optional(),
  username: Joi.string().lowercase().pattern(/^[a-z0-9_]{3,24}$/).optional(),
  age: Joi.number().integer().min(18).max(120).optional(),
  gender: Joi.string().valid('male', 'female').optional(),
  bio: Joi.string().max(160).allow('').optional(),
  interests: Joi.array().items(Joi.string().trim().max(40)).max(12).optional()
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
  let user = await User.findOne({ supabaseId }).select('+lastIp +ipHistory');

  // If not found, try by email or phone to link legacy/different-auth accounts
  if (!user) {
    if (email) {
      user = await User.findOne({ email }).select('+lastIp +ipHistory');
    }
    if (!user && phone) {
      user = await User.findOne({ contact: phone }).select('+lastIp +ipHistory');
    }

    // Link the supabaseId if the user was found via email/phone fallback
    if (user) {
      user.supabaseId = supabaseId;
      if (email && !user.email) user.email = email;
      if (phone && !user.contact) user.contact = phone;
      await user.save();
    }
  }

  const isGoogleAuth = supabaseUser.app_metadata?.provider === 'google';
  let isNewUser = false;

  if (!user) {
    let finalUsername = username;
    let finalAge = age;
    let finalGender = gender;

    if (isGoogleAuth) {
      // Auto-generate username for Google sign-ins if not provided
      if (!finalUsername) {
        const baseName = supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'google_user';
        finalUsername = await createUniqueUsername(baseName);
      }
      // Provide defaults for age/gender if not specified (since we bypass onboarding)
      if (!finalAge) finalAge = 18;
      if (!finalGender) finalGender = 'male'; // fallback
    } else {
      // We need to create a new user. Check if required profile fields are present.
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
    // Ensure emailVerifiedAt is populated if they logged in with verified email/phone
    if (email && !user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date();
      await user.save();
    }
  }

  user.isGuest = false;
  await recordLogin(req, user);

  // Sync to Supabase Database
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

  if (supabaseAdmin) {
    try {
      const bucketName = process.env.SUPABASE_BUCKET || 'media';
      const testFilename = `diag-test-${Date.now()}.txt`;
      const fileBuffer = Buffer.from('diag');

      const { data, error } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(testFilename, fileBuffer, {
          contentType: 'text/plain',
          upsert: true
        });

      if (error) {
        results.uploadTest = { ok: false, error: error.message };
      } else {
        const { data: { publicUrl } } = supabaseAdmin.storage.from(bucketName).getPublicUrl(testFilename);
        results.uploadTest = { ok: true, publicUrl };
        await supabaseAdmin.storage.from(bucketName).remove([testFilename]);
      }
    } catch (err) {
      results.uploadTest = { ok: false, error: err.message };
    }
  }

  res.json({ ok: true, diagnostics: results });
});


