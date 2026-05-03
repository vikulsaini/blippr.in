import { nanoid } from 'nanoid';
import Chat from '../models/Chat.js';
import { redis } from '../config/redis.js';

const queueKey = (interest) => `matchmaking:${interest || 'global'}`;
const queueIndexKey = 'matchmaking:keys';

export async function findOrQueueUser(user, interests = []) {
  const normalized = interests.map((item) => item.toLowerCase().trim()).filter(Boolean);
  const buckets = normalized.length ? normalized : ['global'];

  for (const interest of buckets) {
    const key = queueKey(interest);
    const candidateId = await redis.lpop(key);
    if (candidateId && candidateId !== user._id.toString()) {
      const chat = await Chat.create({
        type: 'stranger',
        members: [user._id, candidateId],
        temporary: true,
        interests: [interest],
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24)
      });
      return { matched: true, chat, roomId: `stranger:${chat._id}` };
    }
  }

  const key = queueKey(buckets[0]);
  await redis.rpush(key, user._id.toString());
  await redis.sadd(queueIndexKey, key);
  await redis.expire(key, 60 * 10);
  return { matched: false, ticket: nanoid(), interest: buckets[0] };
}

export async function leaveQueues(userId) {
  const keys = await redis.smembers(queueIndexKey);
  await Promise.all(keys.map((key) => redis.lrem(key, 0, userId.toString())));
}
