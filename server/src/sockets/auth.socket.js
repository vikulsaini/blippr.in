import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { trackUserActivity } from '../services/activity.service.js';

export async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) throw new Error('Missing token');
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) throw new Error('Invalid user');
    if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) throw new Error('Account temporarily restricted');
    socket.user = user;
    trackUserActivity(user._id, socket);
    next();
  } catch (error) {
    next(error);
  }
}
