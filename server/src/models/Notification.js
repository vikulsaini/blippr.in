import { notificationRepository } from '../repositories/notification.repository.js';

export function mapNotificationFromPostgres(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    user: row.user_id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    url: row.url,
    requestId: row.request_id,
    chatId: row.chat_id,
    messageId: row.message_id,
    callId: row.call_id,
    actor: row.actor_id,
    readAt: row.read_at ? new Date(row.read_at) : null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,

    async save() {
      const updated = await notificationRepository.update(this.id, this);
      Object.assign(this, updated);
      return this;
    }
  };
}

const Notification = {
  async findOne(query = {}) {
    return notificationRepository.findOne(query);
  },

  async findById(id) {
    return notificationRepository.findById(id);
  },

  async create(data) {
    return notificationRepository.create(data);
  },

  async countDocuments(query = {}) {
    return notificationRepository.count(query);
  },

  async updateMany(filter = {}, update = {}) {
    return notificationRepository.updateMany(filter, update);
  },

  async deleteMany(query = {}) {
    return notificationRepository.deleteMany(query);
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
            populateActor: populateFields.includes('actor')
          };
          const res = await notificationRepository.find(query, options);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      }
    };
    return builder;
  }
};

export default Notification;
