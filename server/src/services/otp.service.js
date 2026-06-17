import { redis } from '../config/redis.js';
import { sendOtpSms } from './sms.service.js';

const keyFor = (phone) => `otp:${phone}`;
const cooldownKeyFor = (phone) => `otp_cooldown:${phone}`;
const attemptsKeyFor = (phone) => `otp_attempts:${phone}`;
const ttlSeconds = () => Number(process.env.OTP_TTL_SECONDS || 300);
const cooldownSeconds = () => Number(process.env.OTP_COOLDOWN_SECONDS || 60);

export function canExposeOtp() {
  return process.env.NODE_ENV !== 'production' || process.env.EXPOSE_OTP_IN_RESPONSE === 'true';
}

export async function issueOtp(phone) {
  const cooldown = await redis.get(cooldownKeyFor(phone));
  if (cooldown) {
    const error = new Error('Please wait before requesting another OTP');
    error.status = 429;
    error.code = 'OTP_COOLDOWN';
    throw error;
  }

  const otp = process.env.NODE_ENV === 'production' ? String(Math.floor(100000 + Math.random() * 900000)) : '123456';
  await redis
    .multi()
    .set(keyFor(phone), otp, 'EX', ttlSeconds())
    .set(cooldownKeyFor(phone), '1', 'EX', cooldownSeconds())
    .del(attemptsKeyFor(phone))
    .exec();
  const delivery = await sendOtpSms(phone, otp);
  const maskedPhone = phone.replace(/.(?=.{4})/g, '*');
  console.log(`OTP issued for ${maskedPhone}${process.env.NODE_ENV === 'production' && delivery.sent ? '' : `: ${otp}`}`);
  return { otp, delivery };
}

export async function verifyOtp(phone, otp) {
  const attempts = Number((await redis.incr(attemptsKeyFor(phone))) || 1);
  if (attempts === 1) await redis.expire(attemptsKeyFor(phone), ttlSeconds());
  if (attempts > Number(process.env.OTP_MAX_ATTEMPTS || 6)) {
    const error = new Error('Too many incorrect OTP attempts. Please request a new code.');
    error.status = 429;
    error.code = 'OTP_LOCKED';
    throw error;
  }

  const stored = await redis.get(keyFor(phone));
  if (!stored || stored !== otp) return false;
  await redis.del(keyFor(phone), attemptsKeyFor(phone), cooldownKeyFor(phone));
  return true;
}
