import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { corsOptions } from './config/cors.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './middleware/error.js';
import { requestContext } from './middleware/requestContext.js';
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import userRoutes from './routes/user.routes.js';
import friendRoutes from './routes/friend.routes.js';
import safetyRoutes from './routes/safety.routes.js';
import mediaRoutes from './routes/media.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import callRoutes from './routes/call.routes.js';
import configRoutes from './routes/config.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { supabase, supabaseInitError } from './config/supabase.js';

const app = express();

app.set('trust proxy', true);
app.use(
  helmet({
    frameguard: { action: 'deny' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false
  })
);
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
app.use(compression());
app.use(cors(corsOptions));
app.use(requestContext);
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/api', apiLimiter);

app.get('/', (_req, res) => res.json({ ok: true, name: 'blippr', message: 'Blippr API is running' }));
app.get('/health', (_req, res) => {
  const url = (process.env.SUPABASE_URL || process.env.SUPABASE_URI || process.env.VITE_SUPABASE_URL || '').trim();
  const anon = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '').trim();
  
  res.json({
    ok: true,
    name: 'blippr',
    version: '1.0.6',
    supabaseConfigured: !!supabase,
    dbStatus: app.locals.dbStatus || { status: 'unknown' },
    diagnostics: {
      urlLength: url.length,
      urlPrefix: url.substring(0, 15),
      anonLength: anon.length,
      anonPrefix: anon.substring(0, 15),
      serviceLength: service.length,
      servicePrefix: service.substring(0, 15),
      initError: supabaseInitError
    }
  });
});
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/safety', safetyRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/config', configRoutes);
app.use('/api/admin', adminRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;

