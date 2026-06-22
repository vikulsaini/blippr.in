import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Server-side Supabase client uses the service role key to bypass RLS.
// This is required because the server performs database operations on behalf
// of authenticated users, and RLS policies would otherwise block queries.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

console.log('[Supabase] Client initialized (using service role key for RLS bypass)');
