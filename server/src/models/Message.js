import { supabaseAdmin } from '../config/supabase.js';

class MessageInstance {
  constructor(data) {
    Object.assign(this, data);
  }

  async save() {
    const payload = {
      chat_id: this.chat || this.chatId || this.chat_id,
      sender_id: this.sender || this.senderId || this.sender_id,
      text: this.text || null,
      media: this.media || null,
      location: this.location || null,
      reply_to_id: this.replyTo || this.replyToId || this.reply_to_id || null,
      mentions: this.mentions || [],
      reactions: this.reactions || [],
      status: this.status || 'sent',
      seen_by: this.seenBy || [],
      deleted_for: this.deletedFor || [],
      edited_at: this.editedAt || null,
      deleted_at: this.deletedAt || null,
      updated_at: new Date()
    };

    const id = this.id || this._id;
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapMessageFromPostgres(data));
    } else {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapMessageFromPostgres(data));
    }
    return this;
  }

  toObject() {
    return { ...this };
  }
}

function mapMessageFromPostgres(row) {
  if (!row) return null;
  return new MessageInstance({
    _id: row.id,
    id: row.id,
    chat: row.chat_id,
    chatId: row.chat_id,
    sender: row.sender_id,
    senderId: row.sender_id,
    text: row.text,
    media: row.media,
    location: row.location,
    replyTo: row.reply_to_id,
    replyToId: row.reply_to_id,
    mentions: row.mentions || [],
    reactions: row.reactions || [],
    status: row.status,
    seenBy: row.seen_by || [],
    deletedFor: row.deleted_for || [],
    editedAt: row.edited_at ? new Date(row.edited_at) : null,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null
  });
}

function mapMessageFieldToPg(field) {
  const mapping = {
    _id: 'id',
    id: 'id',
    chat: 'chat_id',
    chatId: 'chat_id',
    sender: 'sender_id',
    senderId: 'sender_id',
    text: 'text',
    media: 'media',
    location: 'location',
    replyTo: 'reply_to_id',
    replyToId: 'reply_to_id',
    status: 'status',
    seenBy: 'seen_by',
    deletedFor: 'deleted_for',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  };
  return mapping[field] || field;
}

function applyMessageFilters(q, query) {
  let res = q;
  for (const [key, value] of Object.entries(query)) {
    const pgKey = mapMessageFieldToPg(key);

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
        } else if (op === '$all') {
          res = res.contains(pgKey, val);
        }
      }
    } else if (key === '$or') {
      const orStrings = value.map(filterObj => {
        const [orKey, orVal] = Object.entries(filterObj)[0];
        const pgOrKey = mapMessageFieldToPg(orKey);
        
        // seenBy: userId in Mongo -> seen_by GIN array contains [userId] in Postgres
        if (orKey === 'seenBy') {
          return `${pgOrKey}.cs.{${orVal}}`;
        }
        if (orKey === 'sender') {
          return `${pgOrKey}.eq.${orVal}`;
        }
        
        return `${pgOrKey}.eq.${orVal}`;
      });
      res = res.or(orStrings.join(','));
    } else if (key === 'seenBy' || key === 'deletedFor' || key === 'mentions') {
      // Array field contains val
      res = res.contains(pgKey, [value]);
    } else {
      res = res.eq(pgKey, value);
    }
  }
  return res;
}

const Message = {
  async findOne(query = {}) {
    let q = supabaseAdmin.from('messages').select('*');
    q = applyMessageFilters(q, query);
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return mapMessageFromPostgres(data);
  },

  async findById(id) {
    if (!id) return null;
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return mapMessageFromPostgres(data);
  },

  async findOneAndUpdate(filter, update, options = {}) {
    // Message.findOneAndUpdate is called in sockets/index.js to update reaction or seen status
    // Mongoose update is like { $push: { reactions: ... } } or similar
    // Let's implement specific handling for reactions:
    let q = supabaseAdmin.from('messages').select('*');
    q = applyMessageFilters(q, filter);
    const { data: matched, error: findError } = await q.limit(1).maybeSingle();
    if (findError || !matched) return null;

    let reactions = matched.reactions || [];
    let seenBy = matched.seen_by || [];
    let status = matched.status;

    if (update.$push && update.$push.reactions) {
      reactions.push(update.$push.reactions);
    } else if (update.$push && update.$push.seenBy) {
      seenBy.push(update.$push.seenBy);
    }

    if (update.$set) {
      if (update.$set.status) status = update.$set.status;
    }

    const { data: updatedRow, error: updateError } = await supabaseAdmin
      .from('messages')
      .update({
        reactions,
        seen_by: seenBy,
        status,
        updated_at: new Date()
      })
      .eq('id', matched.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return mapMessageFromPostgres(updatedRow);
  },

  async create(data) {
    const inst = new MessageInstance(data);
    return inst.save();
  },

  async deleteMany(query = {}) {
    let q = supabaseAdmin.from('messages').delete();
    q = applyMessageFilters(q, query);
    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  async updateMany(filter, update) {
    const payload = {};
    const setObj = update.$set || update;
    for (const [k, v] of Object.entries(setObj)) {
      if (!k.startsWith('$')) {
        payload[mapMessageFieldToPg(k)] = v;
      }
    }
    let q = supabaseAdmin.from('messages').update(payload);
    q = applyMessageFilters(q, filter);
    const { error } = await q;
    if (error) throw error;
    return { modifiedCount: 1 };
  },

  async countDocuments(query = {}) {
    let q = supabaseAdmin.from('messages').select('id', { count: 'exact', head: true });
    q = applyMessageFilters(q, query);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  },

  find(query = {}) {
    let q = supabaseAdmin.from('messages').select('*');
    q = applyMessageFilters(q, query);

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          const mapped = (data || []).map(mapMessageFromPostgres);
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
          const pgField = mapMessageFieldToPg(field);
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
            const messages = await new Promise((res, rej) => originalThen(res, rej));
            if (messages.length === 0) return resolve(messages);

            if (field === 'sender') {
              const senderIds = [...new Set(messages.map(m => m.sender).filter(Boolean))];
              if (senderIds.length > 0) {
                const User = (await import('./User.js')).default;
                const users = await User.find({ _id: { $in: senderIds } });
                const userMap = new Map(users.map(u => [u.id, u]));
                for (const message of messages) {
                  message.sender = userMap.get(message.sender) || message.sender;
                }
              }
            } else if (field === 'replyTo') {
              const replyToIds = [...new Set(messages.map(m => m.replyTo).filter(Boolean))];
              if (replyToIds.length > 0) {
                const MessageModel = (await import('./Message.js')).default;
                const replies = await MessageModel.find({ _id: { $in: replyToIds } }).populate('sender');
                const replyMap = new Map(replies.map(r => [r.id, r]));
                for (const message of messages) {
                  message.replyTo = replyMap.get(message.replyTo) || message.replyTo;
                }
              }
            }
            resolve(messages);
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

export default Message;
