import { supabase, supabaseAdmin } from '../config/supabase.js';
import { mapUserFromPostgres } from '../utils/userMapper.js';
import { trackUserActivity } from '../services/activity.service.js';

export async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) throw new Error('Missing token');

    if (!supabase) throw new Error('Supabase integration is not configured');

    const { data, error: authError } = await supabase.auth.getUser(token);
    const supabaseUser = data?.user;
    if (authError || !supabaseUser) throw new Error('Session expired or invalid token');

    const { data: userProfile, error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', supabaseUser.id)
      .maybeSingle();

    if (dbError || !userProfile) throw new Error('Invalid user');
    
    const user = mapUserFromPostgres(userProfile);
    if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) throw new Error('Account temporarily restricted');

    socket.user = user;
    trackUserActivity(user.id, socket);
    next();
  } catch (error) {
    next(error);
  }
}
