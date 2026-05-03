import { redis } from '../config/redis.js';

const keyFor = (phone) => `otp:${phone}`;

export async function issueOtp(phone) {
  const otp = process.env.NODE_ENV === 'production' ? String(Math.floor(100000 + Math.random() * 900000)) : '123456';
  await redis.set(keyFor(phone), otp, 'EX', Number(process.env.OTP_TTL_SECONDS || 300));
  console.log(`OTP issued for ${phone}${process.env.NODE_ENV === 'production' ? '' : `: ${otp}`}`);
  return otp;
}

export async function verifyOtp(phone, otp) {
  const stored = await redis.get(keyFor(phone));
  if (!stored || stored !== otp) return false;
  await redis.del(keyFor(phone));
  return true;
}
