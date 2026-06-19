import Joi from 'joi';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
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
import { supabase } from '../config/supabase.js';


export const googleLoginSchema = Joi.object({
  idToken: Joi.string().required(),
  name: Joi.string().max(80).optional(),
  avatar: Joi.string().uri().optional(),
  age: Joi.number().integer().min(18).max(120).required(),
  gender: Joi.string().valid('male', 'female').required(),
  bio: Joi.string().max(160).allow('').optional()
});

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

  const existing = await User.findOne({ email: req.body.email, _id: { $ne: req.user._id } });
  if (existing) {
    const error = new Error('Email is already registered');
    error.status = 409;
    throw error;
  }

  req.user.name = req.body.name;
  req.user.email = req.body.email;
  req.user.username = req.user.username || (await createUniqueUsername(req.body.name));
  req.user.passwordHash = await bcrypt.hash(req.body.password, 12);
  req.user.emailVerifiedAt = emailVerificationEnabled() ? undefined : new Date();
  req.user.age = req.body.age;
  req.user.dob = req.body.dob;
  req.user.contact = req.body.contact || '';
  req.user.gender = req.body.gender;
  req.user.avatar = req.user.avatar || avatarForGender(req.body.gender, req.user.username);
  req.user.bio = req.body.bio || req.user.bio || '';
  req.user.interests = req.body.interests || req.user.interests || [];
  req.user.isGuest = false;
  req.user.guestExpiresAt = undefined;
  await req.user.save();

  if (emailVerificationEnabled()) {
    const { code, delivery } = await issueEmailVerification(req.user.email);
    return sendAuth(res, signJwt(req.user), req.user, 200, {
      verificationRequired: true,
      emailSent: delivery.sent,
      message: delivery.sent ? 'Verification code sent to your email.' : 'Email provider is not configured. Check server console for code.'
    });
  }

  return sendAuth(res, signJwt(req.user), req.user);
});

export const googleLogin = asyncHandler(async (req, res) => {
  const ticket = await googleClient.verifyIdToken({
    idToken: req.body.idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();
  const googleId = payload.sub;
  const user = await User.findOneAndUpdate(
    { googleId },
    {
      $set: {
        googleId,
        name: req.body.name || payload.name || 'Google User',
        avatar: req.body.avatar || payload.picture || avatarForGender(req.body.gender, googleId),
        age: req.body.age,
        gender: req.body.gender,
        bio: req.body.bio || ''
      },
      $setOnInsert: {
        username: await createUniqueUsername(req.body.name || payload.name || 'google')
      }
    },
    { upsert: true, new: true }
  ).select('+lastIp +ipHistory');
  await recordLogin(req, user);
  if (user.createdAt && Date.now() - user.createdAt.getTime() < 5000) {
    notifyAdminOfNewUser(req, user);
  }
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
  const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(accessToken);
  
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

  let isNewUser = false;

  if (!user) {
    // We need to create a new user. Check if required profile fields are present.
    if (!username || !age || !gender) {
      return res.status(400).json({
        ok: false,
        code: 'PROFILE_REQUIRED',
        message: 'Profile details (username, age, gender) are required to complete signup.'
      });
    }

    const usernameExists = await User.exists({ username: username.toLowerCase() });
    if (usernameExists) {
      const err = new Error('Username is already taken');
      err.status = 409;
      throw err;
    }

    isNewUser = true;
    user = await User.create({
      supabaseId,
      name: name || username,
      email: email || undefined,
      contact: phone || undefined,
      username: username.toLowerCase(),
      age: Number(age),
      gender,
      avatar: avatarForGender(gender, username),
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

  return sendAuth(res, signJwt(user), user, isNewUser ? 201 : 200);
});

