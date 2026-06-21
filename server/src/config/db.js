import { connectMongo as connectNativeMongo } from './database.js';

export async function connectMongo() {
  await connectNativeMongo();
}
