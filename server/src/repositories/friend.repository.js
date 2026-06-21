import { db } from '../config/database.js';
import { mapFriendRequestFromPostgres } from '../models/FriendRequest.js';
import { mapUserFromPostgres } from '../utils/userMapper.js';

export const friendRepository = {
  /**
   * Check if a friend request exists.
   */
  async exists(query = {}) {
    let q = db.from('friend_requests').select('id');
    
    if (query.status) q = q.eq('status', query.status);
    
    if (query.$or) {
      const orStr = query.$or.map(o => {
        const parts = [];
        if (o.from) parts.push(`from_id.eq.${o.from}`);
        if (o.to) parts.push(`to_id.eq.${o.to}`);
        return parts.join(',');
      }).join(',');
      q = q.or(orStr);
    } else {
      if (query.from) q = q.eq('from_id', query.from);
      if (query.to) q = q.eq('to_id', query.to);
    }

    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return !!data;
  },

  /**
   * Find a single friend request matching a query.
   */
  async findOne(query = {}) {
    let q = db.from('friend_requests').select('*');
    
    if (query.$or) {
      const orStr = query.$or.map(o => {
        const parts = [];
        if (o.from) parts.push(`from_id.eq.${o.from}`);
        if (o.to) parts.push(`to_id.eq.${o.to}`);
        return parts.join(',');
      }).join(',');
      q = q.or(orStr);
    } else {
      if (query.from) q = q.eq('from_id', query.from);
      if (query.to) q = q.eq('to_id', query.to);
      if (query.status) q = q.eq('status', query.status);
      if (query.id || query._id) q = q.eq('id', query.id || query._id);
    }

    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    return mapFriendRequestFromPostgres(data);
  },

  /**
   * Find a friend request by ID.
   */
  async findById(id) {
    if (!id) return null;
    const { data, error } = await db
      .from('friend_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return mapFriendRequestFromPostgres(data);
  },

  /**
   * Create a new friend request.
   */
  async create(data) {
    const payload = {
      from_id: data.from,
      to_id: data.to,
      status: data.status || 'pending',
      updated_at: new Date()
    };
    const { data: row, error } = await db
      .from('friend_requests')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return mapFriendRequestFromPostgres(row);
  },

  /**
   * Delete friend requests matching a query.
   */
  async deleteMany(query = {}) {
    let q = db.from('friend_requests').delete();
    
    if (query.$or) {
      const orStr = query.$or.map(o => {
        const parts = [];
        if (o.from) parts.push(`from_id.eq.${o.from}`);
        if (o.to) parts.push(`to_id.eq.${o.to}`);
        return parts.join(',');
      }).join(',');
      q = q.or(orStr);
    } else {
      if (query.from) q = q.eq('from_id', query.from);
      if (query.to) q = q.eq('to_id', query.to);
      if (query.id || query._id) q = q.eq('id', query.id || query._id);
    }

    const { error } = await q;
    if (error) throw error;
    return { deletedCount: 1 };
  },

  /**
   * Find multiple friend requests.
   */
  async find(query = {}, options = {}) {
    let selectStr = '*';
    if (options.populateFrom || options.populateTo) {
      const fromField = options.populateFrom ? 'from_id:profiles(*)' : 'from_id';
      const toField = options.populateTo ? 'to_id:profiles(*)' : 'to_id';
      selectStr = `*, ${fromField}, ${toField}`;
    }

    let q = db.from('friend_requests').select(selectStr);
    
    if (query.$or) {
      const orStr = query.$or.map(o => {
        const parts = [];
        if (o.from) parts.push(`from_id.eq.${o.from}`);
        if (o.to) parts.push(`to_id.eq.${o.to}`);
        return parts.join(',');
      }).join(',');
      q = q.or(orStr);
    } else {
      if (query.from) q = q.eq('from_id', query.from);
      if (query.to) q = q.eq('to_id', query.to);
      if (query.status) q = q.eq('status', query.status);
    }

    if (options.sort) {
      const desc = options.sort.startsWith('-');
      const field = desc ? options.sort.slice(1) : options.sort;
      const pgField = field === 'createdAt' ? 'created_at' : (field === 'from' ? 'from_id' : 'to_id');
      q = q.order(pgField, { ascending: !desc });
    }

    if (options.limit) {
      q = q.limit(options.limit);
    }

    const { data, error } = await q;
    if (error) throw error;

    return (data || []).map(row => {
      // Map relational loads if present
      const req = mapFriendRequestFromPostgres(row);
      if (row.from_id && typeof row.from_id === 'object') {
        req.from = mapUserFromPostgres(row.from_id);
      }
      if (row.to_id && typeof row.to_id === 'object') {
        req.to = mapUserFromPostgres(row.to_id);
      }
      return req;
    });
  },

  /**
   * Update friend request status.
   */
  async update(id, status) {
    const { data, error } = await db
      .from('friend_requests')
      .update({ status, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapFriendRequestFromPostgres(data);
  }
};
