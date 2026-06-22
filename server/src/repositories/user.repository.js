import crypto from 'node:crypto';
import { db } from '../config/database.js';
import { mapUserFromPostgres, mapUserToPostgres } from '../utils/userMapper.js';
import { toDbId, fromDbDoc, toDbQuery, toDbSort } from '../utils/mongoHelper.js';

export const userRepository = {
  /**
   * Find a user profile by ID.
   * @param {string} id - The user ID
   */
  async findById(id) {
    if (!id) return null;
    const doc = await db.collection('users').findOne({ _id: toDbId(id) });
    return mapUserFromPostgres(fromDbDoc(doc));
  },

  /**
   * Find a user profile by email address.
   * @param {string} email
   */
  async findByEmail(email) {
    if (!email) return null;
    const doc = await db.collection('users').findOne({ email: email.toLowerCase() });
    return mapUserFromPostgres(fromDbDoc(doc));
  },

  /**
   * Find a user profile by username.
   * @param {string} username
   */
  async findByUsername(username) {
    if (!username) return null;
    const doc = await db.collection('users').findOne({ username: username.toLowerCase() });
    return mapUserFromPostgres(fromDbDoc(doc));
  },

  /**
   * Find a single user profile matching a criteria.
   */
  async findOne(query = {}) {
    const doc = await db.collection('users').findOne(toDbQuery(query));
    return mapUserFromPostgres(fromDbDoc(doc));
  },

  /**
   * Check if a user profile exists.
   */
  async exists(query = {}) {
    const doc = await db.collection('users').findOne(toDbQuery(query), { projection: { _id: 1 } });
    return !!doc;
  },

  async create(profileData) {
    const pgPayload = mapUserToPostgres(profileData);
    pgPayload._id = toDbId(profileData.supabaseId || profileData._id || profileData.id || crypto.randomUUID());
    
    if (pgPayload.interests === undefined) pgPayload.interests = [];
    if (pgPayload.blocked_users === undefined) pgPayload.blocked_users = [];
    if (pgPayload.push_tokens === undefined) pgPayload.push_tokens = [];
    if (pgPayload.is_online === undefined) pgPayload.is_online = false;
    if (pgPayload.is_guest === undefined) pgPayload.is_guest = false;
    if (pgPayload.role === undefined) pgPayload.role = 'user';
    if (pgPayload.is_verified === undefined) pgPayload.is_verified = false;
    if (pgPayload.safety_violation_count === undefined) pgPayload.safety_violation_count = 0;
    if (pgPayload.last_seen_at === undefined) pgPayload.last_seen_at = new Date();
    if (pgPayload.ip_history === undefined) pgPayload.ip_history = [];
    pgPayload.created_at = new Date();

    await db.collection('users').insertOne(pgPayload);
    return mapUserFromPostgres(fromDbDoc(pgPayload));
  },

  /**
   * Update an existing user profile by ID.
   */
  async update(id, updateData = {}) {
    const setObj = updateData.$set || updateData;
    const pgPayload = mapUserToPostgres(setObj);
    delete pgPayload.id;
    delete pgPayload._id;

    const res = await db.collection('users').findOneAndUpdate(
      { _id: toDbId(id) },
      { $set: pgPayload },
      { returnDocument: 'after' }
    );
    const doc = res && res.value !== undefined ? res.value : res;
    return mapUserFromPostgres(fromDbDoc(doc));
  },

  /**
   * Delete a profile from the database.
   */
  async delete(id) {
    const { deletedCount } = await db.collection('users').deleteOne({ _id: toDbId(id) });
    return deletedCount > 0;
  },

  /**
   * Count total profiles matching criteria.
   */
  async count(query = {}) {
    return db.collection('users').countDocuments(toDbQuery(query));
  },

  /**
   * Find multiple users by filter.
   */
  async find(query = {}, options = {}) {
    let cursor = db.collection('users').find(toDbQuery(query));
    if (options.sort) {
      cursor = cursor.sort(toDbSort(options.sort));
    }
    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }
    const docs = await cursor.toArray();
    return docs.map(fromDbDoc).map(mapUserFromPostgres);
  },

  /**
   * Search profiles by username or name.
   */
  async search(q, excludedIds = [], limit = 20) {
    const query = {};
    if (q) {
      query.$or = [
        { username: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } }
      ];
    }
    if (excludedIds.length > 0) {
      query._id = { $nin: excludedIds.map(toDbId) };
    }
    const docs = await db.collection('users').find(query).limit(limit).toArray();
    return docs.map(fromDbDoc).map(mapUserFromPostgres);
  },

  /**
   * Get suggested active users.
   */
  async suggested(excludedIds = [], limit = 20) {
    const query = {};
    if (excludedIds.length > 0) {
      query._id = { $nin: excludedIds.map(toDbId) };
    }
    const docs = await db.collection('users').find(query).sort({ created_at: -1 }).limit(limit).toArray();
    return docs.map(fromDbDoc).map(mapUserFromPostgres);
  },

  /**
   * Get a random sample of active users.
   */
  async randomSample(matchCriteria = {}, size = 20) {
    const pipeline = [];
    const match = toDbQuery(matchCriteria);
    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
    }
    pipeline.push({ $sample: { size } });
    const docs = await db.collection('users').aggregate(pipeline).toArray();
    return docs.map(fromDbDoc).map(mapUserFromPostgres);
  },

  /**
   * Find nearby users using geographical box bounding filtering.
   */
  async findNearby(coordinates, maxDistance = 25000, excludedIds = [], limit = 20, cursor = null) {
    const latDiff = maxDistance / 111000;
    const lngDiff = maxDistance / (111000 * Math.cos(coordinates[1] * Math.PI / 180));

    const query = {
      is_online: true,
      age: { $gte: 18 },
      location_lat: { $gte: coordinates[1] - latDiff, $lte: coordinates[1] + latDiff },
      location_lng: { $gte: coordinates[0] - lngDiff, $lte: coordinates[0] + lngDiff }
    };

    if (excludedIds.length > 0) {
      query._id = { $nin: excludedIds.map(toDbId) };
    }

    if (cursor) {
      query.last_seen_at = { $lt: new Date(cursor) };
    }

    const docs = await db.collection('users').find(query).sort({ last_seen_at: -1 }).limit(limit).toArray();
    return docs.map(fromDbDoc).map(mapUserFromPostgres);
  },

  /**
   * Find available matchmaking users (nearby or general active).
   */
  async findAvailable(baseFilter, limit = 20, coordinates = null, maxDistance = 25000, cursor = null) {
    const query = {
      is_online: true,
      age: { $gte: 18 },
      ...toDbQuery(baseFilter)
    };

    if (coordinates?.length) {
      const latDiff = maxDistance / 111000;
      const lngDiff = maxDistance / (111000 * Math.cos(coordinates[1] * Math.PI / 180));
      query.location_lat = { $gte: coordinates[1] - latDiff, $lte: coordinates[1] + latDiff };
      query.location_lng = { $gte: coordinates[0] - lngDiff, $lte: coordinates[0] + lngDiff };
    }

    if (cursor) {
      query.last_seen_at = { $lt: new Date(cursor) };
    }

    const docs = await db.collection('users').find(query).sort({ last_seen_at: -1 }).limit(limit).toArray();
    return docs.map(fromDbDoc).map(mapUserFromPostgres);
  }
};
