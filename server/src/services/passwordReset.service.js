import { redis } from '../config/redis.js';
import { sendPasswordResetEmail } from './email.service.js';

const ttlSeconds = () => Number(process.env.PASSWORD_RESET_TTL_SECONDS || 600);
const cooldownSeconds = () => Number(process.env.PASSWORD_RESET_COOLDOWN_SECONDS || 60);
const keyFor = (email) => `password_reset:${email}`;
const cooldownKeyFor = (email) => `password_reset_cooldown:${email}`;
const attemptsKeyFor = (email) => `password_reset_attempts:${email}`;
const memoryStore = new Map();

function redisConfigured() {
  return Boolean(process.env.REDIS_URL);
}

function memoryGet(key) {
  const item = memoryStore.get(key);
  if (!item) return null;
  if (item.expiresAt && item.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return item.value;
}

function memorySet(key, value, seconds) {
  memoryStore.set(key, {
    value,
    expiresAt: seconds ? Date.now() + seconds * 1000 : null
  });
}

function memoryDel(...keys) {
  keys.forEach((key) => memoryStore.delete(key));
}

function memoryIncr(key) {
  const next = Number(memoryGet(key) || 0) + 1;
  memorySet(key, String(next), ttlSeconds());
  return next;
}

function createCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function issuePasswordReset(email) {
  const cooldown = redisConfigured() ? await redis.get(cooldownKeyFor(email)) : memoryGet(cooldownKeyFor(email));
  if (cooldown) {
    const error = new Error('Please wait before requesting another password reset code');
    error.status = 429;
    error.code = 'PASSWORD_RESET_COOLDOWN';
    throw error;
  }

  const code = createCode();
  if (redisConfigured()) {
    await redis
      .multi()
      .set(keyFor(email), code, 'EX', ttlSeconds())
      .set(cooldownKeyFor(email), '1', 'EX', cooldownSeconds())
      .del(attemptsKeyFor(email))
      .exec();
  } else {
    memorySet(keyFor(email), code, ttlSeconds());
    memorySet(cooldownKeyFor(email), '1', cooldownSeconds());
    memoryDel(attemptsKeyFor(email));
  }

  const delivery = await sendPasswordResetEmail(email, code);
  const maskEmail = (str) => {
    const parts = str.split('@');
    if (parts.length < 2) return '***';
    const name = parts[0];
    const domain = parts[1];
    const maskedName = name.length > 2 ? name[0] + '*'.repeat(name.length - 2) + name[name.length - 1] : '*'.repeat(name.length);
    return `${maskedName}@${domain}`;
  };
  console.log(`Password reset code issued for ${maskEmail(email)}: ${code}`);
  return { code, delivery };
}

export async function validatePasswordReset(email, code) {
  const attempts = redisConfigured() ? Number((await redis.incr(attemptsKeyFor(email))) || 1) : memoryIncr(attemptsKeyFor(email));
  if (redisConfigured() && attempts === 1) await redis.expire(attemptsKeyFor(email), ttlSeconds());
  if (attempts > Number(process.env.PASSWORD_RESET_MAX_ATTEMPTS || 6)) {
    const error = new Error('Too many incorrect verification attempts. Please request a new code.');
    error.status = 429;
    error.code = 'PASSWORD_RESET_LOCKED';
    throw error;
  }

  const stored = redisConfigured() ? await redis.get(keyFor(email)) : memoryGet(keyFor(email));
  if (!stored || stored !== code) return false;
  
  if (redisConfigured()) {
    await redis.del(keyFor(email), attemptsKeyFor(email), cooldownKeyFor(email));
  } else {
    memoryDel(keyFor(email), attemptsKeyFor(email), cooldownKeyFor(email));
  }
  
  return true;
}
