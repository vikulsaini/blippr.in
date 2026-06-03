import { redis } from '../config/redis.js';
import { sendVerificationEmail } from './email.service.js';

const ttlSeconds = () => Number(process.env.EMAIL_CODE_TTL_SECONDS || 600);
const cooldownSeconds = () => Number(process.env.EMAIL_CODE_COOLDOWN_SECONDS || 60);
const keyFor = (email) => `email_verify:${email}`;
const cooldownKeyFor = (email) => `email_verify_cooldown:${email}`;
const attemptsKeyFor = (email) => `email_verify_attempts:${email}`;
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
  return process.env.NODE_ENV === 'production' ? String(Math.floor(100000 + Math.random() * 900000)) : '123456';
}

export function canExposeEmailCode() {
  return process.env.NODE_ENV !== 'production' || process.env.EXPOSE_EMAIL_CODE_IN_RESPONSE === 'true';
}

export async function issueEmailVerification(email) {
  const cooldown = redisConfigured() ? await redis.get(cooldownKeyFor(email)) : memoryGet(cooldownKeyFor(email));
  if (cooldown) {
    const error = new Error('Please wait before requesting another verification email');
    error.status = 429;
    error.code = 'EMAIL_CODE_COOLDOWN';
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

  const delivery = await sendVerificationEmail(email, code);
  console.log(`Email verification issued for ${email}${process.env.NODE_ENV === 'production' && delivery.sent ? '' : `: ${code}`}`);
  return { code, delivery };
}

export async function verifyEmailCode(email, code) {
  const attempts = redisConfigured() ? Number((await redis.incr(attemptsKeyFor(email))) || 1) : memoryIncr(attemptsKeyFor(email));
  if (redisConfigured() && attempts === 1) await redis.expire(attemptsKeyFor(email), ttlSeconds());
  if (attempts > Number(process.env.EMAIL_CODE_MAX_ATTEMPTS || 6)) {
    const error = new Error('Too many incorrect verification attempts. Please request a new code.');
    error.status = 429;
    error.code = 'EMAIL_CODE_LOCKED';
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
