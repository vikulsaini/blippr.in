import { testConnection } from './database.js';

export async function connectMongo() {
  await testConnection();
}

