import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { trackUserActivity } from '../services/activity.service.js';
import { redis } from '../config/redis.js';

export async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) throw new Error('Missing token');
    let isBlacklisted = false;
    try {
      isBlacklisted = await redis.get(`jwt_blacklist:${token}`);
    } catch (err) {
      console.warn('Redis error during socket JWT blacklist check:', err.message);
    }
    if (isBlacklisted) throw new Error('Session expired');
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) throw new Error('Invalid user');
    if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) throw new Error('Account temporarily restricted');
    if (
      user.isGuest &&
      user.guestExpiresAt &&
      user.guestExpiresAt.getTime() < Date.now()
    ) {
      throw new Error('Guest session expired');
    }
    socket.user = user;
    trackUserActivity(user._id, socket);
    next();
  } catch (error) {
    next(error);
  }
}
