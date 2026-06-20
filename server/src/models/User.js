import { supabaseAdmin } from '../config/supabase.js';

class UserInstance {
  constructor(data) {
    Object.assign(this, data);
  }

  async save() {
    const payload = {
      username: this.username,
      name: this.name,
      email: this.email,
      age: this.age ? Number(this.age) : undefined,
      dob: this.dob,
      gender: this.gender,
      avatar: this.avatar,
      bio: this.bio,
      location_lat: this.location?.coordinates?.[1] || this.location_lat,
      location_lng: this.location?.coordinates?.[0] || this.location_lng,
      location_updated_at: this.location?.updatedAt || this.location_updated_at || new Date(),
      interests: this.interests || [],
      show_last_seen: this.privacy?.showLastSeen ?? this.show_last_seen ?? true,
      read_receipts: this.privacy?.readReceipts ?? this.read_receipts ?? true,
      vault_password: this.privacy?.vaultPassword ?? this.vault_password,
      blocked_words: this.safety?.blockedWords ?? this.blocked_words ?? [],
      blocked_users: this.blockedUsers || this.blocked_users || [],
      push_tokens: this.pushTokens || this.push_tokens || [],
      is_online: this.isOnline ?? this.is_online ?? false,
      is_guest: this.isGuest ?? this.is_guest ?? false,
      role: this.role || 'user',
      safety_violation_count: this.safetyViolationCount ?? this.safety_violation_count ?? 0,
      banned_until: this.bannedUntil ?? this.banned_until,
      last_seen_at: this.lastSeenAt ?? this.last_seen_at ?? new Date(),
      last_ip: this.lastIp ?? this.last_ip,
      updated_at: new Date()
    };

    const id = this.id || this._id;
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapFromPostgres(data));
    } else {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapFromPostgres(data));
    }
    return this;
  }

  toObject() {
    return { ...this };
  }

  toJSON() {
    const obj = { ...this };
    delete obj.passwordHash;
    delete obj.password_hash;
    return obj;
  }

  async populate(field) {
    if (field === 'blockedUsers') {
      const ids = this.blockedUsers || [];
      if (ids.length > 0) {
        const User = (await import('./User.js')).default;
        const users = await User.find({ _id: { $in: ids } });
        this.blockedUsers = users;
      }
    }
    return this;
  }
}

function mapFromPostgres(row) {
  if (!row) return null;
  const coordinates = row.location_lng !== null && row.location_lat !== null 
    ? [Number(row.location_lng), Number(row.location_lat)] 
    : undefined;

  return new UserInstance({
    _id: row.id,
    id: row.id,
    supabaseId: row.id,
    email: row.email,
    username: row.username,
    name: row.name,
    age: row.age,
    dob: row.dob,
    gender: row.gender,
    avatar: row.avatar,
    bio: row.bio,
    role: row.role,
    isVerified: row.is_verified,
    isGuest: row.is_guest,
    isOnline: row.is_online,
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : null,
    bannedUntil: row.banned_until ? new Date(row.banned_until) : null,
    safetyViolationCount: row.safety_violation_count,
    blockedUsers: row.blocked_users || [],
    pushTokens: row.push_tokens || [],
    interests: row.interests || [],
    location: coordinates ? {
      type: 'Point',
      coordinates,
      updatedAt: row.location_updated_at ? new Date(row.location_updated_at) : null
    } : undefined,
    privacy: {
      showLastSeen: row.show_last_seen,
      readReceipts: row.read_receipts,
      vaultPassword: row.vault_password
    },
    safety: {
      blockedWords: row.blocked_words || []
    },
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null
  });
}

function mapFieldToPg(field) {
  const mapping = {
    _id: 'id',
    id: 'id',
    supabaseId: 'id',
    email: 'email',
    username: 'username',
    name: 'name',
    age: 'age',
    dob: 'dob',
    gender: 'gender',
    avatar: 'avatar',
    bio: 'bio',
    role: 'role',
    isVerified: 'is_verified',
    isGuest: 'is_guest',
    isOnline: 'is_online',
    lastSeenAt: 'last_seen_at',
    bannedUntil: 'banned_until',
    safetyViolationCount: 'safety_violation_count',
    blockedUsers: 'blocked_users',
    pushTokens: 'push_tokens',
    interests: 'interests',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  };
  return mapping[field] || field;
}

function applyFilters(q, query) {
  let res = q;
  for (const [key, value] of Object.entries(query)) {
    if (key === 'location' && value && value.$near) {
      const coords = value.$near.$geometry.coordinates;
      const maxDist = value.$near.$maxDistance || 25000;
      const latDiff = maxDist / 111000;
      const lngDiff = maxDist / (111000 * Math.cos(coords[1] * Math.PI / 180));
      res = res
        .gte('location_lat', coords[1] - latDiff)
        .lte('location_lat', coords[1] + latDiff)
        .gte('location_lng', coords[0] - lngDiff)
        .lte('location_lng', coords[0] + lngDiff);
      continue;
    }

    const pgKey = mapFieldToPg(key);
    
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
        } else if (op === '$regex') {
          const cleaned = val.startsWith('^') ? val.slice(1) : val;
          res = res.ilike(pgKey, `${cleaned}%`);
        } else if (op === '$exists') {
          if (val === true) {
            res = res.not(pgKey, 'is', null);
          } else {
            res = res.is(pgKey, null);
          }
        }
      }
    } else if (key === '$or') {
      const orStrings = value.map(filterObj => {
        const [orKey, orVal] = Object.entries(filterObj)[0];
        const pgOrKey = mapFieldToPg(orKey);
        if (orVal && typeof orVal === 'object') {
          if (orVal.$regex) {
            const cleaned = orVal.$regex.startsWith('^') ? orVal.$regex.slice(1) : orVal.$regex;
            return `${pgOrKey}.ilike.${cleaned}%`;
          }
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

const User = {
  async findOne(query = {}) {
    let q = supabaseAdmin.from('profiles').select('*');
    q = applyFilters(q, query);
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return mapFromPostgres(data);
  },

  async findById(id) {
    if (!id) return null;
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return mapFromPostgres(data);
  },

  async findByIdAndUpdate(id, update) {
    const pgUpdate = {};
    for (const [k, v] of Object.entries(update)) {
      pgUpdate[mapFieldToPg(k)] = v;
    }
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(pgUpdate)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return mapFromPostgres(data);
  },

  async create(data) {
    const inst = new UserInstance(data);
    return inst.save();
  },

  async exists(query) {
    let q = supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true });
    q = applyFilters(q, query);
    const { count, error } = await q;
    if (error) throw error;
    return count > 0;
  },

  async deleteOne(query) {
    let q = supabaseAdmin.from('profiles').delete();
    q = applyFilters(q, query);
    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  async countDocuments(query = {}) {
    let q = supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true });
    q = applyFilters(q, query);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  },

  async updateOne(filter, update) {
    const payload = {};
    if (update.$set) {
      for (const [k, v] of Object.entries(update.$set)) {
        payload[mapFieldToPg(k)] = v;
      }
    } else {
      for (const [k, v] of Object.entries(update)) {
        if (!k.startsWith('$')) {
          payload[mapFieldToPg(k)] = v;
        }
      }
    }
    let q = supabaseAdmin.from('profiles').update(payload);
    q = applyFilters(q, filter);
    const { error } = await q;
    if (error) throw error;
    return { modifiedCount: 1 };
  },

  async aggregate(pipeline) {
    const matchStage = pipeline.find(stage => stage.$match);
    const sampleStage = pipeline.find(stage => stage.$sample);
    
    let q = supabaseAdmin.from('profiles').select('*');
    if (matchStage) {
      q = applyFilters(q, matchStage.$match);
    }
    
    const { data, error } = await q;
    if (error) throw error;
    const mapped = (data || []).map(mapFromPostgres);
    
    if (sampleStage) {
      const shuffled = mapped.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, sampleStage.$sample.size);
    }
    return mapped;
  },

  find(query = {}) {
    let q = supabaseAdmin.from('profiles').select('*');
    q = applyFilters(q, query);

    const builder = {
      async then(resolve, reject) {
        try {
          const { data, error } = await q;
          if (error) throw error;
          const mapped = (data || []).map(mapFromPostgres);
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
          const pgField = mapFieldToPg(field);
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

export default User;
