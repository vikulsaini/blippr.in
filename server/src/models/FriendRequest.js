import { supabaseAdmin } from '../config/supabase.js';

class FriendRequestInstance {
  constructor(data) {
    Object.assign(this, data);
  }

  async save() {
    const payload = {
      from_id: this.from || this.fromId || this.from_id,
      to_id: this.to || this.toId || this.to_id,
      status: this.status || 'pending',
      updated_at: new Date()
    };

    const id = this.id || this._id;
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('friend_requests')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapFriendRequestFromPostgres(data));
    } else {
      const { data, error } = await supabaseAdmin
        .from('friend_requests')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapFriendRequestFromPostgres(data));
    }
    return this;
  }

  toObject() {
    return { ...this };
  }

  async populate(field) {
    if (field === 'from') {
      const User = (await import('./User.js')).default;
      this.from = await User.findById(this.from);
    } else if (field === 'to') {
      const User = (await import('./User.js')).default;
      this.to = await User.findById(this.to);
    }
    return this;
  }
}

function mapFriendRequestFromPostgres(row) {
  if (!row) return null;
  return new FriendRequestInstance({
    _id: row.id,
    id: row.id,
    from: row.from_id,
    fromId: row.from_id,
    to: row.to_id,
    toId: row.to_id,
    status: row.status,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null
  });
}

function mapFriendRequestFieldToPg(field) {
  const mapping = {
    _id: 'id',
    id: 'id',
    from: 'from_id',
    fromId: 'from_id',
    to: 'to_id',
    toId: 'to_id',
    status: 'status',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  };
  return mapping[field] || field;
}

function applyFriendRequestFilters(q, query) {
  let res = q;
  for (const [key, value] of Object.entries(query)) {
    const pgKey = mapFriendRequestFieldToPg(key);

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
        const pgOrKey = mapFriendRequestFieldToPg(orKey);
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

const FriendRequest = {
  async findOne(query = {}) {
    let q = supabaseAdmin.from('friend_requests').select('*');
    q = applyFriendRequestFilters(q, query);
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return mapFriendRequestFromPostgres(data);
  },

  async findById(id) {
    if (!id) return null;
    const { data, error } = await supabaseAdmin
      .from('friend_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return mapFriendRequestFromPostgres(data);
  },

  async create(data) {
    const inst = new FriendRequestInstance(data);
    return inst.save();
  },

  async deleteMany(query = {}) {
    let q = supabaseAdmin.from('friend_requests').delete();
    q = applyFriendRequestFilters(q, query);
    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  async deleteOne(query = {}) {
    let q = supabaseAdmin.from('friend_requests').delete();
    q = applyFriendRequestFilters(q, query);
    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  find(query = {}) {
    let q = supabaseAdmin.from('friend_requests').select('*');
    q = applyFriendRequestFilters(q, query);

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          const mapped = (data || []).map(mapFriendRequestFromPostgres);
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
          const pgField = mapFriendRequestFieldToPg(field);
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
            const requests = await new Promise((res, rej) => originalThen(res, rej));
            if (requests.length === 0) return resolve(requests);

            if (field === 'from' || field === 'to') {
              const ids = [...new Set(requests.map(r => r[field]).filter(Boolean))];
              if (ids.length > 0) {
                const User = (await import('./User.js')).default;
                const users = await User.find({ _id: { $in: ids } });
                const userMap = new Map(users.map(u => [u.id, u]));
                for (const reqObj of requests) {
                  reqObj[field] = userMap.get(reqObj[field]) || reqObj[field];
                }
              }
            }
            resolve(requests);
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

export default FriendRequest;
