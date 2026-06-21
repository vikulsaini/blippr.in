import { db } from '../config/database.js';
import { mapCallFromPostgres } from '../models/Call.js';
import { mapUserFromPostgres } from '../utils/userMapper.js';

export const callRepository = {
  /**
   * Find single call matching query.
   */
  async findOne(query = {}) {
    let q = db.from('calls').select('*');
    if (query._id || query.id) q = q.eq('id', query._id || query.id);
    if (query.status) q = q.eq('status', query.status);
    if (query.chatId || query.chat) q = q.eq('chat_id', query.chatId || query.chat);

    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return mapCallFromPostgres(data);
  },

  /**
   * Find call by ID.
   */
  async findById(id) {
    if (!id) return null;
    const { data, error } = await db
      .from('calls')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return mapCallFromPostgres(data);
  },

  /**
   * Create a call log record.
   */
  async create(data) {
    const payload = {
      caller_id: data.caller || data.callerId || data.caller_id,
      receiver_id: data.receiver || data.receiverId || data.receiver_id,
      chat_id: data.chat || data.chatId || data.chat_id || null,
      type: data.type,
      status: data.status || 'ringing',
      started_at: data.startedAt || new Date(),
      answered_at: data.answeredAt || null,
      ended_at: data.endedAt || null,
      duration_seconds: data.durationSeconds || 0,
      updated_at: new Date()
    };
    const { data: row, error } = await db
      .from('calls')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return mapCallFromPostgres(row);
  },

  /**
   * Update a call.
   */
  async update(id, updateData = {}) {
    const payload = {};
    const setObj = updateData.$set || updateData;
    for (const [k, v] of Object.entries(setObj)) {
      if (!k.startsWith('$')) {
        let pgKey = k;
        if (k === 'endedAt') pgKey = 'ended_at';
        else if (k === 'durationSeconds') pgKey = 'duration_seconds';
        else if (k === 'answeredAt') pgKey = 'answered_at';
        else if (k === 'startedAt') pgKey = 'started_at';
        payload[pgKey] = v;
      }
    }

    const { data, error } = await db
      .from('calls')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return mapCallFromPostgres(data);
  },

  /**
   * Delete calls.
   */
  async deleteMany(query = {}) {
    let q = db.from('calls').delete();
    const chatId = query.chat || query.chatId || query.chat_id;
    if (chatId) q = q.eq('chat_id', chatId);

    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  /**
   * Find calls history logs.
   */
  async find(query = {}, options = {}) {
    let selectFields = '*';
    if (options.populateCaller || options.populateReceiver) {
      const parts = ['*'];
      if (options.populateCaller) parts.push('caller:profiles!caller_id(*)');
      if (options.populateReceiver) parts.push('receiver:profiles!receiver_id(*)');
      selectFields = parts.join(',');
    }

    let q = db.from('calls').select(selectFields);

    const chatId = query.chat || query.chatId || query.chat_id;
    if (chatId) q = q.eq('chat_id', chatId);

    if (query.$or) {
      const orStr = query.$or.map(o => {
        const parts = [];
        if (o.caller) parts.push(`caller_id.eq.${o.caller}`);
        if (o.receiver) parts.push(`receiver_id.eq.${o.receiver}`);
        return parts.join(',');
      }).join(',');
      q = q.or(orStr);
    } else {
      if (query.caller) q = q.eq('caller_id', query.caller);
      if (query.receiver) q = q.eq('receiver_id', query.receiver);
    }

    if (options.sort) {
      const sortStr = typeof options.sort === 'string' 
        ? options.sort 
        : (typeof options.sort === 'object' && options.sort !== null
            ? (Object.values(options.sort)[0] === -1 || String(Object.values(options.sort)[0]).toLowerCase() === 'desc' 
                ? `-${Object.keys(options.sort)[0]}` 
                : Object.keys(options.sort)[0]) 
            : '');
      
      const desc = sortStr.startsWith('-');
      let field = desc ? sortStr.slice(1) : sortStr;
      if (field === 'startedAt') field = 'started_at';
      else if (field === 'createdAt') field = 'created_at';
      else if (field === 'updatedAt') field = 'updated_at';
      else if (field === 'answeredAt') field = 'answered_at';
      else if (field === 'endedAt') field = 'ended_at';
      else if (field === 'durationSeconds') field = 'duration_seconds';
      q = q.order(field, { ascending: !desc });
    }

    if (options.limit) {
      q = q.limit(options.limit);
    }

    const { data, error } = await q;
    if (error) throw error;

    return (data || []).map(row => {
      const call = mapCallFromPostgres(row);
      
      // Eagerly map joined profiles
      if (row.caller && typeof row.caller === 'object') {
        call.caller = mapUserFromPostgres(row.caller);
      }
      if (row.receiver && typeof row.receiver === 'object') {
        call.receiver = mapUserFromPostgres(row.receiver);
      }

      return call;
    });
  }
};
