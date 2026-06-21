import Redis from 'ioredis';

function normalizeRedisUrl(value = '') {
  let url = value.trim();

  url = url.replace(/^redis-cli\s+/i, '').replace(/^--tls\s+-u\s+/i, '');

  if (url.includes('upstash.io') && url.startsWith('redis://')) {
    url = url.replace(/^redis:\/\//, 'rediss://');
  }

  return url;
}

function getRedisUrl() {
  if (process.env.REDISHOST) {
    const host = process.env.REDISHOST;
    const port = process.env.REDISPORT || 6379;
    const password = process.env.REDISPASSWORD ? `:${process.env.REDISPASSWORD}` : '';
    const user = process.env.REDISUSER ? `${process.env.REDISUSER}` : '';
    const auth = (user || password) ? `${user}${password}@` : '';
    return `redis://${auth}${host}:${port}`;
  }
  return normalizeRedisUrl(process.env.REDIS_URL || process.env.REDIS_URI || process.env.REDIS_URL_PRIVATE || '');
}

const redisUrl = getRedisUrl();
const useTls = redisUrl.startsWith('rediss://');

export const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  tls: useTls ? { rejectUnauthorized: false } : undefined,
  retryStrategy(times) {
    if (times > 3) {
      return null; // Stop trying to reconnect after 3 failures to let memory fallback take over
    }
    return Math.min(times * 100, 2000);
  }
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

