import crypto from 'node:crypto';
import { db } from '../config/database.js';
import { mapMessageFromPostgres } from '../models/Message.js';
import { mapUserFromPostgres } from '../utils/userMapper.js';
import { toDbId, fromDbDoc, toDbQuery, toDbSort, toDbUpdate } from '../utils/mongoHelper.js';

export const messageRepository = {
  /**
   * Find a single message.
   */
  async findOne(query = {}) {
    const doc = await db.collection('messages').findOne(toDbQuery(query));
    return mapMessageFromPostgres(fromDbDoc(doc));
  },

  /**
   * Find message by ID.
   */
  async findById(id) {
    if (!id) return null;
    const doc = await db.collection('messages').findOne({ _id: toDbId(id) });
    return mapMessageFromPostgres(fromDbDoc(doc));
  },

  /**
   * Find a message and update (reactions, seen status, etc.)
   */
  async findOneAndUpdate(filter = {}, update = {}) {
    const dbQuery = toDbQuery(filter);
    const dbUpdate = toDbUpdate(update);
    const res = await db.collection('messages').findOneAndUpdate(
      dbQuery,
      dbUpdate,
      { returnDocument: 'after' }
    );
    const doc = res && res.value !== undefined ? res.value : res;
    return mapMessageFromPostgres(fromDbDoc(doc));
  },

  /**
   * Create a new message.
   */
  async create(data) {
    const payload = {
      chat_id: toDbId(data.chat || data.chatId || data.chat_id),
      sender_id: toDbId(data.sender || data.senderId || data.sender_id),
      text: data.text || null,
      media: data.media || null,
      location: data.location || null,
      reply_to_id: toDbId(data.replyTo || data.replyToId || data.reply_to_id || null),
      mentions: data.mentions || [],
      reactions: data.reactions || [],
      status: data.status || 'sent',
      seen_by: (data.seenBy || []).map(toDbId),
      deleted_for: (data.deletedFor || []).map(toDbId),
      edited_at: data.editedAt || null,
      deleted_at: data.deletedAt || null,
      created_at: new Date(),
      updated_at: new Date()
    };
    payload._id = toDbId(data._id || data.id || crypto.randomUUID());

    await db.collection('messages').insertOne(payload);
    return mapMessageFromPostgres(fromDbDoc(payload));
  },

  /**
   * Delete messages.
   */
  async deleteMany(query = {}) {
    const { deletedCount } = await db.collection('messages').deleteMany(toDbQuery(query));
    return { deletedCount };
  },

  /**
   * Update multiple messages (seen receipts, etc.)
   */
  async updateMany(filter = {}, update = {}) {
    const dbQuery = toDbQuery(filter);
    const dbUpdate = toDbUpdate(update);
    const { modifiedCount } = await db.collection('messages').updateMany(dbQuery, dbUpdate);
    return { modifiedCount };
  },

  /**
   * Count messages.
   */
  async count(query = {}) {
    return db.collection('messages').countDocuments(toDbQuery(query));
  },

  /**
   * Find multiple messages, supporting relationship joins and cursor pagination.
   */
  async find(query = {}, options = {}) {
    let cursor = db.collection('messages').find(toDbQuery(query));
    if (options.sort) {
      cursor = cursor.sort(toDbSort(options.sort));
    }
    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }
    const docs = await cursor.toArray();
    const messages = docs.map(fromDbDoc).map(mapMessageFromPostgres);

    // Eagerly populate sender profile details
    if (options.populateSender && messages.length > 0) {
      const senderIds = [...new Set(messages.map(m => toDbId(m.sender)))].filter(Boolean);
      if (senderIds.length > 0) {
        const profiles = await db.collection('users').find({ _id: { $in: senderIds } }).toArray();
        const profileMap = new Map(profiles.map(fromDbDoc).map(p => [p.id, mapUserFromPostgres(p)]));
        for (const msg of messages) {
          msg.sender = profileMap.get(msg.sender) || msg.sender;
        }
      }
    }

    // Eagerly populate replyTo details
    if (options.populateReplyTo && messages.length > 0) {
      const replyIds = [...new Set(messages.map(m => toDbId(m.replyTo)))].filter(Boolean);
      if (replyIds.length > 0) {
        const replies = await db.collection('messages').find({ _id: { $in: replyIds } }).toArray();
        const replyMap = new Map(replies.map(fromDbDoc).map(m => [m.id, mapMessageFromPostgres(m)]));
        for (const msg of messages) {
          msg.replyTo = replyMap.get(msg.replyTo) || msg.replyTo;
        }
      }
    }

    return messages;
  }
};
