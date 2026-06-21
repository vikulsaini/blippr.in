// Re-initialized Supabase Client Service Configuration (Trigger Vercel Redeploy)
import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const supabaseUrl = (rawUrl && rawUrl !== 'undefined' && rawUrl !== 'null')
  ? rawUrl
  : 'https://ekkpkjgquiarufexfoiy.supabase.co';

const supabaseAnonKey = (rawKey && rawKey !== 'undefined' && rawKey !== 'null')
  ? rawKey
  : 'sb_publishable_sdwPq0LDCBwwtv446BbVpA_iEmXMDEC';

let clientInstance = null;

if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'undefined' && supabaseUrl !== 'null' && supabaseAnonKey !== 'undefined' && supabaseAnonKey !== 'null') {
  try {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error.message);
  }
}

export const supabase = clientInstance;
