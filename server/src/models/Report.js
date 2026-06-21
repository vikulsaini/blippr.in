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
      // update status in repository
      const { data, error } = await supabaseAdmin
        .from('reports')
        .update({ status: this.status, notes: this.notes, updated_at: new Date() })
        .eq('id', this.id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapReportFromPostgres(data));
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
    if (!id) return null;
    const { data, error } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return mapReportFromPostgres(data);
  },

  async create(data) {
    const row = await auditRepository.createReport(data);
    return mapReportFromPostgres(row);
  },

  async deleteMany(query = {}) {
    let q = supabaseAdmin.from('reports').delete();
    if (query.reporter) q = q.eq('reporter_id', query.reporter);
    if (query.reported) q = q.eq('reported_id', query.reported);
    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
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

import { supabaseAdmin } from '../config/supabase.js';
export default Report;
