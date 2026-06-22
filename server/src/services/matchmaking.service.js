import { nanoid } from 'nanoid';
import Chat from '../models/Chat.js';
import FriendRequest from '../models/FriendRequest.js';
import User from '../models/User.js';
import { redis } from '../config/redis.js';

const queueKey = (interest) => `matchmaking:${interest || 'global'}`;
const queueIndexKey = 'matchmaking:keys';

const memoryQueues = new Map();
const memoryQueueIndex = new Set();

function redisConfigured() {
  return redis && redis.status === 'ready';
}

export async function findOrQueueUser(user, interests = []) {
  const normalized = interests.map((item) => item.toLowerCase().trim()).filter(Boolean);
  const buckets = normalized.length ? normalized : ['global'];

  if (redisConfigured()) {
    for (const interest of buckets) {
      const key = queueKey(interest);
      const candidateId = await redis.lpop(key);
      if (candidateId && candidateId !== user._id.toString() && (await canMatchUsers(user, candidateId))) {
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
  } else {
    // In-memory queue fallback
    for (const interest of buckets) {
      const key = queueKey(interest);
      const queue = memoryQueues.get(key) || [];
      if (queue.length > 0) {
        let candidateIndex = -1;
        for (let i = 0; i < queue.length; i++) {
          const candidateId = queue[i];
          if (candidateId !== user._id.toString() && (await canMatchUsers(user, candidateId))) {
            candidateIndex = i;
            break;
          }
        }
        if (candidateIndex !== -1) {
          const [candidateId] = queue.splice(candidateIndex, 1);
          memoryQueues.set(key, queue);
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
    }

    const key = queueKey(buckets[0]);
    const queue = memoryQueues.get(key) || [];
    if (!queue.includes(user._id.toString())) {
      queue.push(user._id.toString());
      memoryQueues.set(key, queue);
      memoryQueueIndex.add(key);
    }
    return { matched: false, ticket: nanoid(), interest: buckets[0] };
  }
}

async function canMatchUsers(user, candidateId) {
  const candidate = await User.findById(candidateId).select('blockedUsers age');
  if (!candidate) return false;
  if (candidate.age !== null && candidate.age !== undefined && candidate.age < 18) return false;

  const blockedByUser = (user.blockedUsers || []).some((userId) => userId.toString() === candidateId);
  const blockedByCandidate = (candidate.blockedUsers || []).some((userId) => userId.toString() === user._id.toString());
  if (blockedByUser || blockedByCandidate) return false;

  const [directChat, pendingRequest] = await Promise.all([
    Chat.exists({ type: 'direct', members: { $all: [user._id, candidateId] } }),
    FriendRequest.exists({
      status: 'pending',
      $or: [
        { from: user._id, to: candidateId },
        { from: candidateId, to: user._id }
      ]
    })
  ]);

  return !directChat && !pendingRequest;
}

export async function leaveQueues(userId) {
  if (redisConfigured()) {
    const keys = await redis.smembers(queueIndexKey);
    await Promise.all(keys.map((key) => redis.lrem(key, 0, userId.toString())));
  } else {
    for (const key of memoryQueueIndex) {
      const queue = memoryQueues.get(key) || [];
      const updated = queue.filter(id => id !== userId.toString());
      memoryQueues.set(key, updated);
    }
  }
}
