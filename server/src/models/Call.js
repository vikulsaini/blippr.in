import { supabaseAdmin } from '../config/supabase.js';

class CallInstance {
  constructor(data) {
    Object.assign(this, data);
  }

  async save() {
    const payload = {
      caller_id: this.caller || this.callerId || this.caller_id,
      receiver_id: this.receiver || this.receiverId || this.receiver_id,
      chat_id: this.chat || this.chatId || this.chat_id || null,
      type: this.type,
      status: this.status || 'ringing',
      started_at: this.startedAt || new Date(),
      answered_at: this.answeredAt || null,
      ended_at: this.endedAt || null,
      duration_seconds: this.durationSeconds || 0,
      updated_at: new Date()
    };

    const id = this.id || this._id;
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('calls')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapCallFromPostgres(data));
    } else {
      const { data, error } = await supabaseAdmin
        .from('calls')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapCallFromPostgres(data));
    }
    return this;
  }

  toObject() {
    return { ...this };
  }
}

function mapCallFromPostgres(row) {
  if (!row) return null;
  return new CallInstance({
    _id: row.id,
    id: row.id,
    caller: row.caller_id,
    callerId: row.caller_id,
    receiver: row.receiver_id,
    receiverId: row.receiver_id,
    chat: row.chat_id,
    chatId: row.chat_id,
    type: row.type,
    status: row.status,
    startedAt: row.started_at ? new Date(row.started_at) : null,
    answeredAt: row.answered_at ? new Date(row.answered_at) : null,
    endedAt: row.ended_at ? new Date(row.ended_at) : null,
    durationSeconds: row.duration_seconds,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null
  });
}

function mapCallFieldToPg(field) {
  const mapping = {
    _id: 'id',
    id: 'id',
    caller: 'caller_id',
    callerId: 'caller_id',
    receiver: 'receiver_id',
    receiverId: 'receiver_id',
    chat: 'chat_id',
    chatId: 'chat_id',
    type: 'type',
    status: 'status',
    startedAt: 'started_at',
    answeredAt: 'answered_at',
    endedAt: 'ended_at',
    durationSeconds: 'duration_seconds',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  };
  return mapping[field] || field;
}

function applyCallFilters(q, query) {
  let res = q;
  for (const [key, value] of Object.entries(query)) {
    const pgKey = mapCallFieldToPg(key);

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
        const pgOrKey = mapCallFieldToPg(orKey);
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

const Call = {
  async findOne(query = {}) {
    let q = supabaseAdmin.from('calls').select('*');
    q = applyCallFilters(q, query);
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return mapCallFromPostgres(data);
  },

  async findById(id) {
    if (!id) return null;
    const { data, error } = await supabaseAdmin
      .from('calls')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return mapCallFromPostgres(data);
  },

  async create(data) {
    const inst = new CallInstance(data);
    return inst.save();
  },

  async deleteMany(query = {}) {
    let q = supabaseAdmin.from('calls').delete();
    q = applyCallFilters(q, query);
    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  find(query = {}) {
    let q = supabaseAdmin.from('calls').select('*');
    q = applyCallFilters(q, query);

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          const mapped = (data || []).map(mapCallFromPostgres);
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
          const pgField = mapCallFieldToPg(field);
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
            const calls = await new Promise((res, rej) => originalThen(res, rej));
            if (calls.length === 0) return resolve(calls);

            const fields = field.split(' ');
            for (const f of fields) {
              if (f === 'caller' || f === 'receiver') {
                const ids = [...new Set(calls.map(c => c[f]).filter(Boolean))];
                if (ids.length > 0) {
                  const User = (await import('./User.js')).default;
                  const users = await User.find({ _id: { $in: ids } });
                  const userMap = new Map(users.map(u => [u.id, u]));
                  for (const call of calls) {
                    call[f] = userMap.get(call[f]) || call[f];
                  }
                }
              }
            }
            resolve(calls);
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

export default Call;
