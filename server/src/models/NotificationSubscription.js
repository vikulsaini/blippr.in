import { auditRepository } from '../repositories/audit.repository.js';


export function mapSubscriptionFromPostgres(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    user: row.user_id,
    userId: row.user_id,
    endpoint: row.endpoint,
    keys: row.keys,
    userAgent: row.user_agent,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,

    async save() {
      const updated = await auditRepository.saveSubscription(this);
      Object.assign(this, updated);
      return this;
    }
  };
}

const NotificationSubscription = {
  async findOne(query = {}) {
    const userId = query.user || query.userId;
    if (query.endpoint) {
      return auditRepository.getSubscriptionByEndpoint(query.endpoint);
    }
    if (userId) {
      const subs = await auditRepository.getSubscriptions(userId);
      return subs[0] || null;
    }
    return null;
  },

  async findById(id) {
    return auditRepository.getSubscriptionById(id);
  },

  async findOneAndUpdate(filter = {}, update = {}, options = {}) {
    const userId = filter.user || filter.userId;
    const endpoint = filter.endpoint;
    
    // Retrieve subscription first
    let sub = await this.findOne(filter);
    
    const setObj = update.$set || update;
    const payload = {
      user: userId || sub?.user,
      endpoint: endpoint || sub?.endpoint || setObj.endpoint,
      keys: setObj.keys || sub?.keys,
      userAgent: setObj.userAgent || sub?.userAgent || setObj.user_agent
    };

    if (sub || options.upsert) {
      return auditRepository.saveSubscription(payload);
    }
    return null;
  },

  async create(data) {
    return auditRepository.saveSubscription(data);
  },

  async deleteMany(query = {}) {
    const userId = query.user || query.userId;
    const endpoint = query.endpoint;
    if (endpoint) {
      await auditRepository.deleteSubscription(endpoint, userId);
    } else if (userId) {
      await auditRepository.deleteSubscriptionsByUserId(userId);
    }
    return { deletedCount: 1 };
  },

  find(query = {}) {
    const userId = query.user || query.userId;
    let limitVal = null;
    let sortVal = null;

    const builder = {
      limit(n) { limitVal = n; return this; },
      sort(s) { sortVal = s; return this; },
      select() { return this; },
      lean() { return this; },
      async then(resolve, reject) {
        try {
          if (!userId) return resolve([]);
          const res = await auditRepository.getSubscriptions(userId);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      }
    };
    return builder;
  }
};

export default NotificationSubscription;
