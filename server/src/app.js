import compression from 'compression';
import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import morgan from 'morgan';
import { corsOptions } from './config/cors.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './middleware/error.js';
import { requestContext } from './middleware/requestContext.js';
import authRoutes from './routes/auth.routes.js';
import { supabase } from './config/supabase.js';

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
app.use(mongoSanitize());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/api', apiLimiter);

app.get('/', (_req, res) => res.json({ ok: true, name: 'blippr', message: 'Blippr API is running' }));
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    name: 'blippr',
    version: '1.0.6',
    supabaseConfigured: !!supabase,
    dbStatus: app.locals.dbStatus || { status: 'unknown' }
  });
});
app.use('/api/auth', authRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;

