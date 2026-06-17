import mongoose from 'mongoose';

export async function connectMongo() {
  mongoose.set('strictQuery', true);
  const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL;
  if (!mongoUri) {
    throw new Error('Neither MONGO_URI nor MONGO_URL environment variable is defined.');
  }
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
}
