import { MongoClient } from 'mongodb';

const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/blippr';

export const client = new MongoClient(mongoUri);

let dbInstance = null;

export async function connectMongo() {
  await client.connect();
  dbInstance = client.db();
  console.log('MongoDB native client connected successfully');
}

export const db = {
  collection(name) {
    if (!dbInstance) {
      throw new Error('Database not connected. Call connectMongo first.');
    }
    return dbInstance.collection(name);
  },
  
  command(cmd) {
    if (!dbInstance) {
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
