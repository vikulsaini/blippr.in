import { supabaseAdmin } from './supabase.js';

export async function connectMongo() {
  if (!supabaseAdmin) {
    throw new Error('Supabase client is not initialized. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  }

  // Test connection to Supabase database by checking profiles
  const { error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .limit(1);

  if (error) {
    throw new Error(`Supabase DB connection failed: ${error.message}`);
  }

  console.log('Supabase Database (PostgreSQL) connected');
}
