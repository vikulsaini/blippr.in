import { redis } from '../config/redis.js';
import { sendVerificationEmail } from './email.service.js';

const ttlSeconds = () => Number(process.env.EMAIL_CODE_TTL_SECONDS || 600);
const cooldownSeconds = () => Number(process.env.EMAIL_CODE_COOLDOWN_SECONDS || 60);
const keyFor = (email) => `email_verify:${email}`;
const cooldownKeyFor = (email) => `email_verify_cooldown:${email}`;
const attemptsKeyFor = (email) => `email_verify_attempts:${email}`;

function createCode() {
  return process.env.NODE_ENV === 'production' ? String(Math.floor(100000 + Math.random() * 900000)) : '123456';
}

export function canExposeEmailCode() {
  return process.env.NODE_ENV !== 'production' || process.env.EXPOSE_EMAIL_CODE_IN_RESPONSE === 'true';
}

export async function issueEmailVerification(email) {
  const cooldown = await redis.get(cooldownKeyFor(email));
  if (cooldown) {
    const error = new Error('Please wait before requesting another verification email');
    error.status = 429;
    error.code = 'EMAIL_CODE_COOLDOWN';
    throw error;
  }

  const code = createCode();
  await redis
    .multi()
    .set(keyFor(email), code, 'EX', ttlSeconds())
    .set(cooldownKeyFor(email), '1', 'EX', cooldownSeconds())
    .del(attemptsKeyFor(email))
    .exec();

  const delivery = await sendVerificationEmail(email, code);
  console.log(`Email verification issued for ${email}${process.env.NODE_ENV === 'production' && delivery.sent ? '' : `: ${code}`}`);
  return { code, delivery };
}

export async function verifyEmailCode(email, code) {
  const attempts = Number((await redis.incr(attemptsKeyFor(email))) || 1);
  if (attempts === 1) await redis.expire(attemptsKeyFor(email), ttlSeconds());
  if (attempts > Number(process.env.EMAIL_CODE_MAX_ATTEMPTS || 6)) {
    const error = new Error('Too many incorrect verification attempts. Please request a new code.');
    error.status = 429;
    error.code = 'EMAIL_CODE_LOCKED';
    throw error;
  }

  const stored = await redis.get(keyFor(email));
  if (!stored || stored !== code) return false;
  await redis.del(keyFor(email), attemptsKeyFor(email), cooldownKeyFor(email));
  return true;
}
