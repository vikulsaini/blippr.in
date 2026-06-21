import { auditRepository } from '../repositories/audit.repository.js';
import { mapUserFromPostgres } from '../utils/userMapper.js';

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
    const row = await auditRepository.createAuditLog(data);
    return mapAuditLogFromPostgres(row);
  },

  find(query = {}) {
    let limitVal = 50;
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
          const logs = await auditRepository.getAuditLogs(limitVal, 0);
          const mappedLogs = logs.map(mapAuditLogFromPostgres);
          
          if (populateFields.includes('actor')) {
            // Eagerly populate actor profiles
            for (const log of mappedLogs) {
              const actorRow = logs.find(r => r.id === log.id)?.actor;
              if (actorRow) {
                log.actor = mapUserFromPostgres(actorRow);
              }
            }
          }
          resolve(mappedLogs);
        } catch (err) {
          reject(err);
        }
      }
    };
    return builder;
  }
};

export default AuditLog;
