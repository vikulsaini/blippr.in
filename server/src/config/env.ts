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

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || '';
if (!mongoUri) {
  missing.push('MONGO_URI or MONGODB_URI');
}

const rawJwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
const supabaseJwtSecret = rawJwtSecret ? rawJwtSecret.trim().replace(/\s+/g, '') : '';
if (!supabaseJwtSecret) {
  missing.push('SUPABASE_JWT_SECRET or JWT_SECRET');
}

if (missing.length > 0) {
  throw new Error(`CRITICAL CONFIGURATION ERROR: Missing required environment variables: ${missing.join(', ')}`);
}

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  SUPABASE_URL: process.env.SUPABASE_URL as string,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY as string,
  SUPABASE_JWT_SECRET: supabaseJwtSecret as string,
  REDIS_URL: process.env.REDIS_URL as string,
  MONGO_URI: mongoUri,
  NODE_ENV: process.env.NODE_ENV || 'development',
  RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN || '',
  RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL || '',
  CLIENT_URL: process.env.CLIENT_URL || '',
  CORS_ORIGINS: process.env.CORS_ORIGINS || '', // Comma-separated list of allowed origins
  TURN_URLS: process.env.TURN_URLS || '', // Comma-separated TURN server URLs
  TURN_USERNAME: process.env.TURN_USERNAME || '',
  TURN_PASSWORD: process.env.TURN_PASSWORD || '',
  TURN_CREDENTIAL: process.env.TURN_CREDENTIAL || '',
};
