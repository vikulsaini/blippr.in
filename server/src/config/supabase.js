import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

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

export const supabase = clientInstance;
export const supabaseAdmin = adminClientInstance || clientInstance;

