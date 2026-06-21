import crypto from 'node:crypto';
import { db } from '../config/database.js';
import { mapFriendRequestFromPostgres } from '../models/FriendRequest.js';
import { mapUserFromPostgres } from '../utils/userMapper.js';
import { toDbId, fromDbDoc, toDbQuery, toDbSort, toDbUpdate } from '../utils/mongoHelper.js';

export const friendRepository = {
  /**
   * Check if a friend request exists.
   */
  async exists(query = {}) {
    const doc = await db.collection('friend_requests').findOne(toDbQuery(query), { projection: { _id: 1 } });
    return !!doc;
  },

  /**
   * Find a single friend request matching a query.
   */
  async findOne(query = {}) {
    const doc = await db.collection('friend_requests').findOne(toDbQuery(query));
    return mapFriendRequestFromPostgres(fromDbDoc(doc));
  },

  /**
   * Find a friend request by ID.
   */
  async findById(id) {
    if (!id) return null;
    const doc = await db.collection('friend_requests').findOne({ _id: toDbId(id) });
    return mapFriendRequestFromPostgres(fromDbDoc(doc));
  },

  /**
   * Create a new friend request.
   */
  async create(data) {
    const payload = {
      from_id: toDbId(data.from),
      to_id: toDbId(data.to),
      status: data.status || 'pending',
      created_at: new Date(),
      updated_at: new Date()
    };
    payload._id = toDbId(data._id || data.id || crypto.randomUUID());

    await db.collection('friend_requests').insertOne(payload);
    return mapFriendRequestFromPostgres(fromDbDoc(payload));
  },

  /**
   * Delete friend requests matching a query.
   */
  async deleteMany(query = {}) {
    const { deletedCount } = await db.collection('friend_requests').deleteMany(toDbQuery(query));
    return { deletedCount };
  },

  /**
   * Find multiple friend requests.
   */
  async find(query = {}, options = {}) {
    let cursor = db.collection('friend_requests').find(toDbQuery(query));
    if (options.sort) {
      cursor = cursor.sort(toDbSort(options.sort));
    }
    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }
    const docs = await cursor.toArray();
    const reqs = docs.map(fromDbDoc).map(mapFriendRequestFromPostgres);

    // Eagerly populate from profile
    if (options.populateFrom && reqs.length > 0) {
      const fromIds = [...new Set(reqs.map(r => toDbId(r.from)))].filter(Boolean);
      if (fromIds.length > 0) {
        const profiles = await db.collection('users').find({ _id: { $in: fromIds } }).toArray();
        const profileMap = new Map(profiles.map(fromDbDoc).map(p => [p.id, mapUserFromPostgres(p)]));
        for (const req of reqs) {
          req.from = profileMap.get(req.from) || req.from;
        }
      }
    }

    // Eagerly populate to profile
    if (options.populateTo && reqs.length > 0) {
      const toIds = [...new Set(reqs.map(r => toDbId(r.to)))].filter(Boolean);
      if (toIds.length > 0) {
        const profiles = await db.collection('users').find({ _id: { $in: toIds } }).toArray();
        const profileMap = new Map(profiles.map(fromDbDoc).map(p => [p.id, mapUserFromPostgres(p)]));
        for (const req of reqs) {
          req.to = profileMap.get(req.to) || req.to;
        }
      }
    }

    return reqs;
  },

  /**
   * Update friend request status.
   */
  async update(id, status) {
    const res = await db.collection('friend_requests').findOneAndUpdate(
      { _id: toDbId(id) },
      { $set: { status, updated_at: new Date() } },
      { returnDocument: 'after' }
    );
    const doc = res && res.value !== undefined ? res.value : res;
    return mapFriendRequestFromPostgres(fromDbDoc(doc));
  }
};
