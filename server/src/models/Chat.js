import { supabaseAdmin } from '../config/supabase.js';

export function mapChatFromPostgres(row) {
  if (!row) return null;
  const unreadCountsMap = new Map(Object.entries(row.unread_counts || {}));
  const nicknamesMap = new Map(Object.entries(row.nicknames || {}));
  const disappearingMessagesMap = new Map(Object.entries(row.disappearing_messages || {}));
  const wallpapersMap = new Map(Object.entries(row.wallpapers || {}));

  const chat = {
    _id: row.id,
    id: row.id,
    type: row.type,
    members: row.members || [],
    temporary: row.temporary ?? false,
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
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,

    async save() {
      const payload = {
        type: this.type,
        members: this.members || [],
        temporary: this.temporary ?? false,
        interests: this.interests || [],
        last_message_id: this.lastMessage?.id || this.lastMessage || null,
        last_call_id: this.lastCall?.id || this.lastCall || null,
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

      const { data, error } = await supabaseAdmin
        .from('chats')
        .update(payload)
        .eq('id', this.id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapChatFromPostgres(data));
      return this;
    }
  };

  return chat;
}

const Chat = {
  async exists(query = {}) {
    let q = supabaseAdmin.from('chats').select('id');
    if (query.type) q = q.eq('type', query.type);
    if (query.members) {
      if (query.members.$all) {
        q = q.contains('members', query.members.$all);
      } else {
        q = q.contains('members', [query.members]);
      }
    }
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return !!data;
  },

  async findOne(query = {}) {
    let q = supabaseAdmin.from('chats').select('*');
    if (query._id) {
      q = q.eq('id', query._id);
    } else if (query.members) {
      if (query.members.$all) {
        q = q.contains('members', query.members.$all);
      } else {
        q = q.contains('members', [query.members]);
      }
    }
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return mapChatFromPostgres(data);
  },

  findById(id) {
    let q = supabaseAdmin.from('chats').select('*');
    if (id) {
      q = q.eq('id', id);
    }
    const builder = {
      async then(resolve, reject) {
        try {
          if (!id) return resolve(null);
          const { data, error } = await q.maybeSingle();
          if (error) throw error;
          resolve(mapChatFromPostgres(data));
        } catch (err) {
          reject(err);
        }
      },
      select() { return this; },
      lean() { return this; },
      populate(field) {
        const originalThen = this.then;
        this.then = async (resolve, reject) => {
          try {
            const chat = await new Promise((res, rej) => originalThen(res, rej));
            if (!chat) return resolve(null);
            
            if (field === 'members') {
              const memberIds = chat.members || [];
              if (memberIds.length > 0) {
                const User = (await import('./User.js')).default;
                const users = await User.find({ _id: { $in: memberIds } });
                const userMap = new Map(users.map(u => [u.id, u]));
                chat.members = chat.members.map(mid => userMap.get(mid) || mid);
              }
            } else if (field === 'lastMessage') {
              if (chat.lastMessage) {
                const Message = (await import('./Message.js')).default;
                const msg = await Message.findById(chat.lastMessage);
                chat.lastMessage = msg || chat.lastMessage;
              }
            } else if (field === 'lastCall') {
              if (chat.lastCall) {
                const Call = (await import('./Call.js')).default;
                const call = await Call.findById(chat.lastCall);
                chat.lastCall = call || chat.lastCall;
              }
            }
            resolve(chat);
          } catch (err) {
            reject(err);
          }
        };
        return this;
      }
    };
    return builder;
  },

  async findByIdAndUpdate(id, update = {}, options = {}) {
    const payload = {};
    const setObj = update.$set || update;
    for (const [k, v] of Object.entries(setObj)) {
      if (!k.startsWith('$')) {
        let pgKey = k;
        if (k === 'lastCall') pgKey = 'last_call_id';
        else if (k === 'lastMessage') pgKey = 'last_message_id';
        payload[pgKey] = v;
      }
    }
    
    const { error } = await supabaseAdmin
      .from('chats')
      .update(payload)
      .eq('id', id);
    if (error) throw error;
    
    return this.findById(id);
  },

  async create(data) {
    const payload = {
      type: data.type,
      members: data.members || [],
      temporary: data.temporary ?? false,
      interests: data.interests || [],
      unread_counts: data.unreadCounts || {},
      nicknames: data.nicknames || {},
      hidden_for: data.hiddenFor || [],
      archived_for: data.archivedFor || [],
      pinned_for: data.pinnedFor || [],
      starred_for: data.starredFor || [],
      muted_for: data.mutedFor || [],
      disappearing_messages: data.disappearingMessages || {},
      wallpapers: data.wallpapers || {},
      expires_at: data.expiresAt || null,
      updated_at: new Date()
    };
    const { data: row, error } = await supabaseAdmin
      .from('chats')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return mapChatFromPostgres(row);
  },

  async countDocuments(query = {}) {
    let q = supabaseAdmin.from('chats').select('id', { count: 'exact', head: true });
    if (query.members) {
      if (query.members.$all) {
        q = q.contains('members', query.members.$all);
      } else {
        q = q.contains('members', [query.members]);
      }
    }
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  },

  async deleteOne(query = {}) {
    const id = query.id || query._id;
    if (!id) return { deletedCount: 0 };
    const { error } = await supabaseAdmin
      .from('chats')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { deletedCount: 1 };
  },

  async updateMany(filter = {}, update = {}) {
    if (update.$pull) {
      const field = Object.keys(update.$pull)[0];
      const val = update.$pull[field];
      
      const chats = await this.find(filter);
      let modifiedCount = 0;
      for (const chat of chats) {
        const updatedArr = (chat[field] || []).filter(item => item !== val);
        const { error } = await supabaseAdmin
          .from('chats')
          .update({ [field]: updatedArr })
          .eq('id', chat.id);
        if (error) throw error;
        modifiedCount++;
      }
      return { modifiedCount };
    }
    
    const payload = {};
    const setObj = update.$set || update;
    for (const [k, v] of Object.entries(setObj)) {
      if (!k.startsWith('$')) {
        payload[k] = v;
      }
    }
    
    let q = supabaseAdmin.from('chats').update(payload);
    if (filter._id) q = q.eq('id', filter._id);
    const { error, data } = await q;
    if (error) throw error;
    return { modifiedCount: data?.length || 1 };
  },

  find(query = {}) {
    let q = supabaseAdmin.from('chats').select('*');

    const applyFilters = (filters) => {
      for (const f of filters) {
        if (!f) continue;
        if (f.members) {
          if (f.members.$all) {
            q = q.contains('members', f.members.$all);
          } else if (f.members.$nin) {
            q = q.not('members', 'cs', `{${f.members.$nin.join(',')}}`);
          } else {
            q = q.contains('members', [f.members]);
          }
        }
        if (f._id) {
          if (f._id.$in) {
            q = q.in('id', f._id.$in);
          } else {
            q = q.eq('id', f._id);
          }
        }
        if (f.type) {
          q = q.eq('type', f.type);
        }
        if (f.temporary !== undefined) {
          if (f.temporary && f.temporary.$ne !== undefined) {
            q = q.neq('temporary', f.temporary.$ne);
          } else {
            q = q.eq('temporary', f.temporary);
          }
        }
        if (f.hiddenFor) {
          if (f.hiddenFor.$ne) {
            q = q.not('hidden_for', 'cs', `{${f.hiddenFor.$ne}}`);
          } else {
            q = q.contains('hidden_for', [f.hiddenFor]);
          }
        }
        if (f.archivedFor) {
          if (f.archivedFor.$ne) {
            q = q.not('archived_for', 'cs', `{${f.archivedFor.$ne}}`);
          } else {
            q = q.contains('archived_for', [f.archivedFor]);
          }
        }
        if (f.updatedAt) {
          if (f.updatedAt.$lt) {
            q = q.lt('updated_at', f.updatedAt.$lt instanceof Date ? f.updatedAt.$lt.toISOString() : f.updatedAt.$lt);
          }
        }
      }
    };

    if (query.$and) {
      applyFilters(query.$and);
    } else {
      applyFilters([query]);
    }

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          resolve((data || []).map(mapChatFromPostgres));
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
          q = q.order(field === 'updatedAt' ? 'updated_at' : field, { ascending: !desc });
        }
        return this;
      },
      lean() { return this; },
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
