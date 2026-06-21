import { friendRepository } from '../repositories/friend.repository.js';

export function mapFriendRequestFromPostgres(row) {
  if (!row) return null;
  
  const reqObj = {
    _id: row.id,
    id: row.id,
    from: row.from_id,
    fromId: row.from_id,
    to: row.to_id,
    toId: row.to_id,
    status: row.status,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,

    async save() {
      const updated = await friendRepository.update(this.id, this.status);
      Object.assign(this, updated);
      return this;
    },

    async populate(field) {
      if (field === 'from' || field === 'to') {
        const User = (await import('./User.js')).default;
        const val = this[field]?.id || this[field];
        if (val) {
          this[field] = await User.findById(val);
        }
      }
      return this;
    }
  };

  return reqObj;
}

const FriendRequest = {
  async exists(query = {}) {
    return friendRepository.exists(query);
  },

  async findOne(query = {}) {
    return friendRepository.findOne(query);
  },

  async findById(id) {
    return friendRepository.findById(id);
  },

  async create(data) {
    return friendRepository.create(data);
  },

  async deleteMany(query = {}) {
    return friendRepository.deleteMany(query);
  },

  async deleteOne(query = {}) {
    return friendRepository.deleteMany(query);
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
            populateFrom: populateFields.includes('from'),
            populateTo: populateFields.includes('to')
          };
          const res = await friendRepository.find(query, options);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      }
    };
    return builder;
  }
};

export default FriendRequest;
