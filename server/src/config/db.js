import mongoose from 'mongoose';

export async function connectMongo() {
  mongoose.set('strictQuery', true);
  const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGODB_URL;
  if (!mongoUri) {
    throw new Error('Database connection string is missing in environment variables (tried MONGO_URI, MONGO_URL, MONGODB_URI, MONGODB_URL).');
  }
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
}
