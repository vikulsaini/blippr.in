import { db } from '../config/database.js';
import { mapUserFromPostgres, mapUserToPostgres } from '../utils/userMapper.js';

export const userRepository = {
  /**
   * Find a user profile by ID.
   * @param {string} id - The user UUID
   */
  async findById(id) {
    if (!id) return null;
    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return mapUserFromPostgres(data);
  },

  /**
   * Find a user profile by email address.
   * @param {string} email
   */
  async findByEmail(email) {
    if (!email) return null;
    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error) throw error;
    return mapUserFromPostgres(data);
  },

  /**
   * Find a user profile by username.
   * @param {string} username
   */
  async findByUsername(username) {
    if (!username) return null;
    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('username', username.toLowerCase())
      .maybeSingle();

    if (error) throw error;
    return mapUserFromPostgres(data);
  },

  /**
   * Find a single user profile matching a criteria.
   * Supports email, username, and _id/id/supabaseId.
   */
  async findOne(query = {}) {
    let q = db.from('profiles').select('*');
    if (query.email) {
      q = q.eq('email', query.email.toLowerCase());
    } else if (query.username) {
      q = q.eq('username', query.username.toLowerCase());
    } else if (query.supabaseId || query.id || query._id) {
      q = q.eq('id', query.supabaseId || query.id || query._id);
    } else if (query.isGuest !== undefined) {
      q = q.eq('is_guest', query.isGuest);
    } else if (query.lastIp) {
      q = q.eq('last_ip', query.lastIp);
    }

    if (query.updatedAt && query.updatedAt.$gte) {
      q = q.gte('updated_at', new Date(query.updatedAt.$gte).toISOString());
    }

    const { data, error } = await q.order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return mapUserFromPostgres(data);
  },

  /**
   * Check if a user profile exists.
   */
  async exists(query = {}) {
    let q = db.from('profiles').select('id');
    if (query.username) {
      q = q.eq('username', query.username.toLowerCase());
    } else if (query.email) {
      q = q.eq('email', query.email.toLowerCase());
    } else if (query._id || query.id) {
      q = q.eq('id', query._id || query.id);
    }

    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return !!data;
  },

  /**
   * Create a new user profile record in PostgreSQL.
   */
  async create(profileData) {
    const pgPayload = mapUserToPostgres(profileData);
    pgPayload.id = profileData.supabaseId || profileData._id || profileData.id;

    const { data, error } = await db
      .from('profiles')
      .upsert(pgPayload)
      .select()
      .single();

    if (error) throw error;
    return mapUserFromPostgres(data);
  },

  /**
   * Update an existing user profile by ID.
   */
  async update(id, updateData = {}) {
    const setObj = updateData.$set || updateData;
    const pgPayload = mapUserToPostgres(setObj);
    delete pgPayload.id; // Primary key cannot be updated

    const { data, error } = await db
      .from('profiles')
      .update(pgPayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return mapUserFromPostgres(data);
  },

  /**
   * Delete a profile from the database.
   */
  async delete(id) {
    const { error } = await db
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  /**
   * Count total profiles matching criteria.
   */
  async count(query = {}) {
    let q = db.from('profiles').select('id', { count: 'exact', head: true });
    if (query.role) q = q.eq('role', query.role);
    if (query.isGuest !== undefined) q = q.eq('is_guest', query.isGuest);
    if (query.isOnline !== undefined) q = q.eq('is_online', query.isOnline);
    if (query.isVerified !== undefined) q = q.eq('is_verified', query.isVerified);

    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  },

  /**
   * Find multiple users by filter.
   */
  async find(query = {}, options = {}) {
    let q = db.from('profiles').select('*');
    
    if (query._id) {
      if (query._id.$in) {
        q = q.in('id', query._id.$in);
      } else if (query._id.$nin) {
        q = q.not('id', 'in', `(${query._id.$nin.join(',')})`);
      } else {
        q = q.eq('id', query._id);
      }
    }
    if (query.role) q = q.eq('role', query.role);
    if (query.isGuest !== undefined) q = q.eq('is_guest', query.isGuest);
    if (query.isOnline !== undefined) q = q.eq('is_online', query.isOnline);
    if (query.gender) q = q.eq('gender', query.gender);

    if (options.sort) {
      const sortStr = typeof options.sort === 'string' 
        ? options.sort 
        : (typeof options.sort === 'object' && options.sort !== null
            ? (Object.values(options.sort)[0] === -1 || String(Object.values(options.sort)[0]).toLowerCase() === 'desc' 
                ? `-${Object.keys(options.sort)[0]}` 
                : Object.keys(options.sort)[0]) 
            : '');
      
      const desc = sortStr.startsWith('-');
      const field = desc ? sortStr.slice(1) : sortStr;
      const pgField = field === 'createdAt' ? 'created_at' : (field === 'lastSeenAt' ? 'last_seen_at' : field);
      q = q.order(pgField, { ascending: !desc });
    }
    if (options.limit) {
      q = q.limit(options.limit);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(mapUserFromPostgres);
  },

  /**
   * Search profiles by username or name.
   */
  async search(q, excludedIds = [], limit = 20) {
    let queryBuilder = db.from('profiles').select('*');

    if (q) {
      queryBuilder = queryBuilder.or(`username.ilike.${q}%,name.ilike.${q}%`);
    }

    if (excludedIds.length > 0) {
      queryBuilder = queryBuilder.not('id', 'in', `(${excludedIds.join(',')})`);
    }

    const { data, error } = await queryBuilder.limit(limit);
    if (error) throw error;
    return (data || []).map(mapUserFromPostgres);
  },

  /**
   * Get suggested active users.
   */
  async suggested(excludedIds = [], limit = 20) {
    let q = db.from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (excludedIds.length > 0) {
      q = q.not('id', 'in', `(${excludedIds.join(',')})`);
    }

    const { data, error } = await q.limit(limit);
    if (error) throw error;
    return (data || []).map(mapUserFromPostgres);
  },

  /**
   * Get a random sample of active users.
   * Utilizes Javascript sorting as PostgreSQL doesn't natively sample.
   */
  async randomSample(matchCriteria = {}, size = 20) {
    let q = db.from('profiles').select('*');
    if (matchCriteria.isOnline !== undefined) q = q.eq('is_online', matchCriteria.isOnline);
    if (matchCriteria.isGuest !== undefined) q = q.eq('is_guest', matchCriteria.isGuest);
    if (matchCriteria.age && matchCriteria.age.$gte) q = q.gte('age', matchCriteria.age.$gte);
    if (matchCriteria._id && matchCriteria._id.$nin) {
      q = q.not('id', 'in', `(${matchCriteria._id.$nin.join(',')})`);
    }

    const { data, error } = await q;
    if (error) throw error;
    
    const mapped = (data || []).map(mapUserFromPostgres);
    const shuffled = mapped.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, size);
  },

  /**
   * Find nearby users using geographical box bounding filtering.
   */
  async findNearby(coordinates, maxDistance = 25000, excludedIds = [], limit = 20, cursor = null) {
    let q = db.from('profiles').select('*').eq('is_online', true).gte('age', 18);

    const latDiff = maxDistance / 111000;
    const lngDiff = maxDistance / (111000 * Math.cos(coordinates[1] * Math.PI / 180));

    q = q.gte('location_lat', coordinates[1] - latDiff)
         .lte('location_lat', coordinates[1] + latDiff)
         .gte('location_lng', coordinates[0] - lngDiff)
         .lte('location_lng', coordinates[0] + lngDiff);

    if (excludedIds.length > 0) {
      q = q.not('id', 'in', `(${excludedIds.join(',')})`);
    }

    if (cursor) {
      q = q.lt('last_seen_at', cursor.toISOString());
    }

    const { data, error } = await q.order('last_seen_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data || []).map(mapUserFromPostgres);
  },

  /**
   * Find available matchmaking users (nearby or general active).
   */
  async findAvailable(baseFilter, limit = 20, coordinates = null, maxDistance = 25000, cursor = null) {
    let q = db.from('profiles').select('*').eq('is_online', true).gte('age', 18);

    if (baseFilter._id && baseFilter._id.$nin) {
      q = q.not('id', 'in', `(${baseFilter._id.$nin.join(',')})`);
    }

    if (coordinates?.length) {
      const latDiff = maxDistance / 111000;
      const lngDiff = maxDistance / (111000 * Math.cos(coordinates[1] * Math.PI / 180));
      q = q.gte('location_lat', coordinates[1] - latDiff)
           .lte('location_lat', coordinates[1] + latDiff)
           .gte('location_lng', coordinates[0] - lngDiff)
           .lte('location_lng', coordinates[0] + lngDiff);
    }

    if (cursor) {
      q = q.lt('last_seen_at', cursor.toISOString());
    }

    const { data, error } = await q.order('last_seen_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data || []).map(mapUserFromPostgres);
  }
};
