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
import { canExposeOtp, issueOtp, verifyOtp } from '../services/otp.service.js';
import { canExposeEmailCode, issueEmailVerification, verifyEmailCode } from '../services/emailVerification.service.js';
import { notifyUser } from '../services/notification.service.js';
import { clearAuthCookie, setAuthCookie, readAuthCookie } from '../utils/authCookie.js';

export const requestOtpSchema = Joi.object({
  phone: Joi.string().min(8).max(18).required()
});

export const verifyOtpSchema = Joi.object({
  phone: Joi.string().min(8).max(18).required(),
  otp: Joi.string().length(6).required(),
  name: Joi.string().trim().min(2).max(80).required(),
  username: Joi.string().lowercase().pattern(/^[a-z0-9_]{3,24}$/).optional(),
  age: Joi.number().integer().min(18).max(120).required(),
  dob: Joi.date().iso().optional(),
  contact: Joi.string().trim().max(40).allow('').optional(),
  gender: Joi.string().valid('male', 'female').required(),
  bio: Joi.string().max(160).allow('').optional(),
  interests: Joi.array().items(Joi.string().trim().max(40)).max(12).optional()
});

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

function sendAuth(res, token, user, status = 200, extra = {}) {
  setAuthCookie(res, token);
  return res.status(status).json({ ok: true, token, user, ...extra });
}

function emailVerificationEnabled() {
  return process.env.DISABLE_EMAIL_VERIFICATION !== 'true';
}

function providerMissingError(kind) {
  const error = new Error(`${kind.toUpperCase()} provider is not configured on the server`);
  error.status = 503;
  error.code = `${kind.toUpperCase()}_PROVIDER_MISSING`;
  return error;
}

function shouldReturnEmailCode(delivery) {
  return canExposeEmailCode() || !delivery.sent;
}

async function sendEmailVerificationResponse(res, user, status = 200) {
  const { code, delivery } = await issueEmailVerification(user.email);
  return res.status(status).json({
    ok: true,
    verificationRequired: true,
    email: user.email,
    emailSent: delivery.sent,
    message: delivery.sent ? 'Verification code sent to your email.' : 'Email provider is not configured. Use this testing code to verify your account.',
    ...(shouldReturnEmailCode(delivery) ? { verificationCode: code } : {})
  });
}

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
  interests: Joi.array().items(Joi.string().trim().max(40)).max(12).optional()
});

export const emailLoginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(8).max(72).required()
});

export const emailVerifySchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  code: Joi.string().length(6).required()
});

export const emailResendSchema = Joi.object({
  email: Joi.string().email().lowercase().required()
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
  age: Joi.number().integer().min(18).max(120).required(),
  gender: Joi.string().valid('male', 'female').required(),
  bio: Joi.string().max(160).allow('').optional()
});

export const requestOtp = asyncHandler(async (req, res) => {
  const { otp, delivery } = await issueOtp(req.body.phone);
  if (!delivery.sent && !canExposeOtp()) throw providerMissingError('sms');
  res.json({
    ok: true,
    message: delivery.sent ? 'OTP sent' : 'OTP generated. SMS provider is not configured.',
    smsSent: delivery.sent,
    ...(canExposeOtp() ? { otp } : {})
  });
});

export const verifyPhoneOtp = asyncHandler(async (req, res) => {
  const valid = await verifyOtp(req.body.phone, req.body.otp);
  if (!valid) {
    const error = new Error('Invalid or expired OTP');
    error.status = 401;
    throw error;
  }
  const existingUser = await User.findOne({ phone: req.body.phone }).select('+lastIp +ipHistory');
  if (!existingUser && !req.body.username) {
    const error = new Error('Username is required for new phone signup');
    error.status = 422;
    throw error;
  }
  if (req.body.username) {
    const usernameExists = await User.exists({ username: req.body.username, phone: { $ne: req.body.phone } });
    if (usernameExists) {
      const error = new Error('Username is already taken');
      error.status = 409;
      throw error;
    }
  }
  const user = await User.findOneAndUpdate(
    { phone: req.body.phone },
    {
      $set: {
        name: req.body.name,
        age: req.body.age,
        dob: req.body.dob,
        contact: req.body.contact || '',
        gender: req.body.gender,
        bio: req.body.bio || '',
        interests: req.body.interests || []
      },
      $setOnInsert: {
        phone: req.body.phone,
        username: req.body.username,
        avatar: avatarForGender(req.body.gender, req.body.username)
      }
    },
    { upsert: true, new: true }
  );
  await recordLogin(req, user);
  return sendAuth(res, signJwt(user), user);
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

  if (emailVerificationEnabled()) return sendEmailVerificationResponse(res, user, 201);

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
    return res.status(403).json({
      ok: false,
      code: 'EMAIL_NOT_VERIFIED',
      message: delivery.sent ? 'Please verify your email. We sent a fresh code.' : 'Email provider is not configured. Use this testing code to verify your account.',
      email: user.email,
      emailSent: delivery.sent,
      ...(shouldReturnEmailCode(delivery) ? { verificationCode: code } : {})
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
  return sendEmailVerificationResponse(res, user);
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
      existingGuest.guestExpiresAt = existingGuest.guestExpiresAt || new Date(Date.now() + Number(process.env.GUEST_LIMIT_MINUTES || 10) * 60 * 1000);
      existingGuest.ipHistory = [...(existingGuest.ipHistory || []), { ip, at: new Date() }].slice(-8);
      await existingGuest.save();
      return sendAuth(res, signJwt(existingGuest), existingGuest, 200, { reused: true });
    }
  }

  const identity = await guestIdentity(req.body.gender);
  const user = await User.create({
    ...identity,
    age: req.body.age,
    gender: req.body.gender,
    bio: req.body.bio || '',
    isGuest: true,
    guestExpiresAt: new Date(Date.now() + Number(process.env.GUEST_LIMIT_MINUTES || 10) * 60 * 1000),
    lastIp: ip || undefined,
    lastSeenAt: new Date(),
    ipHistory: ip ? [{ ip, at: new Date() }] : []
  });

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
      message: delivery.sent ? 'Verification code sent to your email.' : 'Email provider is not configured. Use this testing code to verify your account.',
      ...(shouldReturnEmailCode(delivery) ? { verificationCode: code } : {})
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
