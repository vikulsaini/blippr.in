import { supabaseAdmin } from '../config/supabase.js';

export function mapUserFromPostgres(row) {
  if (!row) return null;

  const coordinates = row.location_lng !== null && row.location_lat !== null 
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
    isVerified: row.is_verified ?? false,
    isGuest: row.is_guest ?? false,
    isOnline: row.is_online ?? false,
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : null,
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
      const pgPayload = mapUserToPostgres(this);
      delete pgPayload.id; // Primary key cannot be updated
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(pgPayload)
        .eq('id', this.id)
        .select()
        .single();
      if (error) throw error;
      Object.assign(this, mapUserFromPostgres(data));
      return this;
    }
  };

  return user;
}

export function mapUserToPostgres(user) {
  if (!user) return null;

  return {
    username: user.username,
    name: user.name,
    email: user.email,
    age: user.age ? Number(user.age) : undefined,
    dob: user.dob,
    gender: user.gender,
    avatar: user.avatar,
    bio: user.bio,
    location_lat: user.location?.coordinates?.[1] || user.location_lat,
    location_lng: user.location?.coordinates?.[0] || user.location_lng,
    location_updated_at: user.location?.updatedAt || user.location_updated_at || new Date(),
    interests: user.interests || [],
    show_last_seen: user.privacy?.showLastSeen ?? user.show_last_seen ?? true,
    read_receipts: user.privacy?.readReceipts ?? user.read_receipts ?? true,
    vault_password: user.privacy?.vaultPassword ?? user.vault_password,
    blocked_words: user.safety?.blockedWords ?? user.blocked_words ?? [],
    blocked_users: user.blockedUsers || user.blocked_users || [],
    push_tokens: user.pushTokens || user.push_tokens || [],
    is_online: user.isOnline ?? user.is_online ?? false,
    is_guest: user.isGuest ?? user.is_guest ?? false,
    role: user.role || 'user',
    safety_violation_count: user.safetyViolationCount ?? user.safety_violation_count ?? 0,
    banned_until: user.bannedUntil ?? user.banned_until,
    last_seen_at: user.lastSeenAt ?? user.last_seen_at ?? new Date(),
    last_ip: user.lastIp ?? user.last_ip,
    updated_at: new Date()
  };
}
