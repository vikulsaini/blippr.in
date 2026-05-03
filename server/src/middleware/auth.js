import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { trackUserActivity } from '../services/activity.service.js';

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      const error = new Error('Authentication required');
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
    req.user = user;
    trackUserActivity(user._id, req);
    next();
  } catch (error) {
    error.status = error.status || 401;
    next(error);
  }
}
