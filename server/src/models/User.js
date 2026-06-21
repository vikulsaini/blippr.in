import crypto from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { userRepository } from '../repositories/user.repository.js';
import { avatarForGender } from '../utils/identity.js';

const User = {
  findById(id) {
    const builder = {
      async then(resolve, reject) {
        try {
          if (!id) return resolve(null);
          const res = await userRepository.findById(id);
          resolve(res);
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
    return userRepository.findOne(query);
  },

  async exists(query = {}) {
    return userRepository.exists(query);
  },

  async create(data) {
    let id = data.supabaseId || data._id || data.id;
    let email = data.email;
    if (!id) {
      const guestEmail = `guest_${crypto.randomUUID()}@blippr.local`;
      const guestPassword = crypto.randomUUID();
      email = guestEmail;
      
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: guestEmail,
        password: guestPassword,
        email_confirm: true,
        user_metadata: {
          is_guest: true,
          name: data.name || 'Guest User',
          username: data.username || `guest_${crypto.randomUUID().substring(0, 8)}`,
          avatar: data.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${crypto.randomUUID()}`
        }
      });
      if (authError) throw authError;
      id = authData.user.id;
    }

    return userRepository.create({ ...data, id, email });
  },

  async updateOne(filter = {}, update = {}) {
    const id = filter.id || filter._id || filter.supabaseId;
    if (!id) return { modifiedCount: 0 };
    await userRepository.update(id, update);
    return { modifiedCount: 1 };
  },

  async findByIdAndUpdate(id, update = {}) {
    return userRepository.update(id, update);
  },

  async deleteOne(query = {}) {
    const id = query.id || query._id;
    if (!id) return { deletedCount: 0 };
    await userRepository.delete(id);
    return { deletedCount: 1 };
  },

  async countDocuments(query = {}) {
    return userRepository.count(query);
  },

  async aggregate(pipeline) {
    const matchStage = pipeline.find(stage => stage.$match) || {};
    const sampleStage = pipeline.find(stage => stage.$sample) || {};
    const match = matchStage.$match || {};
    const size = sampleStage.$sample?.size || 20;

    const matchCriteria = {
      isOnline: match.isOnline,
      isGuest: match.is_guest !== undefined ? match.is_guest : match.isGuest,
      age: match.age
    };

    if (match._id && match._id.$nin) {
      matchCriteria._id = { $nin: match._id.$nin };
    }

    return userRepository.randomSample(matchCriteria, size);
  },

  find(query = {}) {
    let limitVal = null;
    let sortVal = null;
    const builder = {
      limit(n) { limitVal = n; return this; },
      sort(s) { sortVal = s; return this; },
      select() { return this; },
      lean() { return this; },
      async then(resolve, reject) {
        try {
          let excludedIds = [];
          if (query._id && query._id.$nin) {
            excludedIds = query._id.$nin;
          } else if (query._id && query._id.$in) {
            // standard find
          }
          
          let coordinates = null;
          let maxDistance = 25000;
          if (query.location && query.location.$near) {
            coordinates = query.location.$near.$geometry.coordinates;
            maxDistance = query.location.$near.$maxDistance || 25000;
          }

          let res;
          if (coordinates) {
            res = await userRepository.findNearby(coordinates, maxDistance, excludedIds, limitVal || 20);
          } else {
            res = await userRepository.find(query, { sort: sortVal, limit: limitVal });
          }
          resolve(res);
        } catch (err) {
          reject(err);
        }
      }
    };
    return builder;
  }
};

export default User;
