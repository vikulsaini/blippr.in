import { supabaseAdmin } from '../config/supabase.js';

export function mapNotificationFromPostgres(row) {
  if (!row) return null;
  return {
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
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,

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
        actor_id: this.actor?.id || this.actor || this.actorId || this.actor_id || null,
        read_at: this.readAt || null,
        updated_at: new Date()
      };

      const { data, error } = await supabaseAdmin
        .from('notifications')
        .update(payload)
        .eq('id', this.id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapNotificationFromPostgres(data));
      return this;
    }
  };
}

const Notification = {
  async findOne(query = {}) {
    let q = supabaseAdmin.from('notifications').select('*');
    if (query._id) q = q.eq('id', query._id);
    if (query.user) q = q.eq('user_id', query.user);
    if (query.requestId) q = q.eq('request_id', query.requestId);
    
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
    const { data: row, error } = await supabaseAdmin
      .from('notifications')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return mapNotificationFromPostgres(row);
  },

  async deleteMany(query = {}) {
    let q = supabaseAdmin.from('notifications').delete();
    if (query.user) q = q.eq('user_id', query.user);
    if (query.requestId) q = q.eq('request_id', query.requestId);
    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  find(query = {}) {
    let q = supabaseAdmin.from('notifications').select('*');
    if (query.user) q = q.eq('user_id', query.user);
    if (query.userId) q = q.eq('user_id', query.userId);
    if (query.readAt === null) q = q.is('read_at', null);

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          resolve((data || []).map(mapNotificationFromPostgres));
        } catch (err) {
          reject(err);
        }
      },
      select() { return this; },
      limit(n) { q = q.limit(n); return this; },
      sort(sortStr) {
        if (sortStr) {
          const desc = sortStr.startsWith('-');
          const field = desc ? sortStr.slice(1) : sortStr;
          q = q.order(field === 'createdAt' ? 'created_at' : field, { ascending: !desc });
        }
        return this;
      },
      lean() { return this; },
      populate(field) {
        const originalThen = this.then;
        this.then = async (resolve, reject) => {
          try {
            const notifications = await new Promise((res, rej) => originalThen(res, rej));
            if (notifications.length === 0) return resolve(notifications);

            if (field === 'actor') {
              const actorIds = [...new Set(notifications.map(n => n.actor).filter(Boolean))];
              if (ids.length > 0) {
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
