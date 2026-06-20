import { supabase } from '../config/supabase.js';
import User from '../models/User.js';
import { trackUserActivity } from '../services/activity.service.js';

export async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) throw new Error('Missing token');

    if (!supabase) throw new Error('Supabase integration is not configured');

    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !supabaseUser) throw new Error('Session expired or invalid token');

    const user = await User.findById(supabaseUser.id);
    if (!user) throw new Error('Invalid user');
    if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) throw new Error('Account temporarily restricted');

    socket.user = user;
    trackUserActivity(user.id, socket);
    next();
  } catch (error) {
    next(error);
  }
}
