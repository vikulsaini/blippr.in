import { supabaseAdmin } from '../config/supabase.js';

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
      const payload = {
        reporter_id: this.reporter || this.reporterId || this.reporter_id,
        reported_id: this.reported || this.reportedId || this.reported_id,
        reason: this.reason,
        notes: this.notes || '',
        category: this.category || 'other',
        message_id: this.messageId || this.message_id || null,
        chat_id: this.chatId || this.chat_id || null,
        screenshots: this.screenshots || [],
        status: this.status || 'open',
        updated_at: new Date()
      };

      const { data, error } = await supabaseAdmin
        .from('reports')
        .update(payload)
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
    let q = supabaseAdmin.from('reports').select('*');
    if (query._id) q = q.eq('id', query._id);
    if (query.reporter) q = q.eq('reporter_id', query.reporter);
    if (query.reported) q = q.eq('reported_id', query.reported);
    
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return mapReportFromPostgres(data);
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
    const payload = {
      reporter_id: data.reporter || data.reporterId || data.reporter_id,
      reported_id: data.reported || data.reportedId || data.reported_id,
      reason: data.reason,
      notes: data.notes || '',
      category: data.category || 'other',
      message_id: data.messageId || data.message_id || null,
      chat_id: data.chatId || data.chat_id || null,
      screenshots: data.screenshots || [],
      status: data.status || 'open',
      updated_at: new Date()
    };
    const { data: row, error } = await supabaseAdmin
      .from('reports')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
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
    let q = supabaseAdmin.from('reports').select('*');
    if (query.reporter) q = q.eq('reporter_id', query.reporter);
    if (query.reported) q = q.eq('reported_id', query.reported);
    if (query.status) q = q.eq('status', query.status);

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          resolve((data || []).map(mapReportFromPostgres));
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
          q = q.order(field === 'createdAt' ? 'created_at' : field, { ascending: !desc });
        }
        return this;
      },
      lean() { return this; }
    };
    return builder;
  }
};

export default Report;
