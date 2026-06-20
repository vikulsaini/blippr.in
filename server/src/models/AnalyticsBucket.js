import { supabaseAdmin } from '../config/supabase.js';

class AnalyticsBucketInstance {
  constructor(data) {
    Object.assign(this, data);
  }

  async save() {
    const payload = {
      timestamp: this.timestamp || new Date(),
      interval: this.interval || 'hour',
      request_count: this.requestCount || 0,
      error_count: this.errorCount || 0,
      response_time_sum: this.responseTimeSum || 0,
      status_2xx: this.status2xx || 0,
      status_3xx: this.status3xx || 0,
      status_4xx: this.status4xx || 0,
      status_5xx: this.status5xx || 0,
      endpoints: this.endpoints || {}
    };

    const id = this.id || this._id;
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('analytics_buckets')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapBucketFromPostgres(data));
    } else {
      const { data, error } = await supabaseAdmin
        .from('analytics_buckets')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapBucketFromPostgres(data));
    }
    return this;
  }

  toObject() {
    return { ...this };
  }
}

function mapBucketFromPostgres(row) {
  if (!row) return null;
  return new AnalyticsBucketInstance({
    _id: row.id,
    id: row.id,
    timestamp: row.timestamp ? new Date(row.timestamp) : null,
    interval: row.interval,
    requestCount: row.request_count,
    errorCount: row.error_count,
    responseTimeSum: row.response_time_sum,
    status2xx: row.status_2xx,
    status3xx: row.status_3xx,
    status4xx: row.status_4xx,
    status5xx: row.status_5xx,
    endpoints: row.endpoints || {}
  });
}

function mapBucketFieldToPg(field) {
  const mapping = {
    _id: 'id',
    id: 'id',
    timestamp: 'timestamp',
    interval: 'interval',
    requestCount: 'request_count',
    errorCount: 'error_count',
    responseTimeSum: 'response_time_sum',
    status2xx: 'status_2xx',
    status3xx: 'status_3xx',
    status4xx: 'status_4xx',
    status5xx: 'status_5xx',
    endpoints: 'endpoints'
  };
  return mapping[field] || field;
}

function applyBucketFilters(q, query) {
  let res = q;
  for (const [key, value] of Object.entries(query)) {
    const pgKey = mapBucketFieldToPg(key);

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [op, val] of Object.entries(value)) {
        if (op === '$nin') {
          if (Array.isArray(val) && val.length > 0) {
            res = res.not(pgKey, 'in', `(${val.map(id => `"${id}"`).join(',')})`);
          }
        } else if (op === '$ne') {
          res = res.neq(pgKey, val);
        } else if (op === '$lt') {
          res = res.lt(pgKey, val);
        } else if (op === '$gte') {
          res = res.gte(pgKey, val);
        }
      }
    } else {
      res = res.eq(pgKey, value);
    }
  }
  return res;
}

const AnalyticsBucket = {
  async findOne(query = {}) {
    let q = supabaseAdmin.from('analytics_buckets').select('*');
    q = applyBucketFilters(q, query);
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return mapBucketFromPostgres(data);
  },

  async create(data) {
    const inst = new AnalyticsBucketInstance(data);
    return inst.save();
  },

  find(query = {}) {
    let q = supabaseAdmin.from('analytics_buckets').select('*');
    q = applyBucketFilters(q, query);

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          const mapped = (data || []).map(mapBucketFromPostgres);
          resolve(mapped);
        } catch (err) {
          reject(err);
        }
      },
      select() {
        return this;
      },
      limit(n) {
        q = q.limit(n);
        return this;
      },
      sort(sortStr) {
        if (sortStr) {
          const desc = sortStr.startsWith('-');
          const field = desc ? sortStr.slice(1) : sortStr;
          const pgField = mapBucketFieldToPg(field);
          q = q.order(pgField, { ascending: !desc });
        }
        return this;
      },
      lean() {
        return this;
      }
    };
    return builder;
  }
};

export default AnalyticsBucket;
