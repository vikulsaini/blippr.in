import { db } from '../config/database.js';
import { mapChatFromPostgres } from '../models/Chat.js';
import { mapUserFromPostgres } from '../utils/userMapper.js';
import { mapMessageFromPostgres } from '../models/Message.js';
import { mapCallFromPostgres } from '../models/Call.js';

export const chatRepository = {
  /**
   * Check if a chat exists.
   */
  async exists(query = {}) {
    let q = db.from('chats').select('id');
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

  /**
   * Find a single chat.
   */
  async findOne(query = {}) {
    let q = db.from('chats').select('*');
    if (query._id || query.id) q = q.eq('id', query._id || query.id);
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
    return mapChatFromPostgres(data);
  },

  /**
   * Find chat by ID.
   */
  async findById(id) {
    if (!id) return null;
    const { data, error } = await db
      .from('chats')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return mapChatFromPostgres(data);
  },

  /**
   * Create a new chat.
   */
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
    const { data: row, error } = await db
      .from('chats')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return mapChatFromPostgres(row);
  },

  /**
   * Update chat fields.
   */
  async update(id, updateData = {}) {
    const payload = {};
    const setObj = updateData.$set || updateData;
    for (const [k, v] of Object.entries(setObj)) {
      if (!k.startsWith('$')) {
        let pgKey = k;
        if (k === 'lastCall') pgKey = 'last_call_id';
        else if (k === 'lastMessage') pgKey = 'last_message_id';
        else if (k === 'hiddenFor') pgKey = 'hidden_for';
        else if (k === 'archivedFor') pgKey = 'archived_for';
        else if (k === 'pinnedFor') pgKey = 'pinned_for';
        else if (k === 'starredFor') pgKey = 'starred_for';
        else if (k === 'mutedFor') pgKey = 'muted_for';
        else if (k === 'unreadCounts') pgKey = 'unread_counts';
        else if (k === 'nicknames') pgKey = 'nicknames';
        
        // Convert Map back to plain object for JSONB
        if (v instanceof Map) {
          payload[pgKey] = Object.fromEntries(v);
        } else {
          payload[pgKey] = v;
        }
      }
    }

    const { data, error } = await db
      .from('chats')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return mapChatFromPostgres(data);
  },

  /**
   * Update multiple chats.
   */
  async updateMany(filter = {}, update = {}) {
    if (update.$pull) {
      const field = Object.keys(update.$pull)[0];
      const val = update.$pull[field];
      
      const chats = await this.find(filter);
      let modifiedCount = 0;
      for (const chat of chats) {
        const pgField = field === 'hiddenFor' ? 'hidden_for' : (field === 'archivedFor' ? 'archived_for' : field);
        const updatedArr = (chat[field] || []).filter(item => item !== val);
        const { error } = await db
          .from('chats')
          .update({ [pgField]: updatedArr })
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
        let pgKey = k;
        if (k === 'hiddenFor') pgKey = 'hidden_for';
        else if (k === 'archivedFor') pgKey = 'archived_for';
        payload[pgKey] = v;
      }
    }

    let q = db.from('chats').update(payload);
    if (filter._id) q = q.eq('id', filter._id);
    if (filter.members) {
      q = q.contains('members', [filter.members]);
    }
    const { error, data } = await q;
    if (error) throw error;
    return { modifiedCount: data?.length || 1 };
  },

  /**
   * Delete a chat.
   */
  async delete(id) {
    const { error } = await db
      .from('chats')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  /**
   * Find multiple chats.
   */
  async find(query = {}, options = {}) {
    let selectFields = '*';
    if (options.populateMembers || options.populateLastMessage || options.populateLastCall) {
      // PostgREST sub-resource joins
      const parts = ['*'];
      if (options.populateLastMessage) parts.push('last_message:messages!last_message_id(*)');
      if (options.populateLastCall) parts.push('last_call:calls!last_call_id(*)');
      selectFields = parts.join(',');
    }

    let q = db.from('chats').select(selectFields);

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

    if (options.sort) {
      const desc = options.sort.startsWith('-');
      const field = desc ? options.sort.slice(1) : options.sort;
      q = q.order(field === 'updatedAt' ? 'updated_at' : field, { ascending: !desc });
    }

    if (options.limit) {
      q = q.limit(options.limit);
    }

    const { data, error } = await q;
    if (error) throw error;

    const chats = (data || []).map(row => {
      const chat = mapChatFromPostgres(row);
      
      // Map relations if they were loaded in the single query
      if (row.last_message && typeof row.last_message === 'object') {
        chat.lastMessage = mapMessageFromPostgres(row.last_message);
      }
      if (row.last_call && typeof row.last_call === 'object') {
        chat.lastCall = mapCallFromPostgres(row.last_call);
      }
      
      return chat;
    });

    // Populate members (profiles) if requested
    if (options.populateMembers && chats.length > 0) {
      const memberIds = [...new Set(chats.flatMap(c => c.members))];
      if (memberIds.length > 0) {
        const { data: users, error: usersError } = await db
          .from('profiles')
          .select('*')
          .in('id', memberIds);
        
        if (usersError) throw usersError;
        
        const userMap = new Map(users.map(u => [u.id, mapUserFromPostgres(u)]));
        for (const chat of chats) {
          chat.members = chat.members.map(id => userMap.get(id) || id);
        }
      }
    }

    return chats;
  }
};
