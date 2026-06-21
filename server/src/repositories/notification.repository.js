import crypto from 'node:crypto';
import { db } from '../config/database.js';
import { mapNotificationFromPostgres } from '../models/Notification.js';
import { mapUserFromPostgres } from '../utils/userMapper.js';
import { toDbId, fromDbDoc, toDbQuery, toDbSort, toDbUpdate } from '../utils/mongoHelper.js';

export const notificationRepository = {
  /**
   * Find a single notification.
   */
  async findOne(query = {}) {
    const doc = await db.collection('notifications').findOne(toDbQuery(query));
    return mapNotificationFromPostgres(fromDbDoc(doc));
  },

  /**
   * Find notification by ID.
   */
  async findById(id) {
    if (!id) return null;
    const doc = await db.collection('notifications').findOne({ _id: toDbId(id) });
    return mapNotificationFromPostgres(fromDbDoc(doc));
  },

  /**
   * Create a new notification.
   */
  async create(data) {
    const payload = {
      user_id: toDbId(data.user || data.userId || data.user_id),
      type: data.type || 'system',
      title: data.title,
      body: data.body || '',
      url: data.url || null,
      request_id: toDbId(data.requestId || data.request_id || null),
      chat_id: toDbId(data.chatId || data.chat_id || null),
      message_id: toDbId(data.messageId || data.message_id || null),
      call_id: toDbId(data.callId || data.call_id || null),
      actor_id: toDbId(data.actor || data.actorId || data.actor_id || null),
      read_at: data.readAt || null,
      created_at: new Date(),
      updated_at: new Date()
    };
    payload._id = toDbId(data._id || data.id || crypto.randomUUID());

    await db.collection('notifications').insertOne(payload);
    return mapNotificationFromPostgres(fromDbDoc(payload));
  },

  /**
   * Update a notification's status (read status, etc.)
   */
  async update(id, updateData) {
    const setObj = updateData.$set || updateData;
    const payload = {};
    if (setObj.readAt !== undefined) payload.read_at = setObj.readAt;
    if (setObj.read_at !== undefined) payload.read_at = setObj.read_at;
    payload.updated_at = new Date();

    const res = await db.collection('notifications').findOneAndUpdate(
      { _id: toDbId(id) },
      { $set: payload },
      { returnDocument: 'after' }
    );
    const doc = res && res.value !== undefined ? res.value : res;
    return mapNotificationFromPostgres(fromDbDoc(doc));
  },

  /**
   * Count documents matching filter.
   */
  async count(query = {}) {
    return db.collection('notifications').countDocuments(toDbQuery(query));
  },

  /**
   * Update multiple notifications.
   */
  async updateMany(filter = {}, update = {}) {
    const dbQuery = toDbQuery(filter);
    const dbUpdate = toDbUpdate(update);

    if (dbUpdate.$set) {
      const newSet = {};
      for (const [k, v] of Object.entries(dbUpdate.$set)) {
        let pgKey = k;
        if (k === 'readAt') pgKey = 'read_at';
        newSet[pgKey] = v;
      }
      dbUpdate.$set = newSet;
    }

    const { modifiedCount } = await db.collection('notifications').updateMany(dbQuery, dbUpdate);
    return { modifiedCount };
  },

  /**
   * Delete notifications.
   */
  async deleteMany(query = {}) {
    const { deletedCount } = await db.collection('notifications').deleteMany(toDbQuery(query));
    return { deletedCount };
  },

  /**
   * Find notifications.
   */
  async find(query = {}, options = {}) {
    let cursor = db.collection('notifications').find(toDbQuery(query));
    if (options.sort) {
      cursor = cursor.sort(toDbSort(options.sort));
    }
    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }
    const docs = await cursor.toArray();
    const notifications = docs.map(fromDbDoc).map(mapNotificationFromPostgres);

    // Eagerly populate actor details
    if (options.populateActor && notifications.length > 0) {
      const actorIds = [...new Set(notifications.map(n => toDbId(n.actor)))].filter(Boolean);
      if (actorIds.length > 0) {
        const profiles = await db.collection('users').find({ _id: { $in: actorIds } }).toArray();
        const profileMap = new Map(profiles.map(fromDbDoc).map(p => [p.id, mapUserFromPostgres(p)]));
        for (const notif of notifications) {
          notif.actor = profileMap.get(notif.actor) || notif.actor;
        }
      }
    }

    return notifications;
  }
};
