import { supabaseAdmin } from '../config/supabase.js';

class NotificationInstance {
  constructor(data) {
    Object.assign(this, data);
  }

  async save() {
    const payload = {
      user_id: this.user || this.userId || this.user_id,
      type: this.type || 'system',
      title: this.title,
      body: this.body || '',
      url: this.url || null,
      request_id: this.requestId || this.request_id || null,
      chat_id: this.chatId || this.chat_id || null,
      message_id: this.messageId || this.message_id || null,
      call_id: this.callId || this.call_id || null,
      actor_id: this.actor || this.actorId || this.actor_id || null,
      read_at: this.readAt || null,
      updated_at: new Date()
    };

    const id = this.id || this._id;
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapNotificationFromPostgres(data));
    } else {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapNotificationFromPostgres(data));
    }
    return this;
  }

  toObject() {
    return { ...this };
  }
}

function mapNotificationFromPostgres(row) {
  if (!row) return null;
  return new NotificationInstance({
    _id: row.id,
    id: row.id,
    user: row.user_id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    url: row.url,
    requestId: row.request_id,
    chatId: row.chat_id,
    messageId: row.message_id,
    callId: row.call_id,
    actor: row.actor_id,
    readAt: row.read_at ? new Date(row.read_at) : null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null
  });
}

function mapNotificationFieldToPg(field) {
  const mapping = {
    _id: 'id',
    id: 'id',
    user: 'user_id',
    userId: 'user_id',
    type: 'type',
    title: 'title',
    body: 'body',
    url: 'url',
    requestId: 'request_id',
    chatId: 'chat_id',
    messageId: 'message_id',
    callId: 'call_id',
    actor: 'actor_id',
    readAt: 'read_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  };
  return mapping[field] || field;
}

function applyNotificationFilters(q, query) {
  let res = q;
  for (const [key, value] of Object.entries(query)) {
    const pgKey = mapNotificationFieldToPg(key);

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [op, val] of Object.entries(value)) {
        if (op === '$nin') {
          if (Array.isArray(val) && val.length > 0) {
            res = res.not(pgKey, 'in', `(${val.map(id => `"${id}"`).join(',')})`);
          }
        } else if (op === '$ne') {
          res = res.neq(pgKey, val);
        } else if (op === '$lt') {
          res = res.lt(pgKey, val);
        } else if (op === '$gte') {
          res = res.gte(pgKey, val);
        } else if (op === '$in') {
          if (Array.isArray(val) && val.length > 0) {
            res = res.in(pgKey, val);
          }
        }
      }
    } else if (key === '$or') {
      const orStrings = value.map(filterObj => {
        const [orKey, orVal] = Object.entries(filterObj)[0];
        const pgOrKey = mapNotificationFieldToPg(orKey);
        if (orVal && typeof orVal === 'object') {
          if (orVal.$ne) {
            return `${pgOrKey}.neq.${orVal.$ne}`;
          }
        }
        return `${pgOrKey}.eq.${orVal}`;
      });
      res = res.or(orStrings.join(','));
    } else {
      res = res.eq(pgKey, value);
    }
  }
  return res;
}

const Notification = {
  async findOne(query = {}) {
    let q = supabaseAdmin.from('notifications').select('*');
    q = applyNotificationFilters(q, query);
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return mapNotificationFromPostgres(data);
  },

  async findById(id) {
    if (!id) return null;
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return mapNotificationFromPostgres(data);
  },

  async create(data) {
    const inst = new NotificationInstance(data);
    return inst.save();
  },

  async deleteMany(query = {}) {
    let q = supabaseAdmin.from('notifications').delete();
    q = applyNotificationFilters(q, query);
    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  find(query = {}) {
    let q = supabaseAdmin.from('notifications').select('*');
    q = applyNotificationFilters(q, query);

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          const mapped = (data || []).map(mapNotificationFromPostgres);
          resolve(mapped);
        } catch (err) {
          reject(err);
        }
      },
      select() {
        return this;
      },
      limit(n) {
        q = q.limit(n);
        return this;
      },
      sort(sortStr) {
        if (sortStr) {
          const desc = sortStr.startsWith('-');
          const field = desc ? sortStr.slice(1) : sortStr;
          const pgField = mapNotificationFieldToPg(field);
          q = q.order(pgField, { ascending: !desc });
        }
        return this;
      },
      lean() {
        return this;
      },
      populate(field) {
        const originalThen = this.then;
        this.then = async (resolve, reject) => {
          try {
            const notifications = await new Promise((res, rej) => originalThen(res, rej));
            if (notifications.length === 0) return resolve(notifications);

            if (field === 'actor') {
              const actorIds = [...new Set(notifications.map(n => n.actor).filter(Boolean))];
              if (actorIds.length > 0) {
                const User = (await import('./User.js')).default;
                const users = await User.find({ _id: { $in: actorIds } });
                const userMap = new Map(users.map(u => [u.id, u]));
                for (const notif of notifications) {
                  notif.actor = userMap.get(notif.actor) || notif.actor;
                }
              }
            }
            resolve(notifications);
          } catch (err) {
            reject(err);
          }
        };
        return this;
      }
    };
    return builder;
  }
};

export default Notification;
