import { supabaseAdmin } from '../config/supabase.js';

class ChatInstance {
  constructor(data) {
    Object.assign(this, data);
  }

  async save() {
    const payload = {
      type: this.type,
      members: this.members || [],
      temporary: this.temporary ?? false,
      interests: this.interests || [],
      last_message_id: this.lastMessage || this.lastMessageId || this.last_message_id || null,
      last_call_id: this.lastCall || this.lastCallId || this.last_call_id || null,
      unread_counts: Object.fromEntries(this.unreadCounts instanceof Map ? this.unreadCounts : new Map(Object.entries(this.unreadCounts || {}))),
      nicknames: Object.fromEntries(this.nicknames instanceof Map ? this.nicknames : new Map(Object.entries(this.nicknames || {}))),
      hidden_for: this.hiddenFor || [],
      archived_for: this.archivedFor || [],
      pinned_for: this.pinnedFor || [],
      starred_for: this.starredFor || [],
      muted_for: this.mutedFor || [],
      disappearing_messages: Object.fromEntries(this.disappearingMessages instanceof Map ? this.disappearingMessages : new Map(Object.entries(this.disappearingMessages || {}))),
      wallpapers: Object.fromEntries(this.wallpapers instanceof Map ? this.wallpapers : new Map(Object.entries(this.wallpapers || {}))),
      expires_at: this.expiresAt || null,
      updated_at: new Date()
    };

    const id = this.id || this._id;
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('chats')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapChatFromPostgres(data));
    } else {
      const { data, error } = await supabaseAdmin
        .from('chats')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapChatFromPostgres(data));
    }
    return this;
  }

  toObject() {
    return { ...this };
  }
}

function mapChatFromPostgres(row) {
  if (!row) return null;
  const unreadCountsMap = new Map(Object.entries(row.unread_counts || {}));
  const nicknamesMap = new Map(Object.entries(row.nicknames || {}));
  const disappearingMessagesMap = new Map(Object.entries(row.disappearing_messages || {}));
  const wallpapersMap = new Map(Object.entries(row.wallpapers || {}));

  return new ChatInstance({
    _id: row.id,
    id: row.id,
    type: row.type,
    members: row.members || [],
    temporary: row.temporary,
    interests: row.interests || [],
    lastMessage: row.last_message_id,
    lastCall: row.last_call_id,
    unreadCounts: unreadCountsMap,
    nicknames: nicknamesMap,
    hiddenFor: row.hidden_for || [],
    archivedFor: row.archived_for || [],
    pinnedFor: row.pinned_for || [],
    starredFor: row.starred_for || [],
    mutedFor: row.muted_for || [],
    disappearingMessages: disappearingMessagesMap,
    wallpapers: wallpapersMap,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null
  });
}

function mapChatFieldToPg(field) {
  const mapping = {
    _id: 'id',
    id: 'id',
    type: 'type',
    members: 'members',
    temporary: 'temporary',
    interests: 'interests',
    lastMessage: 'last_message_id',
    lastCall: 'last_call_id',
    hiddenFor: 'hidden_for',
    archivedFor: 'archived_for',
    pinnedFor: 'pinned_for',
    starredFor: 'starred_for',
    mutedFor: 'muted_for',
    expiresAt: 'expires_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  };
  return mapping[field] || field;
}

function applyChatFilters(q, query) {
  let res = q;
  for (const [key, value] of Object.entries(query)) {
    const pgKey = mapChatFieldToPg(key);
    
    if (key === 'members' && value) {
      if (value.$all) {
        res = res.contains('members', value.$all);
      } else if (value.$nin) {
        if (Array.isArray(value.$nin) && value.$nin.length > 0) {
          res = res.not('members', 'cs', `{${value.$nin.join(',')}}`);
        }
      } else if (typeof value === 'string') {
        res = res.contains('members', [value]);
      } else if (Array.isArray(value)) {
        res = res.contains('members', value);
      } else {
        res = res.contains('members', [value.toString()]);
      }
      continue;
    }

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
        const pgOrKey = mapChatFieldToPg(orKey);
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

const Chat = {
  async findOne(query = {}) {
    let q = supabaseAdmin.from('chats').select('*');
    q = applyChatFilters(q, query);
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return mapChatFromPostgres(data);
  },

  async findById(id) {
    if (!id) return null;
    const { data, error } = await supabaseAdmin
      .from('chats')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return mapChatFromPostgres(data);
  },

  async create(data) {
    const inst = new ChatInstance(data);
    return inst.save();
  },

  async deleteOne(query) {
    let q = supabaseAdmin.from('chats').delete();
    q = applyChatFilters(q, query);
    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  async updateMany(filter, update) {
    if (update.$pull) {
      const field = Object.keys(update.$pull)[0];
      const val = update.$pull[field];
      const pgField = mapChatFieldToPg(field);
      
      let q = supabaseAdmin.from('chats').select('*');
      q = applyChatFilters(q, filter);
      const { data, error } = await q;
      if (error) throw error;
      
      for (const chat of (data || [])) {
        const updatedArr = (chat[pgField] || []).filter(item => item !== val);
        await supabaseAdmin
          .from('chats')
          .update({ [pgField]: updatedArr })
          .eq('id', chat.id);
      }
      return { modifiedCount: data?.length || 0 };
    }
    
    const payload = {};
    const setObj = update.$set || update;
    for (const [k, v] of Object.entries(setObj)) {
      if (!k.startsWith('$')) {
        payload[mapChatFieldToPg(k)] = v;
      }
    }
    let q = supabaseAdmin.from('chats').update(payload);
    q = applyChatFilters(q, filter);
    const { error } = await q;
    if (error) throw error;
    return { modifiedCount: 1 };
  },

  find(query = {}) {
    let q = supabaseAdmin.from('chats').select('*');
    q = applyChatFilters(q, query);

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          const mapped = (data || []).map(mapChatFromPostgres);
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
          const pgField = mapChatFieldToPg(field);
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
            const chats = await new Promise((res, rej) => originalThen(res, rej));
            if (chats.length === 0) return resolve(chats);

            if (field === 'members') {
              const memberIds = [...new Set(chats.flatMap(c => c.members))];
              if (memberIds.length > 0) {
                const User = (await import('./User.js')).default;
                const users = await User.find({ _id: { $in: memberIds } });
                const userMap = new Map(users.map(u => [u.id, u]));
                for (const chat of chats) {
                  chat.members = chat.members.map(id => userMap.get(id) || id);
                }
              }
            } else if (field === 'lastMessage') {
              const messageIds = chats.map(c => c.lastMessage).filter(Boolean);
              if (messageIds.length > 0) {
                const Message = (await import('./Message.js')).default;
                const messages = await Message.find({ _id: { $in: messageIds } });
                const messageMap = new Map(messages.map(m => [m.id, m]));
                for (const chat of chats) {
                  chat.lastMessage = messageMap.get(chat.lastMessage) || chat.lastMessage;
                }
              }
            } else if (field === 'lastCall') {
              const callIds = chats.map(c => c.lastCall).filter(Boolean);
              if (callIds.length > 0) {
                const Call = (await import('./Call.js')).default;
                const calls = await Call.find({ _id: { $in: callIds } });
                const callMap = new Map(calls.map(c => [c.id, c]));
                for (const chat of chats) {
                  chat.lastCall = callMap.get(chat.lastCall) || chat.lastCall;
                }
              }
            }
            resolve(chats);
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

export default Chat;
