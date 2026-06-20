import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

let clientInstance = null;

if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'undefined' && supabaseUrl !== 'null' && supabaseAnonKey !== 'undefined' && supabaseAnonKey !== 'null') {
  try {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error.message);
  }
}

export const supabase = clientInstance;
