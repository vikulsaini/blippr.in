import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/error.js';
import configRouter from './routes/config.routes.js';
import authRouter from './routes/auth.routes.js';
import chatsRouter from './routes/chats.routes.js';
import friendsRouter from './routes/friends.routes.js';
import safetyRouter from './routes/safety.routes.js';
import usersRouter from './routes/users.routes.js';

const app = express();

// Secure server by setting various HTTP headers
app.use(helmet());

// Enable CORS with dynamic origin matching and credentials true for credentials 'include' requests
app.use(cors({
  origin: (origin, callback) => {
    // Echo back the requesting origin dynamically to satisfy credentials: 'include'
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Register global error handler
app.use(errorHandler);

export { app };

