import { supabaseAdmin } from '../config/supabase.js';

class AuditLogInstance {
  constructor(data) {
    Object.assign(this, data);
  }

  async save() {
    const payload = {
      action: this.action,
      actor_id: this.actor || this.actorId || this.actor_id,
      target: this.target || null,
      details: this.details || {},
      ip: this.ip || null,
      created_at: this.timestamp || this.createdAt || new Date()
    };

    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    Object.assign(this, mapAuditLogFromPostgres(data));
    return this;
  }

  toObject() {
    return { ...this };
  }
}

function mapAuditLogFromPostgres(row) {
  if (!row) return null;
  return new AuditLogInstance({
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
  });
}

function mapAuditLogFieldToPg(field) {
  const mapping = {
    _id: 'id',
    id: 'id',
    action: 'action',
    actor: 'actor_id',
    actorId: 'actor_id',
    target: 'target',
    details: 'details',
    ip: 'ip',
    timestamp: 'created_at',
    createdAt: 'created_at'
  };
  return mapping[field] || field;
}

function applyAuditLogFilters(q, query) {
  let res = q;
  for (const [key, value] of Object.entries(query)) {
    const pgKey = mapAuditLogFieldToPg(key);

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

const AuditLog = {
  async create(data) {
    const inst = new AuditLogInstance(data);
    return inst.save();
  },

  find(query = {}) {
    let q = supabaseAdmin.from('audit_logs').select('*');
    q = applyAuditLogFilters(q, query);

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          const mapped = (data || []).map(mapAuditLogFromPostgres);
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
          const pgField = mapAuditLogFieldToPg(field);
          q = q.order(pgField, { ascending: !desc });
        }
        return this;
      },
      lean() {
        return this;
      },
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
