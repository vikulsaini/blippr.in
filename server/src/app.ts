import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import configRouter from './routes/config.routes.js';
import authRouter from './routes/auth.routes.js';
import chatsRouter from './routes/chats.routes.js';
import friendsRouter from './routes/friends.routes.js';
import safetyRouter from './routes/safety.routes.js';
import usersRouter from './routes/users.routes.js';
import notificationsRouter from './routes/notifications.routes.js';

const app = express();

// Allowed origins for CORS — from env var or default to production domains
const ALLOWED_ORIGINS: string[] = env.CORS_ORIGINS
  ? env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : ['https://blippr.in', 'https://www.blippr.in'];

// Secure server by setting various HTTP headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Allow geolocation for frontend domains (Discover page uses location features)
app.use((req, res, next) => {
  const allowed = ["'self'", ...ALLOWED_ORIGINS.map(o => `"${o}"`)].join(' ');
  res.setHeader('Permissions-Policy', `geolocation=(${allowed})`);
  next();
});

// Enable CORS with strict origin matching and credentials true for credentials 'include' requests
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Allow all localhost origins in development (any port)
    try {
      const url = new URL(origin);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        callback(null, true);
        return;
      }
    } catch {
      // invalid URL
    }

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Parse JSON and URL-encoded bodies with reasonable size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Liveness check end point
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Connectivity Config routes
app.use('/api/config', configRouter);

// Authentication routes
app.use('/api/auth', authRouter);

// Chats routes
app.use('/api/chats', chatsRouter);

// Friends routes
app.use('/api/friends', friendsRouter);

// Safety routes
app.use('/api/safety', safetyRouter);

// Users routes
app.use('/api/users', usersRouter);

// Notifications routes
app.use('/api/notifications', notificationsRouter);

// Register global error handler
app.use(errorHandler);

export { app };
