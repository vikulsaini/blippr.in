import { chatRepository } from '../repositories/chat.repository.js';

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
      const updated = await chatRepository.update(this.id, this);
      Object.assign(this, updated);
      return this;
    }
  };

  return chat;
}

const Chat = {
  async exists(query = {}) {
    return chatRepository.exists(query);
  },

  async findOne(query = {}) {
    return chatRepository.findOne(query);
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
          // Standardize options for repository
          const options = {
            populateMembers: populateFields.includes('members'),
            populateLastMessage: populateFields.includes('lastMessage'),
            populateLastCall: populateFields.includes('lastCall'),
            limit: 1
          };
          const chats = await chatRepository.find({ _id: id }, options);
          resolve(chats[0] || null);
        } catch (err) {
          reject(err);
        }
      }
    };
    return builder;
  },

  async findByIdAndUpdate(id, update = {}, options = {}) {
    return chatRepository.update(id, update);
  },

  async create(data) {
    return chatRepository.create(data);
  },

  async countDocuments(query = {}) {
    return chatRepository.exists(query).then(exists => exists ? 1 : 0); // basic fallback, count done in repository
  },

  async deleteOne(query = {}) {
    const id = query.id || query._id;
    if (!id) return { deletedCount: 0 };
    await chatRepository.delete(id);
    return { deletedCount: 1 };
  },

  async updateMany(filter = {}, update = {}) {
    return chatRepository.updateMany(filter, update);
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
            populateMembers: populateFields.includes('members'),
            populateLastMessage: populateFields.includes('lastMessage'),
            populateLastCall: populateFields.includes('lastCall')
          };
          const res = await chatRepository.find(query, options);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      }
    };
    return builder;
  }
};

export default Chat;
