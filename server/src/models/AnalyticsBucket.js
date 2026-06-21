import { supabaseAdmin } from '../config/supabase.js';

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

      const { data, error } = await supabaseAdmin
        .from('analytics_buckets')
        .update(payload)
        .eq('id', this.id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapBucketFromPostgres(data));
      return this;
    }
  };
}

const AnalyticsBucket = {
  async findOne(query = {}) {
    let q = supabaseAdmin.from('analytics_buckets').select('*');
    if (query._id) q = q.eq('id', query._id);
    if (query.timestamp) {
      if (query.timestamp.$gte) q = q.gte('timestamp', query.timestamp.$gte.toISOString ? query.timestamp.$gte.toISOString() : query.timestamp.$gte);
      if (query.timestamp.$lt) q = q.lt('timestamp', query.timestamp.$lt.toISOString ? query.timestamp.$lt.toISOString() : query.timestamp.$lt);
    }
    if (query.interval) q = q.eq('interval', query.interval);

    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return mapBucketFromPostgres(data);
  },

  async create(data) {
    const payload = {
      timestamp: data.timestamp || new Date(),
      interval: data.interval || 'hour',
      request_count: data.requestCount || 0,
      error_count: data.errorCount || 0,
      response_time_sum: data.responseTimeSum || 0,
      status_2xx: data.status2xx || 0,
      status_3xx: data.status3xx || 0,
      status_4xx: data.status4xx || 0,
      status_5xx: data.status5xx || 0,
      endpoints: data.endpoints || {}
    };
    const { data: row, error } = await supabaseAdmin
      .from('analytics_buckets')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return mapBucketFromPostgres(row);
  },

  find(query = {}) {
    let q = supabaseAdmin.from('analytics_buckets').select('*');
    if (query.interval) q = q.eq('interval', query.interval);
    if (query.timestamp) {
      if (query.timestamp.$gte) q = q.gte('timestamp', query.timestamp.$gte.toISOString ? query.timestamp.$gte.toISOString() : query.timestamp.$gte);
      if (query.timestamp.$lt) q = q.lt('timestamp', query.timestamp.$lt.toISOString ? query.timestamp.$lt.toISOString() : query.timestamp.$lt);
    }

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          resolve((data || []).map(mapBucketFromPostgres));
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
          q = q.order(field === 'timestamp' ? 'timestamp' : field, { ascending: !desc });
        }
        return this;
      },
      lean() { return this; }
    };
    return builder;
  }
};

export default AnalyticsBucket;
