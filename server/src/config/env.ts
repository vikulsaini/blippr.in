import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const requiredEnv = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'REDIS_URL'
] as const;

const missing: string[] = [];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    missing.push(key);
  }
}

const rawJwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
const supabaseJwtSecret = rawJwtSecret ? rawJwtSecret.trim().replace(/\s+/g, '') : '';
if (!supabaseJwtSecret) {
  missing.push('SUPABASE_JWT_SECRET or JWT_SECRET');
}

if (missing.length > 0) {
  throw new Error(`CRITICAL CONFIGURATION ERROR: Missing required environment variables: ${missing.join(', ')}`);
}

// Resolve service role key with production safety guard
const resolveServiceRoleKey = (): string => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (key) return key;
  if (process.env.NODE_ENV === 'production') {
    console.warn('[SECURITY] SUPABASE_SERVICE_ROLE_KEY is not set in production! Server-side DB queries may fail due to RLS.');
  }
  // Fallback to anon key for local development only
  return process.env.SUPABASE_ANON_KEY as string;
};

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  SUPABASE_URL: process.env.SUPABASE_URL as string,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY as string,
  SUPABASE_SERVICE_ROLE_KEY: resolveServiceRoleKey(),
  SUPABASE_JWT_SECRET: supabaseJwtSecret as string,
  REDIS_URL: process.env.REDIS_URL as string,
  NODE_ENV: process.env.NODE_ENV || 'development',
  RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN || '',
  CLIENT_URL: process.env.CLIENT_URL || '',
};
