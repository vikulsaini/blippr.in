import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  limit: Number(process.env.API_LIMIT_MAX || 60), // default 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many requests. Please slow down for a moment.' }
});

export const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_LIMIT_WINDOW_MS || 15 * 60 * 1000), // 15 minutes window
  limit: Number(process.env.AUTH_LIMIT_MAX || 5), // default 5 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: { ok: false, message: 'Too many login attempts. Please wait a few minutes and try again.' }
});

export const guestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.GUEST_LOGIN_LIMIT_PER_WINDOW || 12),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Guest login is busy from this network. Please wait a moment and try again.' }
});

export const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  limit: Number(process.env.UPLOAD_LIMIT_MAX || 5), // default 5 uploads per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many file uploads. Please wait a moment before trying again.' }
});
