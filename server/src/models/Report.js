import { supabaseAdmin } from '../config/supabase.js';

class ReportInstance {
  constructor(data) {
    Object.assign(this, data);
  }

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

    const id = this.id || this._id;
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('reports')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapReportFromPostgres(data));
    } else {
      const { data, error } = await supabaseAdmin
        .from('reports')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapReportFromPostgres(data));
    }
    return this;
  }

  toObject() {
    return { ...this };
  }
}

function mapReportFromPostgres(row) {
  if (!row) return null;
  return new ReportInstance({
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
    updatedAt: row.updated_at ? new Date(row.updated_at) : null
  });
}

function mapReportFieldToPg(field) {
  const mapping = {
    _id: 'id',
    id: 'id',
    reporter: 'reporter_id',
    reporterId: 'reporter_id',
    reported: 'reported_id',
    reportedId: 'reported_id',
    reason: 'reason',
    notes: 'notes',
    category: 'category',
    messageId: 'message_id',
    chatId: 'chat_id',
    screenshots: 'screenshots',
    status: 'status',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  };
  return mapping[field] || field;
}

function applyReportFilters(q, query) {
  let res = q;
  for (const [key, value] of Object.entries(query)) {
    const pgKey = mapReportFieldToPg(key);

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
        } else if (op === '$in') {
          if (Array.isArray(val) && val.length > 0) {
            res = res.in(pgKey, val);
          }
        }
      }
    } else if (key === '$or') {
      const orStrings = value.map(filterObj => {
        const [orKey, orVal] = Object.entries(filterObj)[0];
        const pgOrKey = mapReportFieldToPg(orKey);
        if (orVal && typeof orVal === 'object') {
          if (orVal.$ne) {
            return `${pgOrKey}.neq.${orVal.$ne}`;
          }
        }
        return `${pgOrKey}.eq.${orVal}`;
      });
      res = res.or(orStrings.join(','));
    } else {
      res = res.eq(pgKey, value);
    }
  }
  return res;
}

const Report = {
  async findOne(query = {}) {
    let q = supabaseAdmin.from('reports').select('*');
    q = applyReportFilters(q, query);
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
    const inst = new ReportInstance(data);
    return inst.save();
  },

  async deleteMany(query = {}) {
    let q = supabaseAdmin.from('reports').delete();
    q = applyReportFilters(q, query);
    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  find(query = {}) {
    let q = supabaseAdmin.from('reports').select('*');
    q = applyReportFilters(q, query);

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          const mapped = (data || []).map(mapReportFromPostgres);
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
          const pgField = mapReportFieldToPg(field);
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

export default Report;
