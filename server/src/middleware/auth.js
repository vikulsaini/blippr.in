import { supabase } from '../config/supabase.js';
import User from '../models/User.js';
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

    if (!supabase) {
      const error = new Error('Supabase integration is not configured on the server');
      error.status = 503;
      throw error;
    }

    // Verify token directly with Supabase
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !supabaseUser) {
      const error = new Error(authError?.message || 'Session expired or invalid token');
      error.status = 401;
      throw error;
    }

    // Fetch corresponding profile from database
    const user = await User.findById(supabaseUser.id);
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
    next();
  } catch (error) {
    error.status = error.status || 401;
    next(error);
  }
}
