import { supabaseAdmin } from '../config/supabase.js';

export function mapUserFromPostgres(row) {
  if (!row) return null;

  const coordinates = row.location_lng !== undefined && row.location_lng !== null && row.location_lat !== undefined && row.location_lat !== null
    ? [Number(row.location_lng), Number(row.location_lat)]
    : undefined;

  const user = {
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
    role: row.role || 'user',
    contact: row.contact || '',
    isVerified: row.is_verified ?? false,
    isGuest: row.is_guest ?? false,
    isOnline: row.is_online ?? false,
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : null,
    ipHistory: row.ip_history || [],
    bannedUntil: row.banned_until ? new Date(row.banned_until) : null,
    safetyViolationCount: row.safety_violation_count || 0,
    blockedUsers: row.blocked_users || [],
    pushTokens: row.push_tokens || [],
    interests: row.interests || [],
    location: coordinates ? {
      type: 'Point',
      coordinates,
      updatedAt: row.location_updated_at ? new Date(row.location_updated_at) : null
    } : undefined,
    privacy: {
      showLastSeen: row.show_last_seen ?? true,
      readReceipts: row.read_receipts ?? true,
      vaultPassword: row.vault_password
    },
    safety: {
      blockedWords: row.blocked_words || []
    },
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,

    async save() {
      const { userRepository } = await import('../repositories/user.repository.js');
      const updated = await userRepository.update(this.id, this);
      Object.assign(this, updated);
      return this;
    }
  };

  return user;
}

export function mapUserToPostgres(user) {
  if (!user) return null;

  const payload = {};

  if (user.username !== undefined) payload.username = user.username;
  if (user.name !== undefined) payload.name = user.name;
  if (user.email !== undefined) payload.email = user.email;
  if (user.age !== undefined) payload.age = user.age ? Number(user.age) : null;
  if (user.dob !== undefined) payload.dob = user.dob;
  if (user.gender !== undefined) payload.gender = user.gender;
  if (user.avatar !== undefined) payload.avatar = user.avatar;
  if (user.bio !== undefined) payload.bio = user.bio;
  if (user.contact !== undefined) payload.contact = user.contact || '';

  // Location mapping
  if (user.location !== undefined) {
    payload.location_lat = user.location?.coordinates?.[1] || null;
    payload.location_lng = user.location?.coordinates?.[0] || null;
    payload.location_updated_at = user.location?.updatedAt || new Date();
  } else {
    if (user.location_lat !== undefined) payload.location_lat = user.location_lat;
    if (user.location_lng !== undefined) payload.location_lng = user.location_lng;
    if (user.location_updated_at !== undefined) payload.location_updated_at = user.location_updated_at;
  }

  if (user.interests !== undefined) payload.interests = user.interests || [];

  // Privacy mapping
  if (user.privacy !== undefined) {
    if (user.privacy.showLastSeen !== undefined) payload.show_last_seen = user.privacy.showLastSeen;
    if (user.privacy.readReceipts !== undefined) payload.read_receipts = user.privacy.readReceipts;
    if (user.privacy.vaultPassword !== undefined) payload.vault_password = user.privacy.vaultPassword;
  } else {
    if (user.show_last_seen !== undefined) payload.show_last_seen = user.show_last_seen;
    if (user.read_receipts !== undefined) payload.read_receipts = user.read_receipts;
    if (user.vault_password !== undefined) payload.vault_password = user.vault_password;
  }

  // Safety mapping
  if (user.safety !== undefined) {
    if (user.safety.blockedWords !== undefined) payload.blocked_words = user.safety.blockedWords;
  } else {
    if (user.blocked_words !== undefined) payload.blocked_words = user.blocked_words;
  }

  if (user.blockedUsers !== undefined) payload.blocked_users = user.blockedUsers;
  else if (user.blocked_users !== undefined) payload.blocked_users = user.blocked_users;

  if (user.pushTokens !== undefined) payload.push_tokens = user.pushTokens;
  else if (user.push_tokens !== undefined) payload.push_tokens = user.push_tokens;

  if (user.isOnline !== undefined) payload.is_online = user.isOnline;
  else if (user.is_online !== undefined) payload.is_online = user.is_online;

  if (user.isGuest !== undefined) payload.is_guest = user.isGuest;
  else if (user.is_guest !== undefined) payload.is_guest = user.is_guest;

  if (user.role !== undefined) payload.role = user.role;

  if (user.isVerified !== undefined) payload.is_verified = user.isVerified;
  else if (user.is_verified !== undefined) payload.is_verified = user.is_verified;

  if (user.safetyViolationCount !== undefined) payload.safety_violation_count = user.safetyViolationCount;
  else if (user.safety_violation_count !== undefined) payload.safety_violation_count = user.safety_violation_count;

  if (user.bannedUntil !== undefined) payload.banned_until = user.bannedUntil;
  else if (user.banned_until !== undefined) payload.banned_until = user.banned_until;

  if (user.lastSeenAt !== undefined) payload.last_seen_at = user.lastSeenAt;
  else if (user.last_seen_at !== undefined) payload.last_seen_at = user.last_seen_at;

  if (user.lastIp !== undefined) payload.last_ip = user.lastIp;
  else if (user.last_ip !== undefined) payload.last_ip = user.last_ip;

  if (user.ipHistory !== undefined) payload.ip_history = user.ipHistory;
  else if (user.ip_history !== undefined) payload.ip_history = user.ip_history;

  payload.updated_at = new Date();

  return payload;
}
