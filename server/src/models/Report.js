import { auditRepository } from '../repositories/audit.repository.js';
import { mapUserFromPostgres } from '../utils/userMapper.js';

export function mapReportFromPostgres(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    reporter: row.reporter_id,
    reporterId: row.reporter_id,
    reported: row.reported_id,
    reportedId: row.reported_id,
    reason: row.reason,
    notes: row.notes,
    category: row.category,
    messageId: row.message_id,
    chatId: row.chat_id,
    screenshots: row.screenshots || [],
    status: row.status,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,

    async save() {
      const updated = await auditRepository.updateReport(this.id, { status: this.status, notes: this.notes });
      Object.assign(this, mapReportFromPostgres(updated));
      return this;
    }
  };
}

const Report = {
  async findOne(query = {}) {
    const reports = await auditRepository.getReports(query, 1);
    return reports[0] ? mapReportFromPostgres(reports[0]) : null;
  },

  async findById(id) {
    const data = await auditRepository.getReportById(id);
    return mapReportFromPostgres(data);
  },

  async create(data) {
    const row = await auditRepository.createReport(data);
    return mapReportFromPostgres(row);
  },

  async deleteMany(query = {}) {
    return auditRepository.deleteReports(query);
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
          const reports = await auditRepository.getReports(query, limitVal);
          const mapped = reports.map(row => {
            const rep = mapReportFromPostgres(row);
            if (populateFields.includes('reporter') && row.reporter) {
              rep.reporter = mapUserFromPostgres(row.reporter);
            }
            if (populateFields.includes('reported') && row.reported) {
              rep.reported = mapUserFromPostgres(row.reported);
            }
            return rep;
          });
          resolve(mapped);
        } catch (err) {
          reject(err);
        }
      }
    };
    return builder;
  }
};

export default Report;
