import Redis from 'ioredis';

function normalizeRedisUrl(value = '') {
  let url = value.trim();

  url = url.replace(/^redis-cli\s+/i, '').replace(/^--tls\s+-u\s+/i, '');

  if (url.includes('upstash.io') && url.startsWith('redis://')) {
    url = url.replace(/^redis:\/\//, 'rediss://');
  }

  return url;
}

const redisUrl = normalizeRedisUrl(process.env.REDIS_URL || process.env.REDIS_URI || process.env.REDIS_URL_PRIVATE || '');
const useTls = redisUrl.startsWith('rediss://');

export const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  tls: useTls ? { rejectUnauthorized: false } : undefined
});

redis.on('error', (error) => {
  console.warn(`Redis connection warning: ${error.message}`);
});

export async function connectRedis() {
  if (!redisUrl) throw new Error('Redis connection URL is missing in environment variables (tried REDIS_URL, REDIS_URI, REDIS_URL_PRIVATE).');
  if (redis.status === 'wait' || redis.status === 'close' || redis.status === 'end') {
    await redis.connect();
  }
  await redis.ping();
  console.log('Redis connected');
}

