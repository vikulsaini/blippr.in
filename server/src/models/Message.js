import { supabaseAdmin } from '../config/supabase.js';

export function mapMessageFromPostgres(row) {
  if (!row) return null;
  return {
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
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,

    async save() {
      const payload = {
        chat_id: this.chat || this.chatId || this.chat_id,
        sender_id: this.sender?.id || this.sender || this.senderId || this.sender_id,
        text: this.text || null,
        media: this.media || null,
        location: this.location || null,
        reply_to_id: this.replyTo?.id || this.replyTo || this.replyToId || this.reply_to_id || null,
        mentions: this.mentions || [],
        reactions: this.reactions || [],
        status: this.status || 'sent',
        seen_by: this.seenBy || [],
        deleted_for: this.deletedFor || [],
        edited_at: this.editedAt || null,
        deleted_at: this.deletedAt || null,
        updated_at: new Date()
      };

      const { data, error } = await supabaseAdmin
        .from('messages')
        .update(payload)
        .eq('id', this.id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapMessageFromPostgres(data));
      return this;
    }
  };
}

const Message = {
  async findOne(query = {}) {
    let q = supabaseAdmin.from('messages').select('*');
    if (query._id) q = q.eq('id', query._id);
    if (query.chatId) q = q.eq('chat_id', query.chatId);
    
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

  async findOneAndUpdate(filter = {}, update = {}, options = {}) {
    let q = supabaseAdmin.from('messages').select('*');
    if (filter._id) q = q.eq('id', filter._id);
    if (filter.chatId) q = q.eq('chat_id', filter.chatId);
    
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
    const { data: row, error } = await supabaseAdmin
      .from('messages')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return mapMessageFromPostgres(row);
  },

  async deleteMany(query = {}) {
    let q = supabaseAdmin.from('messages').delete();
    if (query.chatId) q = q.eq('chat_id', query.chatId);
    if (query.chat) q = q.eq('chat_id', query.chat);
    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  async updateMany(filter = {}, update = {}) {
    const payload = {};
    const setObj = update.$set || update;
    for (const [k, v] of Object.entries(setObj)) {
      if (!k.startsWith('$')) {
        payload[k === 'status' ? 'status' : k] = v;
      }
    }
    
    // map field names if needed
    const pgPayload = {};
    if (payload.status) pgPayload.status = payload.status;
    if (payload.seenBy) pgPayload.seen_by = payload.seenBy;
    if (payload.deletedFor) pgPayload.deleted_for = payload.deletedFor;
    
    let q = supabaseAdmin.from('messages').update(pgPayload);
    if (filter.chatId) q = q.eq('chat_id', filter.chatId);
    if (filter.chat) q = q.eq('chat_id', filter.chat);
    const { error } = await q;
    if (error) throw error;
    return { modifiedCount: 1 };
  },

  async countDocuments(query = {}) {
    let q = supabaseAdmin.from('messages').select('id', { count: 'exact', head: true });
    if (query.chatId) q = q.eq('chat_id', query.chatId);
    if (query.chat) q = q.eq('chat_id', query.chat);
    if (query.senderId) q = q.eq('sender_id', query.senderId);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  },

  find(query = {}) {
    let q = supabaseAdmin.from('messages').select('*');
    if (query.chatId) q = q.eq('chat_id', query.chatId);
    if (query.chat) q = q.eq('chat_id', query.chat);
    if (query._id) {
      if (query._id.$in) {
        q = q.in('id', query._id.$in);
      } else {
        q = q.eq('id', query._id);
      }
    }

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          resolve((data || []).map(mapMessageFromPostgres));
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
          q = q.order(field === 'createdAt' ? 'created_at' : field, { ascending: !desc });
        }
        return this;
      },
      lean() { return this; },
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
