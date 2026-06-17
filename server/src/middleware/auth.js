import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { trackUserActivity } from '../services/activity.service.js';
import { readAuthCookie } from '../utils/authCookie.js';
import { redis } from '../config/redis.js';

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : readAuthCookie(req);
    if (!token) {
      const error = new Error('Authentication required');
      error.status = 401;
      throw error;
    }
    let isBlacklisted = false;
    try {
      isBlacklisted = await redis.get(`jwt_blacklist:${token}`);
    } catch (err) {
      console.warn('Redis error during JWT blacklist check:', err.message);
    }
    if (isBlacklisted) {
      const error = new Error('Session has expired. Please log in again.');
      error.status = 401;
      throw error;
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) {
      const error = new Error('User not found');
      error.status = 401;
      throw error;
    }
    if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) {
      const error = new Error('Account temporarily restricted for safety violations.');
      error.status = 403;
      error.code = 'ACCOUNT_RESTRICTED';
      throw error;
    }
    if (
      user.isGuest &&
      user.guestExpiresAt &&
      user.guestExpiresAt.getTime() < Date.now() &&
      req.originalUrl !== '/api/auth/guest/upgrade' &&
      req.originalUrl !== '/api/users/me'
    ) {
      const error = new Error('Guest session expired. Create an account to continue.');
      error.status = 403;
      error.code = 'GUEST_EXPIRED';
      throw error;
    }
    req.user = user;
    trackUserActivity(user._id, req);
    next();
  } catch (error) {
    error.status = error.status || 401;
    next(error);
  }
}
