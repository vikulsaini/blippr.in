import { auditRepository } from '../repositories/audit.repository.js';


export function mapBucketFromPostgres(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    timestamp: row.timestamp ? new Date(row.timestamp) : null,
    interval: row.interval,
    requestCount: row.request_count || 0,
    errorCount: row.error_count || 0,
    responseTimeSum: row.response_time_sum || 0,
    status2xx: row.status_2xx || 0,
    status3xx: row.status_3xx || 0,
    status4xx: row.status_4xx || 0,
    status5xx: row.status_5xx || 0,
    endpoints: row.endpoints || {},

    async save() {
      const updated = await auditRepository.updateAnalyticsBucket(this.id, this);
      Object.assign(this, mapBucketFromPostgres(updated));
      return this;
    }
  };
}

const AnalyticsBucket = {
  async findOne(query = {}) {
    const data = await auditRepository.findOneAnalyticsBucket(query);
    return mapBucketFromPostgres(data);
  },

  async create(data) {
    const row = await auditRepository.createAnalyticsBucket(data);
    return mapBucketFromPostgres(row);
  },

  find(query = {}) {
    let limitVal = null;
    let sortVal = null;

    const builder = {
      limit(n) { limitVal = n; return this; },
      sort(s) { sortVal = s; return this; },
      select() { return this; },
      lean() { return this; },
      async then(resolve, reject) {
        try {
          const data = await auditRepository.findAnalyticsBuckets(query, { limit: limitVal, sort: sortVal });
          resolve(data.map(mapBucketFromPostgres));
        } catch (err) {
          reject(err);
        }
      }
    };
    return builder;
  }
};

export default AnalyticsBucket;
