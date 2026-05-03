import http from 'node:http';
import './config/env.js';
import { Server } from 'socket.io';
import app from './app.js';
import { socketCorsOptions } from './config/cors.js';
import { connectMongo } from './config/db.js';
import { connectRedis } from './config/redis.js';
import { registerSockets } from './sockets/index.js';

const port = process.env.PORT || 8080;
const server = http.createServer(app);
const io = new Server(server, {
  cors: socketCorsOptions
});

app.set('io', io);
registerSockets(io);

async function boot() {
  console.log('Starting Varta API');
  console.log(`Environment check: MONGO_URI=${process.env.MONGO_URI ? 'set' : 'missing'}, REDIS_URL=${process.env.REDIS_URL ? 'set' : 'missing'}`);
  await connectMongo();
  await connectRedis();
  server.listen(port, () => {
    console.log(`Varta API listening on ${port}`);
  });
}

boot().catch((error) => {
  console.error('Failed to start Varta', error);
  process.exit(1);
});
