import { supabaseAdmin } from '../config/supabase.js';

class NotificationSubscriptionInstance {
  constructor(data) {
    Object.assign(this, data);
  }

  async save() {
    const payload = {
      user_id: this.user || this.userId || this.user_id,
      endpoint: this.endpoint,
      keys: this.keys,
      user_agent: this.userAgent || this.user_agent || null,
      updated_at: new Date()
    };

    const id = this.id || this._id;
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('notification_subscriptions')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapSubscriptionFromPostgres(data));
    } else {
      const { data, error } = await supabaseAdmin
        .from('notification_subscriptions')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapSubscriptionFromPostgres(data));
    }
    return this;
  }

  toObject() {
    return { ...this };
  }
}

function mapSubscriptionFromPostgres(row) {
  if (!row) return null;
  return new NotificationSubscriptionInstance({
    _id: row.id,
    id: row.id,
    user: row.user_id,
    userId: row.user_id,
    endpoint: row.endpoint,
    keys: row.keys,
    userAgent: row.user_agent,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null
  });
}

function mapSubscriptionFieldToPg(field) {
  const mapping = {
    _id: 'id',
    id: 'id',
    user: 'user_id',
    userId: 'user_id',
    endpoint: 'endpoint',
    keys: 'keys',
    userAgent: 'user_agent',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  };
  return mapping[field] || field;
}

function applySubscriptionFilters(q, query) {
  let res = q;
  for (const [key, value] of Object.entries(query)) {
    const pgKey = mapSubscriptionFieldToPg(key);

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
        const pgOrKey = mapSubscriptionFieldToPg(orKey);
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

const NotificationSubscription = {
  async findOne(query = {}) {
    let q = supabaseAdmin.from('notification_subscriptions').select('*');
    q = applySubscriptionFilters(q, query);
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

  async findOneAndUpdate(filter, update, options = {}) {
    // In services/notification.service.js:
    // NotificationSubscription.findOneAndUpdate({ endpoint }, { ... }, { upsert: true, new: true })
    let q = supabaseAdmin.from('notification_subscriptions').select('*');
    q = applySubscriptionFilters(q, filter);
    const { data: matched, error: findError } = await q.limit(1).maybeSingle();
    
    const payload = {};
    const setObj = update.$set || update;
    for (const [k, v] of Object.entries(setObj)) {
      if (!k.startsWith('$')) {
        payload[mapSubscriptionFieldToPg(k)] = v;
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
        // combine filter fields and update fields
        const insertPayload = { ...filter, ...payload };
        // map filter keys
        const pgInsertPayload = {};
        for (const [k, v] of Object.entries(insertPayload)) {
          pgInsertPayload[mapSubscriptionFieldToPg(k)] = v;
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
    const inst = new NotificationSubscriptionInstance(data);
    return inst.save();
  },

  async deleteMany(query = {}) {
    let q = supabaseAdmin.from('notification_subscriptions').delete();
    q = applySubscriptionFilters(q, query);
    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  find(query = {}) {
    let q = supabaseAdmin.from('notification_subscriptions').select('*');
    q = applySubscriptionFilters(q, query);

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          const mapped = (data || []).map(mapSubscriptionFromPostgres);
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
          const pgField = mapSubscriptionFieldToPg(field);
          q = q.order(pgField, { ascending: !desc });
        }
        return this;
      },
      lean() {
        return this;
      }
    };
    return builder;
  }
};

export default NotificationSubscription;
