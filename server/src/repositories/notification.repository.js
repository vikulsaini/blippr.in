import { db } from '../config/database.js';
import { mapNotificationFromPostgres } from '../models/Notification.js';
import { mapUserFromPostgres } from '../utils/userMapper.js';

export const notificationRepository = {
  /**
   * Find a single notification.
   */
  async findOne(query = {}) {
    let q = db.from('notifications').select('*');
    if (query._id || query.id) q = q.eq('id', query._id || query.id);
    if (query.user) q = q.eq('user_id', query.user);
    if (query.requestId) q = q.eq('request_id', query.requestId);

    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return mapNotificationFromPostgres(data);
  },

  /**
   * Find notification by ID.
   */
  async findById(id) {
    if (!id) return null;
    const { data, error } = await db
      .from('notifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return mapNotificationFromPostgres(data);
  },

  /**
   * Create a new notification.
   */
  async create(data) {
    const payload = {
      user_id: data.user || data.userId || data.user_id,
      type: data.type || 'system',
      title: data.title,
      body: data.body || '',
      url: data.url || null,
      request_id: data.requestId || data.request_id || null,
      chat_id: data.chatId || data.chat_id || null,
      message_id: data.messageId || data.message_id || null,
      call_id: data.callId || data.call_id || null,
      actor_id: data.actor || data.actorId || data.actor_id || null,
      read_at: data.readAt || null,
      updated_at: new Date()
    };
    const { data: row, error } = await db
      .from('notifications')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return mapNotificationFromPostgres(row);
  },

  /**
   * Count documents matching filter.
   */
  async count(query = {}) {
    let q = db.from('notifications').select('id', { count: 'exact', head: true });
    if (query.user || query.userId) q = q.eq('user_id', query.user || query.userId);
    if (query.readAt === null) q = q.is('read_at', null);
    if (query.type) {
      if (query.type.$in) {
        q = q.in('type', query.type.$in);
      } else {
        q = q.eq('type', query.type);
      }
    }
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  },

  /**
   * Update multiple notifications.
   */
  async updateMany(filter = {}, update = {}) {
    const payload = {};
    const setObj = update.$set || update;
    for (const [k, v] of Object.entries(setObj)) {
      if (k === 'readAt') {
        payload.read_at = v;
      } else if (!k.startsWith('$')) {
        payload[k] = v;
      }
    }

    let q = db.from('notifications').update(payload);
    if (filter.user || filter.userId) q = q.eq('user_id', filter.user || filter.userId);
    if (filter.readAt === null) q = q.is('read_at', null);
    if (filter.type) {
      if (filter.type.$in) {
        q = q.in('type', filter.type.$in);
      } else {
        q = q.eq('type', filter.type);
      }
    }

    const { error, data } = await q;
    if (error) throw error;
    return { modifiedCount: data?.length || 1 };
  },

  /**
   * Delete notifications.
   */
  async deleteMany(query = {}) {
    let q = db.from('notifications').delete();
    if (query.user) q = q.eq('user_id', query.user);
    if (query.requestId) q = q.eq('request_id', query.requestId);
    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  /**
   * Find notifications.
   */
  async find(query = {}, options = {}) {
    let selectFields = '*';
    if (options.populateActor) {
      selectFields = '*, actor:profiles(*)';
    }

    let q = db.from('notifications').select(selectFields);
    if (query.user || query.userId) q = q.eq('user_id', query.user || query.userId);
    if (query.readAt === null) q = q.is('read_at', null);
    
    if (query.type) {
      if (query.type.$in) {
        q = q.in('type', query.type.$in);
      } else {
        q = q.eq('type', query.type);
      }
    }
    if (query.createdAt) {
      if (query.createdAt.$lt) {
        q = q.lt('created_at', query.createdAt.$lt instanceof Date ? query.createdAt.$lt.toISOString() : query.createdAt.$lt);
      } else if (query.createdAt.$gt) {
        q = q.gt('created_at', query.createdAt.$gt instanceof Date ? query.createdAt.$gt.toISOString() : query.createdAt.$gt);
      }
    }

    if (options.sort) {
      const desc = options.sort.startsWith('-');
      const field = desc ? options.sort.slice(1) : options.sort;
      q = q.order(field === 'createdAt' ? 'created_at' : field, { ascending: !desc });
    }

    if (options.limit) {
      q = q.limit(options.limit);
    }

    const { data, error } = await q;
    if (error) throw error;

    return (data || []).map(row => {
      const notif = mapNotificationFromPostgres(row);
      if (row.actor && typeof row.actor === 'object') {
        notif.actor = mapUserFromPostgres(row.actor);
      }
      return notif;
    });
  }
};
