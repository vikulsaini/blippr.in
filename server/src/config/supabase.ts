import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Server-side Supabase client is used strictly for user authentication
// and validating JWT tokens in middleware.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

console.log('[Supabase] Client initialized for authentication');
