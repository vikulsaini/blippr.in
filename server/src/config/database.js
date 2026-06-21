import { supabaseAdmin } from './supabase.js';

/**
 * Database client wrapper.
 * Uses the Supabase client SDK (PostgREST) to connect directly to PostgreSQL.
 * Leverages native SQL joins, array operators, and JSONB mapping via the client.
 */
export const db = supabaseAdmin;

export async function testConnection() {
  if (!db) {
    throw new Error('Supabase client is not initialized. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  }

  // Test connection to Supabase database by checking profiles
  const { error } = await db
    .from('profiles')
    .select('id')
    .limit(1);

  if (error) {
    throw new Error(`Supabase DB connection failed: ${error.message}`);
  }

  console.log('Supabase Database (PostgreSQL) connection verified successfully');
}
