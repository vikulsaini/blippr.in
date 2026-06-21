import { supabaseAdmin } from '../config/supabase.js';

export function mapCallFromPostgres(row) {
  if (!row) return null;
  return {
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
    durationSeconds: row.duration_seconds || 0,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,

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

      const { data, error } = await supabaseAdmin
        .from('calls')
        .update(payload)
        .eq('id', this.id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapCallFromPostgres(data));
      return this;
    }
  };
}

const Call = {
  async findOne(query = {}) {
    let q = supabaseAdmin.from('calls').select('*');
    if (query._id) q = q.eq('id', query._id);
    if (query.status) q = q.eq('status', query.status);
    
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
    const { data: row, error } = await supabaseAdmin
      .from('calls')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return mapCallFromPostgres(row);
  },

  async deleteMany(query = {}) {
    let q = supabaseAdmin.from('calls').delete();
    if (query.chatId) q = q.eq('chat_id', query.chatId);
    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  find(query = {}) {
    let q = supabaseAdmin.from('calls').select('*');
    if (query.chatId) q = q.eq('chat_id', query.chatId);
    
    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          resolve((data || []).map(mapCallFromPostgres));
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
          q = q.order(field === 'startedAt' ? 'started_at' : field, { ascending: !desc });
        }
        return this;
      },
      lean() { return this; },
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
