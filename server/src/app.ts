import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/error.js';
import configRouter from './routes/config.routes.js';
import authRouter from './routes/auth.routes.js';
import chatsRouter from './routes/chats.routes.js';

const app = express();

// Secure server by setting various HTTP headers
app.use(helmet());

// Enable CORS with dynamic or wildcards depending on development/production
app.use(cors({
  origin: '*', // Allow all origins for the API or matchmaker connections, customize in production if needed
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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

// Register global error handler
app.use(errorHandler);

export { app };
