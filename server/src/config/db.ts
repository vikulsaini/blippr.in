import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

// Parse the connection string and configure the pool.
// On Railway, DATABASE_URL is provided dynamically.
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

export const query = async (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export const initDb = async (): Promise<void> => {
  console.log('[PostgreSQL] Checking and initializing database tables...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create profiles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) UNIQUE,
        name VARCHAR(255),
        avatar_url TEXT,
        bio TEXT,
        age INTEGER,
        dob DATE,
        gender VARCHAR(50),
        contact VARCHAR(100),
        hobbies TEXT,
        location JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Create rooms table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(255) PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Create room_members table
    await client.query(`
      CREATE TABLE IF NOT EXISTS room_members (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(255) REFERENCES rooms(id) ON DELETE CASCADE,
        user_id VARCHAR(255),
        joined_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 4. Create messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(255) PRIMARY KEY,
        room_id VARCHAR(255) REFERENCES rooms(id) ON DELETE CASCADE,
        sender_id VARCHAR(255),
        content TEXT,
        media_url TEXT,
        media_type VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 5. Create friend_requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS friend_requests (
        id SERIAL PRIMARY KEY,
        sender_id VARCHAR(255) REFERENCES profiles(id) ON DELETE CASCADE,
        receiver_id VARCHAR(255) REFERENCES profiles(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(sender_id, receiver_id)
      );
    `);

    // 6. Create blocks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS blocks (
        id SERIAL PRIMARY KEY,
        blocker_id VARCHAR(255) REFERENCES profiles(id) ON DELETE CASCADE,
        blocked_id VARCHAR(255) REFERENCES profiles(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(blocker_id, blocked_id)
      );
    `);

    // 7. Create reports table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        reporter_id VARCHAR(255) REFERENCES profiles(id) ON DELETE CASCADE,
        reported_id VARCHAR(255) REFERENCES profiles(id) ON DELETE CASCADE,
        reason TEXT,
        notes TEXT,
        room_id VARCHAR(255) REFERENCES rooms(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('[PostgreSQL] Database tables initialized successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PostgreSQL] Database initialization failed:', err);
    throw err;
  } finally {
    client.release();
  }
};
