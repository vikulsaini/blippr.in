import crypto from 'node:crypto';
import { db } from '../config/database.js';
import { mapCallFromPostgres } from '../models/Call.js';
import { mapUserFromPostgres } from '../utils/userMapper.js';
import { toDbId, fromDbDoc, toDbQuery, toDbSort, toDbUpdate } from '../utils/mongoHelper.js';

export const callRepository = {
  /**
   * Find single call matching query.
   */
  async findOne(query = {}) {
    const doc = await db.collection('calls').findOne(toDbQuery(query));
    return mapCallFromPostgres(fromDbDoc(doc));
  },

  /**
   * Find call by ID.
   */
  async findById(id) {
    if (!id) return null;
    const doc = await db.collection('calls').findOne({ _id: toDbId(id) });
    return mapCallFromPostgres(fromDbDoc(doc));
  },

  /**
   * Create a call log record.
   */
  async create(data) {
    const payload = {
      caller_id: toDbId(data.caller || data.callerId || data.caller_id),
      receiver_id: toDbId(data.receiver || data.receiverId || data.receiver_id),
      chat_id: toDbId(data.chat || data.chatId || data.chat_id || null),
      type: data.type,
      status: data.status || 'ringing',
      started_at: data.startedAt || new Date(),
      answered_at: data.answeredAt || null,
      ended_at: data.endedAt || null,
      duration_seconds: data.durationSeconds || 0,
      created_at: new Date(),
      updated_at: new Date()
    };
    payload._id = toDbId(data._id || data.id || crypto.randomUUID());

    await db.collection('calls').insertOne(payload);
    return mapCallFromPostgres(fromDbDoc(payload));
  },

  /**
   * Update a call.
   */
  async update(id, updateData = {}) {
    const payload = {};
    const setObj = updateData.$set || updateData;
    for (const [k, v] of Object.entries(setObj)) {
      if (!k.startsWith('$') && typeof v !== 'function') {
        let pgKey = null;
        if (k === 'endedAt' || k === 'ended_at') pgKey = 'ended_at';
        else if (k === 'durationSeconds' || k === 'duration_seconds') pgKey = 'duration_seconds';
        else if (k === 'answeredAt' || k === 'answered_at') pgKey = 'answered_at';
        else if (k === 'startedAt' || k === 'started_at') pgKey = 'started_at';
        else if (k === 'status') pgKey = 'status';
        else if (k === 'type') pgKey = 'type';
        else if (k === 'chat' || k === 'chatId' || k === 'chat_id') pgKey = 'chat_id';
        else if (k === 'caller' || k === 'callerId' || k === 'caller_id') pgKey = 'caller_id';
        else if (k === 'receiver' || k === 'receiverId' || k === 'receiver_id') pgKey = 'receiver_id';

        if (pgKey) {
          payload[pgKey] = v && typeof v === 'object' && (v.id || v._id) ? toDbId(v.id || v._id) : toDbId(v);
        }
      }
    }
    payload.updated_at = new Date();

    const res = await db.collection('calls').findOneAndUpdate(
      { _id: toDbId(id) },
      { $set: payload },
      { returnDocument: 'after' }
    );
    const doc = res && res.value !== undefined ? res.value : res;
    return mapCallFromPostgres(fromDbDoc(doc));
  },

  /**
   * Delete calls.
   */
  async deleteMany(query = {}) {
    const { deletedCount } = await db.collection('calls').deleteMany(toDbQuery(query));
    return { deletedCount };
  },

  /**
   * Find calls history logs.
   */
  async find(query = {}, options = {}) {
    let cursor = db.collection('calls').find(toDbQuery(query));
    if (options.sort) {
      cursor = cursor.sort(toDbSort(options.sort));
    }
    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }
    const docs = await cursor.toArray();
    const calls = docs.map(fromDbDoc).map(mapCallFromPostgres);

    // Eagerly populate caller/receiver profiles
    if (options.populateCaller && calls.length > 0) {
      const callerIds = [...new Set(calls.map(c => toDbId(c.caller)))].filter(Boolean);
      if (callerIds.length > 0) {
        const profiles = await db.collection('users').find({ _id: { $in: callerIds } }).toArray();
        const profileMap = new Map(profiles.map(fromDbDoc).map(p => [p.id, mapUserFromPostgres(p)]));
        for (const call of calls) {
          call.caller = profileMap.get(call.caller) || call.caller;
        }
      }
    }

    if (options.populateReceiver && calls.length > 0) {
      const receiverIds = [...new Set(calls.map(c => toDbId(c.receiver)))].filter(Boolean);
      if (receiverIds.length > 0) {
        const profiles = await db.collection('users').find({ _id: { $in: receiverIds } }).toArray();
        const profileMap = new Map(profiles.map(fromDbDoc).map(p => [p.id, mapUserFromPostgres(p)]));
        for (const call of calls) {
          call.receiver = profileMap.get(call.receiver) || call.receiver;
        }
      }
    }

    return calls;
  }
};
