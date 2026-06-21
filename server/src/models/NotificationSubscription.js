import { supabaseAdmin } from '../config/supabase.js';

export function mapSubscriptionFromPostgres(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    user: row.user_id,
    userId: row.user_id,
    endpoint: row.endpoint,
    keys: row.keys,
    userAgent: row.user_agent,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,

    async save() {
      const payload = {
        user_id: this.user || this.userId || this.user_id,
        endpoint: this.endpoint,
        keys: this.keys,
        user_agent: this.userAgent || this.user_agent || null,
        updated_at: new Date()
      };

      const { data, error } = await supabaseAdmin
        .from('notification_subscriptions')
        .update(payload)
        .eq('id', this.id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapSubscriptionFromPostgres(data));
      return this;
    }
  };
}

const NotificationSubscription = {
  async findOne(query = {}) {
    let q = supabaseAdmin.from('notification_subscriptions').select('*');
    if (query._id) q = q.eq('id', query._id);
    if (query.endpoint) q = q.eq('endpoint', query.endpoint);
    if (query.user) q = q.eq('user_id', query.user);
    if (query.userId) q = q.eq('user_id', query.userId);
    
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return mapSubscriptionFromPostgres(data);
  },

  async findById(id) {
    if (!id) return null;
    const { data, error } = await supabaseAdmin
      .from('notification_subscriptions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return mapSubscriptionFromPostgres(data);
  },

  async findOneAndUpdate(filter = {}, update = {}, options = {}) {
    let q = supabaseAdmin.from('notification_subscriptions').select('*');
    if (filter.endpoint) q = q.eq('endpoint', filter.endpoint);
    if (filter.user) q = q.eq('user_id', filter.user);
    if (filter.userId) q = q.eq('user_id', filter.userId);
    
    const { data: matched, error: findError } = await q.limit(1).maybeSingle();
    if (findError) throw findError;

    const payload = {};
    const setObj = update.$set || update;
    for (const [k, v] of Object.entries(setObj)) {
      if (!k.startsWith('$')) {
        const pgKey = k === 'userAgent' ? 'user_agent' : k === 'userId' || k === 'user' ? 'user_id' : k;
        payload[pgKey] = v;
      }
    }

    if (matched) {
      const { data: updatedRow, error: updateError } = await supabaseAdmin
        .from('notification_subscriptions')
        .update(payload)
        .eq('id', matched.id)
        .select()
        .single();
      if (updateError) throw updateError;
      return mapSubscriptionFromPostgres(updatedRow);
    } else {
      if (options.upsert) {
        const insertPayload = { ...filter, ...payload };
        const pgInsertPayload = {};
        for (const [k, v] of Object.entries(insertPayload)) {
          const pgKey = k === 'userAgent' ? 'user_agent' : k === 'userId' || k === 'user' ? 'user_id' : k;
          pgInsertPayload[pgKey] = v;
        }

        const { data: insertedRow, error: insertError } = await supabaseAdmin
          .from('notification_subscriptions')
          .insert(pgInsertPayload)
          .select()
          .single();
        if (insertError) throw insertError;
        return mapSubscriptionFromPostgres(insertedRow);
      }
      return null;
    }
  },

  async create(data) {
    const payload = {
      user_id: data.user || data.userId || data.user_id,
      endpoint: data.endpoint,
      keys: data.keys,
      user_agent: data.userAgent || data.user_agent || null,
      updated_at: new Date()
    };
    const { data: row, error } = await supabaseAdmin
      .from('notification_subscriptions')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return mapSubscriptionFromPostgres(row);
  },

  async deleteMany(query = {}) {
    let q = supabaseAdmin.from('notification_subscriptions').delete();
    if (query.user) q = q.eq('user_id', query.user);
    if (query.userId) q = q.eq('user_id', query.userId);
    if (query.endpoint) q = q.eq('endpoint', query.endpoint);
    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  find(query = {}) {
    let q = supabaseAdmin.from('notification_subscriptions').select('*');
    if (query.user) q = q.eq('user_id', query.user);
    if (query.userId) q = q.eq('user_id', query.userId);

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          resolve((data || []).map(mapSubscriptionFromPostgres));
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
      lean() { return this; }
    };
    return builder;
  }
};

export default NotificationSubscription;
