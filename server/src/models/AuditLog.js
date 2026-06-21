import { supabaseAdmin } from '../config/supabase.js';

export function mapAuditLogFromPostgres(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    action: row.action,
    actor: row.actor_id,
    actorId: row.actor_id,
    target: row.target,
    details: row.details,
    ip: row.ip,
    timestamp: row.created_at ? new Date(row.created_at) : null,
    createdAt: row.created_at ? new Date(row.created_at) : null
  };
}

const AuditLog = {
  async create(data) {
    const payload = {
      action: data.action,
      actor_id: data.actor || data.actorId || data.actor_id,
      target: data.target || null,
      details: data.details || {},
      ip: data.ip || null,
      created_at: data.timestamp || data.createdAt || new Date()
    };

    const { data: row, error } = await supabaseAdmin
      .from('audit_logs')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return mapAuditLogFromPostgres(row);
  },

  find(query = {}) {
    let q = supabaseAdmin.from('audit_logs').select('*');
    if (query.action) q = q.eq('action', query.action);

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          resolve((data || []).map(mapAuditLogFromPostgres));
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
          q = q.order(field === 'timestamp' || field === 'createdAt' ? 'created_at' : field, { ascending: !desc });
        }
        return this;
      },
      lean() { return this; },
      populate(field) {
        const originalThen = this.then;
        this.then = async (resolve, reject) => {
          try {
            const logs = await new Promise((res, rej) => originalThen(res, rej));
            if (logs.length === 0) return resolve(logs);

            if (field === 'actor') {
              const actorIds = [...new Set(logs.map(l => l.actor).filter(Boolean))];
              if (actorIds.length > 0) {
                const User = (await import('./User.js')).default;
                const users = await User.find({ _id: { $in: actorIds } });
                const userMap = new Map(users.map(u => [u.id, u]));
                for (const log of logs) {
                  log.actor = userMap.get(log.actor) || log.actor;
                }
              }
            }
            resolve(logs);
          } catch (err) {
            reject(err);
          }
        };
        return this;
      }
    };
    return builder;
  }
};

export default AuditLog;
