import { supabaseAdmin } from '../config/supabase.js';

export function mapFriendRequestFromPostgres(row) {
  if (!row) return null;
  
  const reqObj = {
    _id: row.id,
    id: row.id,
    from: row.from_id,
    fromId: row.from_id,
    to: row.to_id,
    toId: row.to_id,
    status: row.status,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,

    async save() {
      const payload = {
        from_id: this.from_id || this.fromId || this.from?.id || this.from,
        to_id: this.to_id || this.toId || this.to?.id || this.to,
        status: this.status,
        updated_at: new Date()
      };
      
      const { data, error } = await supabaseAdmin
        .from('friend_requests')
        .update(payload)
        .eq('id', this.id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapFriendRequestFromPostgres(data));
      return this;
    },

    async populate(field) {
      if (field === 'from' || field === 'to') {
        const User = (await import('./User.js')).default;
        const val = this[field]?.id || this[field];
        if (val) {
          this[field] = await User.findById(val);
        }
      }
      return this;
    }
  };

  return reqObj;
}

const FriendRequest = {
  async exists(query = {}) {
    let q = supabaseAdmin.from('friend_requests').select('id');
    if (query.status) q = q.eq('status', query.status);
    if (query.$or) {
      const orStr = query.$or.map(o => {
        const parts = [];
        if (o.from) parts.push(`from_id.eq.${o.from}`);
        if (o.to) parts.push(`to_id.eq.${o.to}`);
        return parts.join(',');
      }).join(',');
      q = q.or(orStr);
    } else {
      if (query.from) q = q.eq('from_id', query.from);
      if (query.to) q = q.eq('to_id', query.to);
    }
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return !!data;
  },

  async findOne(query = {}) {
    let q = supabaseAdmin.from('friend_requests').select('*');
    
    if (query.$or) {
      const orStr = query.$or.map(o => {
        const parts = [];
        if (o.from) parts.push(`from_id.eq.${o.from}`);
        if (o.to) parts.push(`to_id.eq.${o.to}`);
        return parts.join(',');
      }).join(',');
      q = q.or(orStr);
    } else {
      if (query.from) q = q.eq('from_id', query.from);
      if (query.to) q = q.eq('to_id', query.to);
      if (query.status) q = q.eq('status', query.status);
    }

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
    const payload = {
      from_id: data.from,
      to_id: data.to,
      status: data.status || 'pending',
      updated_at: new Date()
    };
    const { data: row, error } = await supabaseAdmin
      .from('friend_requests')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return mapFriendRequestFromPostgres(row);
  },

  async deleteMany(query = {}) {
    let q = supabaseAdmin.from('friend_requests').delete();
    if (query.$or) {
      const orStr = query.$or.map(o => {
        const parts = [];
        if (o.from) parts.push(`from_id.eq.${o.from}`);
        if (o.to) parts.push(`to_id.eq.${o.to}`);
        return parts.join(',');
      }).join(',');
      q = q.or(orStr);
    } else {
      if (query.from) q = q.eq('from_id', query.from);
      if (query.to) q = q.eq('to_id', query.to);
    }
    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  async deleteOne(query = {}) {
    return this.deleteMany(query);
  },

  find(query = {}) {
    let q = supabaseAdmin.from('friend_requests').select('*');
    if (query.$or) {
      const orStr = query.$or.map(o => {
        const parts = [];
        if (o.from) parts.push(`from_id.eq.${o.from}`);
        if (o.to) parts.push(`to_id.eq.${o.to}`);
        return parts.join(',');
      }).join(',');
      q = q.or(orStr);
    } else {
      if (query.from) q = q.eq('from_id', query.from);
      if (query.to) q = q.eq('to_id', query.to);
      if (query.status) q = q.eq('status', query.status);
    }

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          resolve((data || []).map(mapFriendRequestFromPostgres));
        } catch (err) {
          reject(err);
        }
      },
      select() { return this; },
      limit(n) { q = q.limit(n); return this; },
      sort(sortArg) {
        if (sortArg) {
          let field = 'createdAt';
          let ascending = false;
          if (typeof sortArg === 'string') {
            const desc = sortArg.startsWith('-');
            field = desc ? sortArg.slice(1) : sortArg;
            ascending = !desc;
          } else if (typeof sortArg === 'object') {
            const keys = Object.keys(sortArg);
            if (keys.length > 0) {
              field = keys[0];
              ascending = sortArg[field] === 1 || sortArg[field] === 'asc';
            }
          }
          const pgField = field === 'createdAt' ? 'created_at' : (field === 'from' ? 'from_id' : 'to_id');
          q = q.order(pgField, { ascending });
        }
        return this;
      },
      lean() { return this; },
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
