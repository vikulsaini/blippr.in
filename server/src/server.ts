import { createServer } from 'http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectRedis } from './config/redis.js';
import { socketAuthMiddleware } from './middleware/socketAuth.js';
import { registerCallHandlers } from './modules/call/call.handlers.js';
import { registerMatchmakerHandlers } from './modules/matchmaker/matchmaker.handlers.js';
import { registerChatHandlers } from './modules/chat/chat.handlers.js';

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Bind socket handshake auth middleware
io.use(socketAuthMiddleware);

// Share Socket.io instance with Express routers
app.set('io', io);

// Handle new client connections
io.on('connection', (socket) => {
  const userId = socket.data.userId;
  console.log(`[Socket] Client connected: socketId=${socket.id}, userId=${userId}`);

  // Register domain handlers
  registerCallHandlers(io, socket);
  registerMatchmakerHandlers(io, socket);
  registerChatHandlers(io, socket);

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Client disconnected: socketId=${socket.id}, userId=${userId}, reason=${reason}`);
  });
});

const startServer = async (): Promise<void> => {
  try {
    // Connect to Redis asynchronously in the background so it doesn't block server startup
    connectRedis()
      .then(() => console.log('[Bootstrap] Redis connection established successfully'))
      .catch((redisErr) => console.error('[Bootstrap] WARNING: Redis client failed to connect in background.', redisErr));

    // Start listening
    httpServer.listen(env.PORT, () => {
      console.log('==================================================');
      console.log(`🚀 Varta Server running in ${env.NODE_ENV} mode`);
      console.log(`🔊 Listening on http://localhost:${env.PORT}`);
      console.log('==================================================');
    });
  } catch (err) {
    console.error('[Bootstrap] Critical startup failure:', err);
    process.exit(1);
  }
};

startServer();
