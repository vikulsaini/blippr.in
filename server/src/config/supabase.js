import { createClient } from '@supabase/supabase-js';

const rawUrl = (process.env.SUPABASE_URL || process.env.SUPABASE_URI || process.env.VITE_SUPABASE_URL)?.trim();
const rawAnonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)?.trim();
const rawServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY)?.trim();

const supabaseUrl = (rawUrl && rawUrl !== 'undefined' && rawUrl !== 'null') ? rawUrl : null;
const supabaseAnonKey = (rawAnonKey && rawAnonKey !== 'undefined' && rawAnonKey !== 'null') ? rawAnonKey : null;
const supabaseServiceRoleKey = (rawServiceKey && rawServiceKey !== 'undefined' && rawServiceKey !== 'null') ? rawServiceKey : null;

let clientInstance = null;
let adminClientInstance = null;

if (supabaseUrl) {
  if (supabaseAnonKey) {
    try {
      clientInstance = createClient(supabaseUrl, supabaseAnonKey);
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error.message);
    }
  }

  const adminKey = supabaseServiceRoleKey || supabaseAnonKey;
  if (adminKey) {
    try {
      adminClientInstance = createClient(supabaseUrl, adminKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    } catch (error) {
      console.error('Failed to initialize Supabase admin client:', error.message);
    }
  }
}

console.log(`[Supabase Config Init] Raw URL length: ${rawUrl ? rawUrl.length : 0}, Raw AnonKey length: ${rawAnonKey ? rawAnonKey.length : 0}`);
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(`⚠️ WARNING: Supabase URL or Anon Key is missing or invalid in environment variables. URL=${supabaseUrl ? 'present' : 'missing'}, AnonKey=${supabaseAnonKey ? 'present' : 'missing'}. Supabase integration is disabled.`);
} else {
  console.log(`✅ Supabase integration successfully initialized. URL=${supabaseUrl.substring(0, 15)}...`);
}

export const supabase = clientInstance;
export const supabaseAdmin = adminClientInstance || clientInstance;

