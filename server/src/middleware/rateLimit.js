import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many requests. Please slow down for a moment.' }
});

export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { ok: false, message: 'Too many login attempts. Please wait a few minutes and try again.' }
});

export const guestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.GUEST_LOGIN_LIMIT_PER_WINDOW || 12),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Guest login is busy from this network. Please wait a moment and try again.' }
});
