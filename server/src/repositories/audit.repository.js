import { db } from '../config/database.js';
import { mapSubscriptionFromPostgres } from '../models/NotificationSubscription.js';

export const auditRepository = {
  /* ─── Audit Logs ─── */
  async createAuditLog(data) {
    const payload = {
      action: data.action,
      actor_id: data.actor || data.actor_id || null,
      target: data.target || null,
      details: data.details || {},
      ip: data.ip || null,
      created_at: new Date()
    };
    const { data: row, error } = await db
      .from('audit_logs')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return row;
  },

  async getAuditLogs(limit = 50, offset = 0) {
    const { data, error } = await db
      .from('audit_logs')
      .select('*, actor:profiles(name, username, avatar)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data;
  },

  /* ─── Safety Reports ─── */
  async createReport(data) {
    const payload = {
      reporter_id: data.reporter || data.reporter_id,
      reported_id: data.reported || data.reported_id,
      reason: data.reason,
      notes: data.notes || '',
      category: data.category || 'other',
      message_id: data.messageId || data.message_id || null,
      chat_id: data.chatId || data.chat_id || null,
      screenshots: data.screenshots || [],
      status: data.status || 'open',
      updated_at: new Date()
    };
    const { data: row, error } = await db
      .from('reports')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return row;
  },

  async getReports(query = {}, limit = 50) {
    let q = db.from('reports').select('*, reporter:profiles(*), reported:profiles(*)');
    if (query.reported) q = q.eq('reported_id', query.reported);
    if (query.reporter) q = q.eq('reporter_id', query.reporter);
    if (query.status) q = q.eq('status', query.status);

    const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  },

  /* ─── Notification Subscriptions ─── */
  async saveSubscription(data) {
    const payload = {
      user_id: data.user || data.userId || data.user_id,
      endpoint: data.endpoint,
      keys: data.keys,
      user_agent: data.userAgent || data.user_agent || null,
      updated_at: new Date()
    };
    const { data: row, error } = await db
      .from('notification_subscriptions')
      .upsert(payload, { onConflict: 'endpoint' })
      .select()
      .single();
    if (error) throw error;
    return mapSubscriptionFromPostgres(row);
  },

  async deleteSubscription(endpoint, userId) {
    let q = db.from('notification_subscriptions').delete().eq('endpoint', endpoint);
    if (userId) q = q.eq('user_id', userId);
    const { error } = await q;
    if (error) throw error;
    return true;
  },

  async getSubscriptions(userId) {
    const { data, error } = await db
      .from('notification_subscriptions')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map(mapSubscriptionFromPostgres);
  },

  /* ─── Analytics Buckets ─── */
  async createAnalyticsBucket(data) {
    const payload = {
      timestamp: data.timestamp || new Date(),
      interval: data.interval || 'hour',
      request_count: data.requestCount || data.request_count || 0,
      error_count: data.errorCount || data.error_count || 0,
      response_time_sum: data.responseTimeSum || data.response_time_sum || 0.0,
      status_2xx: data.status_2xx || 0,
      status_3xx: data.status_3xx || 0,
      status_4xx: data.status_4xx || 0,
      status_5xx: data.status_5xx || 0,
      endpoints: data.endpoints || {}
    };
    const { data: row, error } = await db
      .from('analytics_buckets')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return row;
  },

  async getAnalyticsBuckets(interval, limit = 30) {
    const { data, error } = await db
      .from('analytics_buckets')
      .select('*')
      .eq('interval', interval)
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }
};
