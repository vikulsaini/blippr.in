import Joi from 'joi';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signJwt } from '../utils/tokens.js';
import { avatarForGender, createUniqueUsername, guestIdentity } from '../utils/identity.js';
import { getClientIp } from '../utils/clientIp.js';
import { issueOtp, verifyOtp } from '../services/otp.service.js';
import { notifyUser } from '../services/notification.service.js';

export const requestOtpSchema = Joi.object({
  phone: Joi.string().min(8).max(18).required()
});

export const verifyOtpSchema = Joi.object({
  phone: Joi.string().min(8).max(18).required(),
  otp: Joi.string().length(6).required(),
  name: Joi.string().trim().min(2).max(80).required(),
  username: Joi.string().lowercase().pattern(/^[a-z0-9_]{3,24}$/).optional(),
  age: Joi.number().integer().min(18).max(120).required(),
  gender: Joi.string().valid('male', 'female').required(),
  bio: Joi.string().max(160).allow('').optional()
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
      body: 'Your Varta account was used on another device or network.',
      url: '/app/profile',
      type: 'login',
      actor: user._id
    });
    req.app.get('io')?.to(`user:${user._id}`).emit('notification:new', { notification });
  }
}

export const emailSignupSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  username: Joi.string().lowercase().pattern(/^[a-z0-9_]{3,24}$/).required(),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(8).max(72).required(),
  age: Joi.number().integer().min(18).max(120).required(),
  gender: Joi.string().valid('male', 'female').required(),
  bio: Joi.string().max(160).allow('').optional()
});

export const emailLoginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(8).max(72).required()
});

export const guestUpgradeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(8).max(72).required(),
  age: Joi.number().integer().min(18).max(120).required(),
  gender: Joi.string().valid('male', 'female').required(),
  bio: Joi.string().max(160).allow('').optional()
});

export const guestSchema = Joi.object({
  age: Joi.number().integer().min(18).max(120).required(),
  gender: Joi.string().valid('male', 'female').required(),
  bio: Joi.string().max(160).allow('').optional()
});

export const requestOtp = asyncHandler(async (req, res) => {
  const { otp, delivery } = await issueOtp(req.body.phone);
  const exposeOtp = process.env.NODE_ENV !== 'production' || process.env.EXPOSE_OTP_IN_RESPONSE === 'true';
  res.json({
    ok: true,
    message: delivery.sent ? 'OTP sent' : 'OTP generated. SMS provider is not configured.',
    smsSent: delivery.sent,
    ...(exposeOtp ? { otp } : {})
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
        gender: req.body.gender,
        bio: req.body.bio || ''
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
  res.json({ token: signJwt(user), user });
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
    gender: req.body.gender,
    avatar: avatarForGender(req.body.gender, req.body.username),
    bio: req.body.bio || '',
    isGuest: false
  });

  res.status(201).json({ token: signJwt(user), user });
});

export const loginWithEmail = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash +lastIp +ipHistory');
  const passwordMatches = user ? await bcrypt.compare(req.body.password, user.passwordHash || '') : false;

  if (!passwordMatches) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  user.isGuest = false;
  await recordLogin(req, user);
  res.json({ token: signJwt(user), user });
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
      existingGuest.ipHistory = [...(existingGuest.ipHistory || []), { ip, at: new Date() }].slice(-8);
      await existingGuest.save();
      return res.json({ token: signJwt(existingGuest), user: existingGuest, reused: true });
    }
  }

  const identity = await guestIdentity(req.body.gender);
  const user = await User.create({
    ...identity,
    age: req.body.age,
    gender: req.body.gender,
    bio: req.body.bio || '',
    isGuest: true,
    lastIp: ip || undefined,
    lastSeenAt: new Date(),
    ipHistory: ip ? [{ ip, at: new Date() }] : []
  });

  res.status(201).json({ token: signJwt(user), user });
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
  req.user.age = req.body.age;
  req.user.gender = req.body.gender;
  req.user.avatar = req.user.avatar || avatarForGender(req.body.gender, req.user.username);
  req.user.bio = req.body.bio || req.user.bio || '';
  req.user.isGuest = false;
  await req.user.save();

  res.json({ token: signJwt(req.user), user: req.user });
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
  res.json({ token: signJwt(user), user });
});
