import { db } from '../config/database.js';
import { mapMessageFromPostgres } from '../models/Message.js';
import { mapUserFromPostgres } from '../utils/userMapper.js';

export const messageRepository = {
  /**
   * Find a single message.
   */
  async findOne(query = {}) {
    let q = db.from('messages').select('*');
    if (query._id || query.id) q = q.eq('id', query._id || query.id);
    if (query.chatId || query.chat) q = q.eq('chat_id', query.chatId || query.chat);

    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return mapMessageFromPostgres(data);
  },

  /**
   * Find message by ID.
   */
  async findById(id) {
    if (!id) return null;
    const { data, error } = await db
      .from('messages')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return mapMessageFromPostgres(data);
  },

  /**
   * Find a message and update (reactions, seen status, etc.)
   */
  async findOneAndUpdate(filter = {}, update = {}) {
    let q = db.from('messages').select('*');
    if (filter._id || filter.id) q = q.eq('id', filter._id || filter.id);
    if (filter.chatId || filter.chat) q = q.eq('chat_id', filter.chatId || filter.chat);

    const { data: matched, error: findError } = await q.limit(1).maybeSingle();
    if (findError || !matched) return null;

    let reactions = matched.reactions || [];
    let seenBy = matched.seen_by || [];
    let status = matched.status;
    let deletedFor = matched.deleted_for || [];
    let deletedAt = matched.deleted_at;

    if (update.$push) {
      if (update.$push.reactions) {
        reactions.push(update.$push.reactions);
      }
      if (update.$push.seenBy) {
        seenBy.push(update.$push.seenBy);
      }
    }

    if (update.$addToSet) {
      if (update.$addToSet.seenBy) {
        const val = update.$addToSet.seenBy;
        if (!seenBy.includes(val)) seenBy.push(val);
      }
      if (update.$addToSet.deletedFor) {
        const val = update.$addToSet.deletedFor;
        if (!deletedFor.includes(val)) deletedFor.push(val);
      }
    }

    if (update.$set) {
      if (update.$set.status) status = update.$set.status;
      if (update.$set.deletedAt) deletedAt = update.$set.deletedAt;
    }

    // Direct object assignments fallback
    if (update.status) status = update.status;
    if (update.reactions) reactions = update.reactions;
    if (update.seenBy) seenBy = update.seenBy;

    const { data: updatedRow, error: updateError } = await db
      .from('messages')
      .update({
        reactions,
        seen_by: seenBy,
        deleted_for: deletedFor,
        deleted_at: deletedAt,
        status,
        updated_at: new Date()
      })
      .eq('id', matched.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return mapMessageFromPostgres(updatedRow);
  },

  /**
   * Create a new message.
   */
  async create(data) {
    const payload = {
      chat_id: data.chat || data.chatId || data.chat_id,
      sender_id: data.sender || data.senderId || data.sender_id,
      text: data.text || null,
      media: data.media || null,
      location: data.location || null,
      reply_to_id: data.replyTo || data.replyToId || data.reply_to_id || null,
      mentions: data.mentions || [],
      reactions: data.reactions || [],
      status: data.status || 'sent',
      seen_by: data.seenBy || [],
      deleted_for: data.deletedFor || [],
      edited_at: data.editedAt || null,
      deleted_at: data.deletedAt || null,
      updated_at: new Date()
    };

    const { data: row, error } = await db
      .from('messages')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return mapMessageFromPostgres(row);
  },

  /**
   * Delete messages.
   */
  async deleteMany(query = {}) {
    let q = db.from('messages').delete();
    if (query.chatId || query.chat) q = q.eq('chat_id', query.chatId || query.chat);
    if (query.senderId || query.sender) q = q.eq('sender_id', query.senderId || query.sender);
    
    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  /**
   * Update multiple messages (seen receipts, etc.)
   */
  async updateMany(filter = {}, update = {}) {
    const payload = {};
    const setObj = update.$set || update;
    for (const [k, v] of Object.entries(setObj)) {
      if (!k.startsWith('$')) {
        let pgKey = k;
        if (k === 'seenBy') pgKey = 'seen_by';
        else if (k === 'deletedFor') pgKey = 'deleted_for';
        payload[pgKey] = v;
      }
    }

    let q = db.from('messages').update(payload);
    if (filter.chatId || filter.chat) q = q.eq('chat_id', filter.chatId || filter.chat);
    if (filter.senderId || filter.sender) q = q.eq('sender_id', filter.senderId || filter.sender);

    const { error } = await q;
    if (error) throw error;
    return { modifiedCount: 1 };
  },

  /**
   * Count messages.
   */
  async count(query = {}) {
    let q = db.from('messages').select('id', { count: 'exact', head: true });
    if (query.chatId || query.chat) q = q.eq('chat_id', query.chatId || query.chat);
    if (query.senderId || query.sender) q = q.eq('sender_id', query.senderId || query.sender);

    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  },

  /**
   * Find multiple messages, supporting relationship joins and cursor pagination.
   */
  async find(query = {}, options = {}) {
    let selectFields = '*';
    if (options.populateSender || options.populateReplyTo) {
      const parts = ['*'];
      if (options.populateSender) parts.push('sender:profiles(*)');
      if (options.populateReplyTo) parts.push('reply_to:messages(*)');
      selectFields = parts.join(',');
    }

    let q = db.from('messages').select(selectFields);

    if (query.chatId || query.chat) q = q.eq('chat_id', query.chatId || query.chat);
    
    if (query._id) {
      if (query._id.$in) {
        q = q.in('id', query._id.$in);
      } else {
        q = q.eq('id', query._id);
      }
    }

    if (query.createdAt && query.createdAt.$lt) {
      q = q.lt('created_at', new Date(query.createdAt.$lt).toISOString());
    }

    if (options.sort) {
      const sortStr = typeof options.sort === 'string' 
        ? options.sort 
        : (typeof options.sort === 'object' && options.sort !== null
            ? (Object.values(options.sort)[0] === -1 || String(Object.values(options.sort)[0]).toLowerCase() === 'desc' 
                ? `-${Object.keys(options.sort)[0]}` 
                : Object.keys(options.sort)[0]) 
            : '');
      
      const desc = sortStr.startsWith('-');
      const field = desc ? sortStr.slice(1) : sortStr;
      q = q.order(field === 'createdAt' ? 'created_at' : field, { ascending: !desc });
    }

    if (options.limit) {
      q = q.limit(options.limit);
    }

    const { data, error } = await q;
    if (error) throw error;

    const messages = (data || []).map(row => {
      const msg = mapMessageFromPostgres(row);
      
      // Map relations if they were returned in the single query
      if (row.sender && typeof row.sender === 'object') {
        msg.sender = mapUserFromPostgres(row.sender);
      }
      if (row.reply_to && typeof row.reply_to === 'object') {
        msg.replyTo = mapMessageFromPostgres(row.reply_to);
      }

      return msg;
    });

    return messages;
  }
};
