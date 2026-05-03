import User from '../models/User.js';
import { getClientIp } from '../utils/clientIp.js';

const activityCache = new Map();
const UPDATE_INTERVAL_MS = 5 * 60 * 1000;

export function trackUserActivity(userId, reqOrSocket) {
  const id = userId?.toString();
  if (!id) return;

  const now = Date.now();
  const cachedAt = activityCache.get(id) || 0;
  if (now - cachedAt < UPDATE_INTERVAL_MS) return;
  activityCache.set(id, now);

  const ip = getClientIp(reqOrSocket);
  const update = {
    $set: {
      lastSeenAt: new Date(),
      ...(ip ? { lastIp: ip } : {})
    },
    ...(ip ? { $push: { ipHistory: { $each: [{ ip, at: new Date() }], $slice: -8 } } } : {})
  };

  User.updateOne({ _id: id }, update).catch(() => {});
}
