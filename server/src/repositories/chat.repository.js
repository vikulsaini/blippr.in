import crypto from 'node:crypto';
import { db } from '../config/database.js';
import { mapChatFromPostgres, mapChatToPostgres } from '../models/Chat.js';
import { mapUserFromPostgres } from '../utils/userMapper.js';
import { mapMessageFromPostgres } from '../models/Message.js';
import { mapCallFromPostgres } from '../models/Call.js';
import { toDbId, fromDbDoc, toDbQuery, toDbSort, toDbUpdate } from '../utils/mongoHelper.js';

export const chatRepository = {
  /**
   * Check if a chat exists.
   */
  async exists(query = {}) {
    const doc = await db.collection('chats').findOne(toDbQuery(query), { projection: { _id: 1 } });
    return !!doc;
  },

  /**
   * Find a single chat.
   */
  async findOne(query = {}) {
    const doc = await db.collection('chats').findOne(toDbQuery(query));
    return mapChatFromPostgres(fromDbDoc(doc));
  },

  /**
   * Find chat by ID.
   */
  async findById(id) {
    if (!id) return null;
    const doc = await db.collection('chats').findOne({ _id: toDbId(id) });
    return mapChatFromPostgres(fromDbDoc(doc));
  },

  /**
   * Create a new chat.
   */
  async create(data) {
    const payload = mapChatToPostgres(data);
    payload._id = toDbId(data._id || data.id || crypto.randomUUID());
    
    await db.collection('chats').insertOne(payload);
    return mapChatFromPostgres(fromDbDoc(payload));
  },

  /**
   * Update chat fields.
   */
  async update(id, updateData = {}) {
    const payload = {};
    const setObj = updateData.$set || updateData;
    const isFullInstance = typeof setObj.save === 'function' || (setObj.id !== undefined && setObj.members !== undefined);

    if (isFullInstance) {
      Object.assign(payload, mapChatToPostgres(setObj));
      delete payload.created_at;
      delete payload._id;
    } else {
      for (const [k, v] of Object.entries(setObj)) {
        if (!k.startsWith('$') && typeof v !== 'function') {
          let pgKey = null;
          if (k === 'type') pgKey = 'type';
          else if (k === 'members') pgKey = 'members';
          else if (k === 'temporary') pgKey = 'temporary';
          else if (k === 'interests') pgKey = 'interests';
          else if (k === 'lastCall' || k === 'lastCallId' || k === 'last_call_id') pgKey = 'last_call_id';
          else if (k === 'lastMessage' || k === 'lastMessageId' || k === 'last_message_id') pgKey = 'last_message_id';
          else if (k === 'hiddenFor' || k === 'hidden_for') pgKey = 'hidden_for';
          else if (k === 'archivedFor' || k === 'archived_for') pgKey = 'archived_for';
          else if (k === 'pinnedFor' || k === 'pinned_for') pgKey = 'pinned_for';
          else if (k === 'starredFor' || k === 'starred_for') pgKey = 'starred_for';
          else if (k === 'mutedFor' || k === 'muted_for') pgKey = 'muted_for';
          else if (k === 'unreadCounts' || k === 'unread_counts') pgKey = 'unread_counts';
          else if (k === 'nicknames') pgKey = 'nicknames';
          else if (k === 'disappearingMessages' || k === 'disappearing_messages') pgKey = 'disappearing_messages';
          else if (k === 'wallpapers') pgKey = 'wallpapers';
          else if (k === 'expiresAt' || k === 'expires_at') pgKey = 'expires_at';

          if (pgKey) {
            if (v instanceof Map) {
              payload[pgKey] = Object.fromEntries(v);
            } else if (pgKey === 'members' && Array.isArray(v)) {
              payload[pgKey] = v.map(m => m && typeof m === 'object' ? (m.id || m._id) : m);
            } else if (pgKey === 'last_message_id' && v && typeof v === 'object') {
              payload[pgKey] = v.id || v._id;
            } else if (pgKey === 'last_call_id' && v && typeof v === 'object') {
              payload[pgKey] = v.id || v._id;
            } else if (pgKey === 'expires_at' && v) {
              payload[pgKey] = new Date(v).toISOString();
            } else {
              payload[pgKey] = v;
            }
          }
        }
      }
      payload.updated_at = new Date();
    }

    const res = await db.collection('chats').findOneAndUpdate(
      { _id: toDbId(id) },
      { $set: payload },
      { returnDocument: 'after' }
    );
    const doc = res && res.value !== undefined ? res.value : res;
    return mapChatFromPostgres(fromDbDoc(doc));
  },

  /**
   * Update multiple chats.
   */
  async updateMany(filter = {}, update = {}) {
    const dbQuery = toDbQuery(filter);
    const dbUpdate = toDbUpdate(update);
    
    // Normalizing camelCase properties inside set/pull operations
    if (dbUpdate.$set) {
      const newSet = {};
      for (const [k, v] of Object.entries(dbUpdate.$set)) {
        let pgKey = k;
        if (k === 'hiddenFor') pgKey = 'hidden_for';
        else if (k === 'archivedFor') pgKey = 'archived_for';
        newSet[pgKey] = v;
      }
      dbUpdate.$set = newSet;
    }
    if (dbUpdate.$pull) {
      const newPull = {};
      for (const [k, v] of Object.entries(dbUpdate.$pull)) {
        let pgKey = k;
        if (k === 'hiddenFor') pgKey = 'hidden_for';
        else if (k === 'archivedFor') pgKey = 'archived_for';
        newPull[pgKey] = v;
      }
      dbUpdate.$pull = newPull;
    }

    const { modifiedCount } = await db.collection('chats').updateMany(dbQuery, dbUpdate);
    return { modifiedCount };
  },

  /**
   * Delete a chat.
   */
  async delete(id) {
    const { deletedCount } = await db.collection('chats').deleteOne({ _id: toDbId(id) });
    return deletedCount > 0;
  },

  /**
   * Find multiple chats.
   */
  async find(query = {}, options = {}) {
    let cursor = db.collection('chats').find(toDbQuery(query));
    if (options.sort) {
      cursor = cursor.sort(toDbSort(options.sort));
    }
    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }
    const docs = await cursor.toArray();
    const chats = docs.map(fromDbDoc).map(mapChatFromPostgres);

    // Populate members (profiles) if requested
    if (options.populateMembers && chats.length > 0) {
      const memberIds = [...new Set(chats.flatMap(c => c.members))].map(toDbId);
      const members = await db.collection('users').find({ _id: { $in: memberIds } }).toArray();
      const memberMap = new Map(members.map(fromDbDoc).map(m => [m.id, mapUserFromPostgres(m)]));
      for (const chat of chats) {
        chat.members = chat.members.map(id => memberMap.get(id) || id);
      }
    }

    // Populate lastMessage if requested
    if (options.populateLastMessage && chats.length > 0) {
      const msgIds = chats.map(c => toDbId(c.lastMessage)).filter(Boolean);
      if (msgIds.length > 0) {
        const messages = await db.collection('messages').find({ _id: { $in: msgIds } }).toArray();
        const msgMap = new Map(messages.map(fromDbDoc).map(m => [m.id, mapMessageFromPostgres(m)]));
        for (const chat of chats) {
          chat.lastMessage = msgMap.get(chat.lastMessage) || chat.lastMessage;
        }
      }
    }

    // Populate lastCall if requested
    if (options.populateLastCall && chats.length > 0) {
      const callIds = chats.map(c => toDbId(c.lastCall)).filter(Boolean);
      if (callIds.length > 0) {
        const calls = await db.collection('calls').find({ _id: { $in: callIds } }).toArray();
        const callMap = new Map(calls.map(fromDbDoc).map(c => [c.id, mapCallFromPostgres(c)]));
        for (const chat of chats) {
          chat.lastCall = callMap.get(chat.lastCall) || chat.lastCall;
        }
      }
    }

    return chats;
  }
};
