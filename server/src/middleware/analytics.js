import { recordAnalyticsMetric } from '../services/analytics.service.js';
import { getClientIp } from '../utils/clientIp.js';

export function analyticsMiddleware(req, res, next) {
  // Only monitor API routes to keep things lightweight
  if (!req.originalUrl.startsWith('/api')) {
    return next();
  }

  const startTime = Date.now();

  res.on('finish', () => {
    try {
      const duration = Date.now() - startTime;
      const status = res.statusCode;
      const path = req.baseUrl + req.path;
      const method = req.method;
      const ip = getClientIp(req) || req.ip || '127.0.0.1';
      const io = req.app.get('io');

      // Record performance metric asynchronously
      recordAnalyticsMetric({ method, path, status, duration, ip, io });
    } catch (err) {
      console.warn('Analytics middleware capture error:', err.message);
    }
  });

  next();
}
