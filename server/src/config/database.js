import { MongoClient } from 'mongodb';

console.log('[Database] database.js module evaluated. Process ID:', process.pid);

const mongoUri = process.env.MONGO_URL || process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/blippr';

export const client = new MongoClient(mongoUri);

let dbInstance = null;

export async function connectMongo() {
  console.log('[Database] connectMongo() called. dbInstance is currently:', dbInstance ? 'set' : 'null');
  await client.connect();
  
  let dbName = 'blippr';
  try {
    const url = new URL(mongoUri.replace('mongodb+srv://', 'http://').replace('mongodb://', 'http://'));
    const path = url.pathname.replace(/^\//, '');
    if (path) {
      dbName = path.split('?')[0];
    }
  } catch (e) {
    // ignore
  }
  
  dbInstance = client.db(dbName);
  console.log(`[Database] MongoDB native client connected successfully. dbInstance set to database: ${dbName}`);
}

export const db = {
  collection(name) {
    if (!dbInstance) {
      console.error('[Database Error] collection() called but dbInstance is null!');
      throw new Error('Database not connected. Call connectMongo first.');
    }
    return dbInstance.collection(name);
  },
  
  command(cmd) {
    if (!dbInstance) {
      console.error('[Database Error] command() called but dbInstance is null!');
      throw new Error('Database not connected. Call connectMongo first.');
    }
    return dbInstance.command(cmd);
  }
};

export async function testConnection() {
  try {
    if (!dbInstance) {
      await connectMongo();
    }
    await dbInstance.command({ ping: 1 });
    console.log('MongoDB (native client) connection verified successfully');
  } catch (err) {
    throw new Error(`MongoDB connection verification failed: ${err.message}`);
  }
}
