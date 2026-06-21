import jwt from 'jsonwebtoken';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { redis } from '../config/redis.js';
import User from '../models/User.js';
import { mapUserFromPostgres } from '../utils/userMapper.js';
import { trackUserActivity } from '../services/activity.service.js';
import { readAuthCookie } from '../utils/authCookie.js';

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : readAuthCookie(req);
    if (!token) {
      const error = new Error('Authentication required');
      error.status = 401;
      throw error;
    }

    // Check Redis blacklist
    try {
      const isBlacklisted = await redis.get(`jwt_blacklist:${token}`);
      if (isBlacklisted) {
        const error = new Error('Session expired or invalid token');
        error.status = 401;
        throw error;
      }
    } catch (redisErr) {
      console.warn('Redis blacklist check error:', redisErr.message);
    }

    // 1. Try local JWT verification first (for guest and email users)
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload && payload.sub) {
        const user = await User.findById(payload.sub);
        if (!user) {
          const error = new Error('Profile not found');
          error.status = 401;
          throw error;
        }

        if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) {
          const error = new Error('Account temporarily restricted for safety violations.');
          error.status = 403;
          error.code = 'ACCOUNT_RESTRICTED';
          throw error;
        }

        req.user = user;
        trackUserActivity(user.id, req);
        return next();
      }
    } catch (jwtError) {
      // Fall back to Supabase verification
    }

    // 2. Fall back to Supabase Auth verification
    if (!supabase) {
      const error = new Error('Supabase integration is not configured on the server');
      error.status = 503;
      throw error;
    }

    const { data, error: authError } = await supabase.auth.getUser(token);
    const supabaseUser = data?.user;
    
    if (authError || !supabaseUser) {
      const error = new Error(authError?.message || 'Session expired or invalid token');
      error.status = 401;
      throw error;
    }

    // Fetch corresponding profile from database directly
    const { data: userProfile, error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', supabaseUser.id)
      .maybeSingle();

    if (dbError || !userProfile) {
      const error = new Error('Profile not found');
      error.status = 401;
      throw error;
    }

    const user = mapUserFromPostgres(userProfile);

    if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) {
      const error = new Error('Account temporarily restricted for safety violations.');
      error.status = 403;
      error.code = 'ACCOUNT_RESTRICTED';
      throw error;
    }

    req.user = user;
    trackUserActivity(user.id, req);
    next();
  } catch (error) {
    error.status = error.status || 401;
    next(error);
  }
}
