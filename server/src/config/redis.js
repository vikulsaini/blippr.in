import Redis from 'ioredis';

function normalizeRedisUrl(value = '') {
  let url = value.trim();

  url = url.replace(/^redis-cli\s+/i, '').replace(/^--tls\s+-u\s+/i, '');

  if (url.includes('upstash.io') && url.startsWith('redis://')) {
    url = url.replace(/^redis:\/\//, 'rediss://');
  }

  return url;
}

const redisUrl = normalizeRedisUrl(process.env.REDIS_URL);
const useTls = redisUrl.startsWith('rediss://');

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  tls: useTls ? {} : undefined
});

redis.on('error', (error) => {
  console.warn(`Redis connection warning: ${error.message}`);
});
