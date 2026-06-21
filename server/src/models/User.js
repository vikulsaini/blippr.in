import { supabaseAdmin } from '../config/supabase.js';
import { mapUserFromPostgres, mapUserToPostgres } from '../utils/userMapper.js';

const User = {
  findById(id) {
    let q = supabaseAdmin.from('profiles').select('*');
    if (id) {
      q = q.eq('id', id);
    }
    const builder = {
      async then(resolve, reject) {
        try {
          if (!id) return resolve(null);
          const { data, error } = await q.maybeSingle();
          if (error) throw error;
          resolve(mapUserFromPostgres(data));
        } catch (err) {
          reject(err);
        }
      },
      select() { return this; },
      lean() { return this; }
    };
    return builder;
  },

  async findOne(query = {}) {
    let q = supabaseAdmin.from('profiles').select('*');
    
    if (query.email) {
      q = q.eq('email', query.email.toLowerCase());
    } else if (query.username) {
      q = q.eq('username', query.username.toLowerCase());
    } else if (query.supabaseId) {
      q = q.eq('id', query.supabaseId);
    } else if (query._id) {
      q = q.eq('id', query._id);
    } else if (query.isGuest !== undefined) {
      q = q.eq('is_guest', query.isGuest);
    }

    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return mapUserFromPostgres(data);
  },

  async exists(query = {}) {
    let q = supabaseAdmin.from('profiles').select('id');
    
    if (query.username) {
      q = q.eq('username', query.username.toLowerCase());
    } else if (query.email) {
      q = q.eq('email', query.email.toLowerCase());
    } else if (query._id) {
      q = q.eq('id', query._id);
    }

    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return !!data;
  },

  async create(data) {
    const payload = mapUserToPostgres(data);
    if (data.supabaseId) {
      payload.id = data.supabaseId;
    } else if (data._id) {
      payload.id = data._id;
    }
    
    const { data: row, error } = await supabaseAdmin
      .from('profiles')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return mapUserFromPostgres(row);
  },

  async updateOne(filter = {}, update = {}) {
    const id = filter.id || filter._id || filter.supabaseId;
    if (!id) return { modifiedCount: 0 };

    const payload = {};
    const setObj = update.$set || update;
    for (const [k, v] of Object.entries(setObj)) {
      if (!k.startsWith('$')) {
        payload[k] = v;
      }
    }

    const pgPayload = mapUserToPostgres(payload);
    delete pgPayload.id; // Primary key cannot be updated

    const { error } = await supabaseAdmin
      .from('profiles')
      .update(pgPayload)
      .eq('id', id);

    if (error) throw error;
    return { modifiedCount: 1 };
  },

  async findByIdAndUpdate(id, update = {}) {
    await this.updateOne({ id }, update);
    return this.findById(id);
  },

  async deleteOne(query = {}) {
    const id = query.id || query._id;
    if (!id) return { deletedCount: 0 };
    const { error } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { deletedCount: 1 };
  },

  async countDocuments(query = {}) {
    let q = supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true });
    if (query.role) q = q.eq('role', query.role);
    if (query.isGuest !== undefined) q = q.eq('is_guest', query.isGuest);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  },

  async aggregate(pipeline) {
    const matchStage = pipeline.find(stage => stage.$match);
    const sampleStage = pipeline.find(stage => stage.$sample);
    
    let q = supabaseAdmin.from('profiles').select('*');
    if (matchStage) {
      const m = matchStage.$match;
      if (m.is_guest !== undefined) q = q.eq('is_guest', m.is_guest);
      if (m.isOnline !== undefined) q = q.eq('is_online', m.isOnline);
      if (m.gender) q = q.eq('gender', m.gender);
      if (m._id && m._id.$ne) q = q.neq('id', m._id.$ne);
    }
    const { data, error } = await q;
    if (error) throw error;
    const mapped = (data || []).map(mapUserFromPostgres);
    if (sampleStage) {
      const shuffled = mapped.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, sampleStage.$sample.size);
    }
    return mapped;
  },

  find(query = {}) {
    let q = supabaseAdmin.from('profiles').select('*');
    if (query.username) {
      if (query.username.$regex) {
        const cleaned = query.username.$regex.startsWith('^') ? query.username.$regex.slice(1) : query.username.$regex;
        q = q.ilike('username', `${cleaned}%`);
      } else {
        q = q.eq('username', query.username.toLowerCase());
      }
    }
    if (query._id) {
      if (query._id.$in) {
        q = q.in('id', query._id.$in);
      } else if (query._id.$nin) {
        q = q.not('id', 'in', `(${query._id.$nin.map(id => `"${id}"`).join(',')})`);
      } else {
        q = q.eq('id', query._id);
      }
    }
    if (query.role) q = q.eq('role', query.role);
    if (query.isGuest !== undefined) q = q.eq('is_guest', query.isGuest);
    if (query.gender) q = q.eq('gender', query.gender);
    
    if (query.location && query.location.$near) {
      const coords = query.location.$near.$geometry.coordinates;
      const maxDist = query.location.$near.$maxDistance || 25000;
      const latDiff = maxDist / 111000;
      const lngDiff = maxDist / (111000 * Math.cos(coords[1] * Math.PI / 180));
      q = q.gte('location_lat', coords[1] - latDiff)
           .lte('location_lat', coords[1] + latDiff)
           .gte('location_lng', coords[0] - lngDiff)
           .lte('location_lng', coords[0] + lngDiff);
    }

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          resolve((data || []).map(mapUserFromPostgres));
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

export default User;
