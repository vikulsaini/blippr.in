import { messageRepository } from '../repositories/message.repository.js';
import { mapUserFromPostgres } from '../utils/userMapper.js';

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
      const updated = await messageRepository.findOneAndUpdate({ id: this.id }, this);
      Object.assign(this, updated);
      return this;
    }
  };
}

const Message = {
  async findOne(query = {}) {
    return messageRepository.findOne(query);
  },

  findById(id) {
    let populateFields = [];
    const builder = {
      populate(field) {
        populateFields.push(field);
        return this;
      },
      select() { return this; },
      lean() { return this; },
      async then(resolve, reject) {
        try {
          if (!id) return resolve(null);
          const options = {
            populateSender: populateFields.includes('sender'),
            populateReplyTo: populateFields.includes('replyTo'),
            limit: 1
          };
          const messages = await messageRepository.find({ _id: id }, options);
          
          // Eagerly resolve replyTo's sender details if requested in populate chain
          const message = messages[0] || null;
          if (message && options.populateReplyTo && message.replyTo) {
            const User = (await import('./User.js')).default;
            const senderId = message.replyTo.sender;
            if (senderId && typeof senderId === 'string') {
              const u = await User.findById(senderId);
              message.replyTo.sender = u || senderId;
            }
          }
          
          resolve(message);
        } catch (err) {
          reject(err);
        }
      }
    };
    return builder;
  },

  async findOneAndUpdate(filter = {}, update = {}, options = {}) {
    return messageRepository.findOneAndUpdate(filter, update);
  },

  async create(data) {
    return messageRepository.create(data);
  },

  async deleteMany(query = {}) {
    return messageRepository.deleteMany(query);
  },

  async updateMany(filter = {}, update = {}) {
    return messageRepository.updateMany(filter, update);
  },

  async countDocuments(query = {}) {
    return messageRepository.count(query);
  },

  find(query = {}) {
    let limitVal = null;
    let sortVal = null;
    let populateFields = [];

    const builder = {
      limit(n) { limitVal = n; return this; },
      sort(s) { sortVal = s; return this; },
      select() { return this; },
      lean() { return this; },
      populate(field) {
        populateFields.push(field);
        return this;
      },
      async then(resolve, reject) {
        try {
          const options = {
            limit: limitVal,
            sort: sortVal,
            populateSender: populateFields.includes('sender'),
            populateReplyTo: populateFields.includes('replyTo')
          };
          const messages = await messageRepository.find(query, options);
          
          // Populate replyTo's sender if requested in populate chain
          if (options.populateReplyTo) {
            const replyToMessages = messages.filter(m => m.replyTo && typeof m.replyTo === 'object');
            const senderIds = [...new Set(replyToMessages.map(m => m.replyTo.sender).filter(s => typeof s === 'string'))];
            if (senderIds.length > 0) {
              const User = (await import('./User.js')).default;
              const users = await User.find({ _id: { $in: senderIds } });
              const userMap = new Map(users.map(u => [u.id, u]));
              for (const m of replyToMessages) {
                m.replyTo.sender = userMap.get(m.replyTo.sender) || m.replyTo.sender;
              }
            }
          }
          
          resolve(messages);
        } catch (err) {
          reject(err);
        }
      }
    };
    return builder;
  }
};

export default Message;
