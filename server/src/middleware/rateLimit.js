import { redis } from '../config/redis.js';

/**
 * Custom Redis-backed Rate Limiter Middleware.
 * Provides distributed rate limiting using Redis INCR and EXPIRE commands.
 * Automatically falls back to allowing requests if Redis is unavailable.
 */
function createRedisRateLimiter({ keyPrefix, windowMs, limit, message }) {
  return async (req, res, next) => {
    // If Redis is not initialized or not ready, fallback to in-memory/bypass
    if (!redis || redis.status !== 'ready') {
      return next();
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const redisKey = `ratelimit:${keyPrefix}:${ip}`;

    try {
      const requests = await redis.incr(redisKey);
      
      if (requests === 1) {
        // Set expiry on key creation (windowMs converted to seconds)
        await redis.expire(redisKey, Math.ceil(windowMs / 1000));
      }

      const ttl = await redis.ttl(redisKey);
      const resetTime = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);

      res.setHeader('RateLimit-Limit', limit);
      res.setHeader('RateLimit-Remaining', Math.max(0, limit - requests));
      res.setHeader('RateLimit-Reset', Math.ceil(resetTime / 1000));

      if (requests > limit) {
        return res.status(429).json({
          ok: false,
          message: message || 'Too many requests. Please slow down.'
        });
      }

      next();
    } catch (err) {
      console.warn(`Rate limiter Redis error for prefix "${keyPrefix}": ${err.message}`);
      next(); // Fail open: allow traffic if Redis fails
    }
  };
}

export const apiLimiter = createRedisRateLimiter({
  keyPrefix: 'api',
  windowMs: 1 * 60 * 1000, // 1 minute window
  limit: Number(process.env.API_LIMIT_MAX || 300), // default 300 requests per minute
  message: 'Too many requests. Please slow down for a moment.'
});

export const authLimiter = createRedisRateLimiter({
  keyPrefix: 'auth',
  windowMs: Number(process.env.AUTH_LIMIT_WINDOW_MS || 15 * 60 * 1000), // 15 minutes window
  limit: Number(process.env.AUTH_LIMIT_MAX || 1000), // default 1000 requests per 15 minutes
  message: 'Too many login attempts. Please wait a few minutes and try again.'
});

export const guestLimiter = createRedisRateLimiter({
  keyPrefix: 'guest',
  windowMs: 10 * 60 * 1000, // 10 minutes window
  limit: Number(process.env.GUEST_LOGIN_LIMIT_PER_WINDOW || 60),
  message: 'Guest login is busy from this network. Please wait a moment and try again.'
});

export const uploadLimiter = createRedisRateLimiter({
  keyPrefix: 'upload',
  windowMs: 1 * 60 * 1000, // 1 minute window
  limit: Number(process.env.UPLOAD_LIMIT_MAX || 5), // default 5 uploads per minute
  message: 'Too many file uploads. Please wait a moment before trying again.'
});
