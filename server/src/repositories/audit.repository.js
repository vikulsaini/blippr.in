import crypto from 'node:crypto';
import { db } from '../config/database.js';
import { mapSubscriptionFromPostgres } from '../models/NotificationSubscription.js';
import { mapUserFromPostgres } from '../utils/userMapper.js';
import { toDbId, fromDbDoc, toDbQuery, toDbSort, toDbUpdate } from '../utils/mongoHelper.js';

export const auditRepository = {
  /* ─── Audit Logs ─── */
  async createAuditLog(data) {
    const payload = {
      action: data.action,
      actor_id: toDbId(data.actor || data.actor_id || null),
      target: data.target || null,
      details: data.details || {},
      ip: data.ip || null,
      created_at: new Date()
    };
    payload._id = toDbId(data._id || data.id || crypto.randomUUID());
    
    await db.collection('audit_logs').insertOne(payload);
    return fromDbDoc(payload);
  },

  async getAuditLogs(limit = 50, offset = 0) {
    const docs = await db.collection('audit_logs')
      .find({})
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
    const mapped = docs.map(fromDbDoc);
    
    // Eagerly populate actor profiles
    const actorIds = [...new Set(mapped.map(l => toDbId(l.actor_id)).filter(Boolean))];
    if (actorIds.length > 0) {
      const profiles = await db.collection('users').find({ _id: { $in: actorIds } }).toArray();
      const profileMap = new Map(profiles.map(fromDbDoc).map(p => [p.id, mapUserFromPostgres(p)]));
      for (const log of mapped) {
        if (log.actor_id) {
          log.actor = profileMap.get(log.actor_id.toString()) || log.actor_id;
        }
      }
    }
    return mapped;
  },

  /* ─── Safety Reports ─── */
  async createReport(data) {
    const payload = {
      reporter_id: toDbId(data.reporter || data.reporter_id),
      reported_id: toDbId(data.reported || data.reported_id),
      reason: data.reason,
      notes: data.notes || '',
      category: data.category || 'other',
      message_id: toDbId(data.messageId || data.message_id || null),
      chat_id: toDbId(data.chatId || data.chat_id || null),
      screenshots: data.screenshots || [],
      status: data.status || 'open',
      created_at: new Date(),
      updated_at: new Date()
    };
    payload._id = toDbId(data._id || data.id || crypto.randomUUID());
    
    await db.collection('reports').insertOne(payload);
    return fromDbDoc(payload);
  },

  async getReports(query = {}, limit = 50) {
    const docs = await db.collection('reports')
      .find(toDbQuery(query))
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();
    const mapped = docs.map(fromDbDoc);

    // Eagerly populate reporter/reported profiles
    const userIds = [...new Set(mapped.flatMap(r => [toDbId(r.reporter_id), toDbId(r.reported_id)]))].filter(Boolean);
    if (userIds.length > 0) {
      const profiles = await db.collection('users').find({ _id: { $in: userIds } }).toArray();
      const profileMap = new Map(profiles.map(fromDbDoc).map(p => [p.id, mapUserFromPostgres(p)]));
      for (const rep of mapped) {
        if (rep.reporter_id) rep.reporter = profileMap.get(rep.reporter_id.toString()) || rep.reporter_id;
        if (rep.reported_id) rep.reported = profileMap.get(rep.reported_id.toString()) || rep.reported_id;
      }
    }
    return mapped;
  },

  async getReportById(id) {
    if (!id) return null;
    const doc = await db.collection('reports').findOne({ _id: toDbId(id) });
    return fromDbDoc(doc);
  },

  async updateReport(id, updateData) {
    const setObj = updateData.$set || updateData;
    const payload = {};
    if (setObj.status) payload.status = setObj.status;
    if (setObj.notes !== undefined) payload.notes = setObj.notes;
    payload.updated_at = new Date();

    const res = await db.collection('reports').findOneAndUpdate(
      { _id: toDbId(id) },
      { $set: payload },
      { returnDocument: 'after' }
    );
    const doc = res && res.value !== undefined ? res.value : res;
    return fromDbDoc(doc);
  },

  async deleteReports(query = {}) {
    const { deletedCount } = await db.collection('reports').deleteMany(toDbQuery(query));
    return { deletedCount };
  },

  /* ─── Notification Subscriptions ─── */
  async saveSubscription(data) {
    const payload = {
      user_id: toDbId(data.user || data.userId || data.user_id),
      endpoint: data.endpoint,
      keys: data.keys,
      user_agent: data.userAgent || data.user_agent || null,
      updated_at: new Date()
    };
    
    const res = await db.collection('notification_subscriptions').findOneAndUpdate(
      { endpoint: data.endpoint },
      { $set: payload, $setOnInsert: { created_at: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );
    const doc = res && res.value !== undefined ? res.value : res;
    return mapSubscriptionFromPostgres(fromDbDoc(doc));
  },

  async deleteSubscription(endpoint, userId) {
    const query = { endpoint };
    if (userId) query.user_id = toDbId(userId);
    await db.collection('notification_subscriptions').deleteOne(query);
    return true;
  },

  async getSubscriptions(userId) {
    const docs = await db.collection('notification_subscriptions')
      .find({ user_id: toDbId(userId) })
      .toArray();
    return docs.map(fromDbDoc).map(mapSubscriptionFromPostgres);
  },

  /* ─── Analytics Buckets ─── */
  async createAnalyticsBucket(data) {
    const payload = {
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      interval: data.interval || 'hour',
      request_count: data.requestCount || data.request_count || 0,
      error_count: data.errorCount || data.error_count || 0,
      response_time_sum: data.responseTimeSum || data.response_time_sum || 0.0,
      status_2xx: data.status_2xx || data.status2xx || 0,
      status_3xx: data.status_3xx || data.status3xx || 0,
      status_4xx: data.status_4xx || data.status4xx || 0,
      status_5xx: data.status_5xx || data.status5xx || 0,
      endpoints: data.endpoints || {}
    };
    payload._id = toDbId(data._id || data.id || crypto.randomUUID());
    
    await db.collection('analytics_buckets').insertOne(payload);
    return fromDbDoc(payload);
  },

  async getAnalyticsBuckets(interval, limit = 30) {
    const docs = await db.collection('analytics_buckets')
      .find({ interval })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    return docs.map(fromDbDoc);
  },

  async updateAnalyticsBucket(id, data) {
    const setObj = data.$set || data;
    const payload = {
      request_count: setObj.requestCount || setObj.request_count || 0,
      error_count: setObj.errorCount || setObj.error_count || 0,
      response_time_sum: setObj.responseTimeSum || setObj.response_time_sum || 0,
      status_2xx: setObj.status2xx || setObj.status_2xx || 0,
      status_3xx: setObj.status3xx || setObj.status_3xx || 0,
      status_4xx: setObj.status4xx || setObj.status_4xx || 0,
      status_5xx: setObj.status5xx || setObj.status_5xx || 0,
      endpoints: setObj.endpoints || {}
    };
    
    const res = await db.collection('analytics_buckets').findOneAndUpdate(
      { _id: toDbId(id) },
      { $set: payload },
      { returnDocument: 'after' }
    );
    const doc = res && res.value !== undefined ? res.value : res;
    return fromDbDoc(doc);
  },

  async getSubscriptionByEndpoint(endpoint) {
    const doc = await db.collection('notification_subscriptions').findOne({ endpoint });
    return mapSubscriptionFromPostgres(fromDbDoc(doc));
  },

  async getSubscriptionById(id) {
    const doc = await db.collection('notification_subscriptions').findOne({ _id: toDbId(id) });
    return mapSubscriptionFromPostgres(fromDbDoc(doc));
  },

  async deleteSubscriptionsByUserId(userId) {
    await db.collection('notification_subscriptions').deleteMany({ user_id: toDbId(userId) });
    return true;
  },

  async findOneAnalyticsBucket(query) {
    const doc = await db.collection('analytics_buckets').findOne(toDbQuery(query));
    return fromDbDoc(doc);
  },

  async findAnalyticsBuckets(query, options = {}) {
    let cursor = db.collection('analytics_buckets').find(toDbQuery(query));
    if (options.sort) {
      cursor = cursor.sort(toDbSort(options.sort));
    }
    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }
    const docs = await cursor.toArray();
    return docs.map(fromDbDoc);
  }
};
