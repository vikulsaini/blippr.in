import { callRepository } from '../repositories/call.repository.js';

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
      const updated = await callRepository.update(this.id, this);
      Object.assign(this, updated);
      return this;
    }
  };
}

const Call = {
  async findOne(query = {}) {
    return callRepository.findOne(query);
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
            populateCaller: populateFields.includes('caller'),
            populateReceiver: populateFields.includes('receiver'),
            limit: 1
          };
          const calls = await callRepository.find({ _id: id }, options);
          resolve(calls[0] || null);
        } catch (err) {
          reject(err);
        }
      }
    };
    return builder;
  },

  async findByIdAndUpdate(id, update = {}, options = {}) {
    return callRepository.update(id, update);
  },

  async create(data) {
    return callRepository.create(data);
  },

  async deleteMany(query = {}) {
    return callRepository.deleteMany(query);
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
        // field is space-separated fields, e.g. "caller receiver"
        const fields = field.split(' ');
        populateFields.push(...fields);
        return this;
      },
      async then(resolve, reject) {
        try {
          const options = {
            limit: limitVal,
            sort: sortVal,
            populateCaller: populateFields.includes('caller'),
            populateReceiver: populateFields.includes('receiver')
          };
          const res = await callRepository.find(query, options);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      }
    };
    return builder;
  }
};

export default Call;
