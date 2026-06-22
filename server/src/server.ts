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

// Allowed origins for Socket.IO CORS
const ALLOWED_ORIGINS = [
  'https://blippr.in',
  'https://www.blippr.in',
  // Railway dynamic domain
  ...(env.RAILWAY_PUBLIC_DOMAIN ? [`https://${env.RAILWAY_PUBLIC_DOMAIN}`] : []),
  // Explicit client URL override
  ...(env.CLIENT_URL ? [env.CLIENT_URL] : []),
];

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow any localhost origin in development
  if (env.NODE_ENV !== 'production') {
    try {
      const url = new URL(origin);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
    } catch { /* invalid URL */ }
  }
  return false;
}

const io = new Server(httpServer, {
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        console.warn(`[Socket.IO CORS] Blocked connection from origin: ${origin}`);
        callback(null, false);
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Ping/timeout for Railway proxy compatibility
  pingInterval: 25000,
  pingTimeout: 20000,
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
    connectRedis()
      .then(() => console.log('[Bootstrap] Redis connection established successfully'))
      .catch((redisErr) => console.error('[Bootstrap] WARNING: Redis client failed to connect in background.', redisErr));

    httpServer.listen(env.PORT, () => {
      console.log('==================================================');
      console.log(`\u{1F680} Varta Server running in ${env.NODE_ENV} mode`);
      console.log(`\u{1F50A} Listening on http://localhost:${env.PORT}`);
      if (env.RAILWAY_PUBLIC_DOMAIN) {
        console.log(`\u{1F310} Railway public URL: https://${env.RAILWAY_PUBLIC_DOMAIN}`);
      }
      console.log('==================================================');
    });
  } catch (err) {
    console.error('[Bootstrap] Critical startup failure:', err);
    process.exit(1);
  }
};

startServer();
