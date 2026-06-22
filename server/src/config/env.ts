import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const requiredEnv = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_JWT_SECRET',
  'REDIS_URL'
] as const;

const missing: string[] = [];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    missing.push(key);
  }
}

if (missing.length > 0) {
  throw new Error(`CRITICAL CONFIGURATION ERROR: Missing required environment variables: ${missing.join(', ')}`);
}

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  SUPABASE_URL: process.env.SUPABASE_URL as string,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY as string,
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET as string,
  REDIS_URL: process.env.REDIS_URL as string,
  NODE_ENV: process.env.NODE_ENV || 'development'
};
