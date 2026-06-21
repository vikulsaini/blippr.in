import User from '../models/User.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import AnalyticsBucket from '../models/AnalyticsBucket.js';
import AuditLog from '../models/AuditLog.js';
import { redis } from '../config/redis.js';
import { cloudinary } from '../config/cloudinary.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getClientIp } from '../utils/clientIp.js';

// Temporary endpoint to claim the first admin account
export const claimAdmin = asyncHandler(async (req, res) => {
  const { secret } = req.body;
  if (secret !== 'BlipprAdminSecret2026') {
    return res.status(403).json({ ok: false, message: 'Invalid secret' });
  }

  const user = req.user;
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

  user.role = 'admin';
  user.isVerified = true;
  await user.save();

  res.json({ ok: true, message: 'You are now an admin!' });
});

export const getStats = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ isOnline: true });
  const totalChats = await Chat.countDocuments();
  const totalMessages = await Message.countDocuments();
  const verifiedUsers = await User.countDocuments({ isVerified: true });
  const guestUsers = await User.countDocuments({ isGuest: true });

  // Calculate endpoint statistics dynamically from Analytics buckets
  const recentBuckets = await AnalyticsBucket.find({ interval: 'minute' })
    .sort({ timestamp: -1 })
    .limit(30);

  const counts = { auth: 0, chats: 0, users: 0, media: 0, calls: 0 };
  let grandTotal = 0;

  recentBuckets.forEach(b => {
    if (b.endpoints) {
      for (const [key, val] of b.endpoints.entries()) {
        const path = key.toLowerCase();
        grandTotal += val;
        if (path.includes('/api/auth')) counts.auth += val;
        else if (path.includes('/api/chats')) counts.chats += val;
        else if (path.includes('/api/users')) counts.users += val;
        else if (path.includes('/api/media')) counts.media += val;
        else if (path.includes('/api/calls')) counts.calls += val;
      }
    }
  });

  const endpointPercentages = {
    auth: grandTotal > 0 ? Math.round((counts.auth / grandTotal) * 100) : 35,
    chats: grandTotal > 0 ? Math.round((counts.chats / grandTotal) * 100) : 25,
    users: grandTotal > 0 ? Math.round((counts.users / grandTotal) * 100) : 20,
    media: grandTotal > 0 ? Math.round((counts.media / grandTotal) * 100) : 12,
    calls: grandTotal > 0 ? Math.round((counts.calls / grandTotal) * 100) : 8
  };

  res.json({
    ok: true,
    stats: {
      totalUsers,
      activeUsers,
      totalChats,
      totalMessages,
      verifiedUsers,
      guestUsers,
      endpointPercentages,
      adminUser: {
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar
      }
    }
  });
});

export const searchUsers = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const filter = {};
  if (q) {
    const escapedQ = String(q || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: '^' + escapedQ, $options: 'i' } },
      { username: { $regex: '^' + escapedQ, $options: 'i' } },
      { email: { $regex: '^' + escapedQ, $options: 'i' } }
    ];
  }

  const users = await User.find(filter)
    .select('name username email role isVerified isOnline lastSeenAt createdAt safetyViolationCount bannedUntil avatar')
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({ ok: true, users });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, value } = req.body; // action: 'ban', 'verify', 'role'

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

  if (action === 'ban') {
    if (value) {
      // Ban for 100 years
      user.bannedUntil = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
    } else {
      user.bannedUntil = null;
    }
  } else if (action === 'verify') {
    user.isVerified = !!value;
  } else if (action === 'role') {
    user.role = value;
  }

  await user.save();

  // Log action
  await AuditLog.create({
    action: `user_status:${action}`,
    actor: req.user._id,
    target: id,
    details: { value },
    ip: getClientIp(req)
  });

  res.json({ ok: true, user });
});

export const broadcastMessage = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ ok: false, message: 'Message is required' });

  const io = req.app.get('io');
  if (io) {
    io.fetchSockets().then((sockets) => {
      const batchSize = 100;
      let index = 0;
      function sendBatch() {
        const batch = sockets.slice(index, index + batchSize);
        if (batch.length === 0) return;
        for (const s of batch) {
          s.emit('system:broadcast', { message, timestamp: new Date() });
        }
        index += batchSize;
        if (index < sockets.length) {
          setTimeout(sendBatch, 50);
        }
      }
      sendBatch();
    }).catch((err) => {
      console.error('Failed to fetch sockets for broadcast:', err);
    });
  }

  res.json({ ok: true, message: 'Broadcast sent' });
});

/* ─── Real-Time Analytics ─── */
export const getAdminMetrics = asyncHandler(async (req, res) => {
  const minuteBuckets = await AnalyticsBucket.find({ interval: 'minute' })
    .sort({ timestamp: -1 })
    .limit(60);

  const hourBuckets = await AnalyticsBucket.find({ interval: 'hour' })
    .sort({ timestamp: -1 })
    .limit(24);

  res.json({
    ok: true,
    metrics: {
      minute: minuteBuckets.reverse(),
      hour: hourBuckets.reverse()
    }
  });
});

/* ─── Database Administration ─── */
export const getDbStats = asyncHandler(async (req, res) => {
  // Query PostgreSQL table counts in Supabase
  const counts = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }).then(r => r.count || 0),
    db.from('chats').select('id', { count: 'exact', head: true }).then(r => r.count || 0),
    db.from('messages').select('id', { count: 'exact', head: true }).then(r => r.count || 0),
    db.from('calls').select('id', { count: 'exact', head: true }).then(r => r.count || 0),
    db.from('friend_requests').select('id', { count: 'exact', head: true }).then(r => r.count || 0),
    db.from('notifications').select('id', { count: 'exact', head: true }).then(r => r.count || 0),
    db.from('reports').select('id', { count: 'exact', head: true }).then(r => r.count || 0),
    db.from('audit_logs').select('id', { count: 'exact', head: true }).then(r => r.count || 0)
  ]);

  const stats = [
    { name: 'profiles', count: counts[0], provider: 'postgres' },
    { name: 'chats', count: counts[1], provider: 'postgres' },
    { name: 'messages', count: counts[2], provider: 'postgres' },
    { name: 'calls', count: counts[3], provider: 'postgres' },
    { name: 'friend_requests', count: counts[4], provider: 'postgres' },
    { name: 'notifications', count: counts[5], provider: 'postgres' },
    { name: 'reports', count: counts[6], provider: 'postgres' },
    { name: 'audit_logs', count: counts[7], provider: 'postgres' }
  ];

  res.json({ ok: true, collections: stats });
});

export const runDbQuery = asyncHandler(async (req, res) => {
  // For security, disable ad-hoc queries against production PostgreSQL
  res.status(501).json({
    ok: false,
    message: 'Ad-hoc database queries are disabled on PostgreSQL for security.'
  });
});

export const getSlowQueries = asyncHandler(async (req, res) => {
  // Slow queries should be checked from Supabase Dashboard
  res.json({
    ok: true,
    profilingEnabled: false,
    slowQueries: [],
    activeOperations: []
  });
});

/* ─── File Explorer ─── */
export const getFilesList = asyncHandler(async (req, res) => {
  const { type = 'all', limit = 50, skip = 0 } = req.query;
  const files = [];

  const cloudinaryReady = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  if (cloudinaryReady && (type === 'all' || type === 'cloudinary')) {
    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: 'blippr/',
        max_results: Number(limit)
      });
      if (result && result.resources) {
        result.resources.forEach(r => {
          files.push({
            id: r.public_id,
            name: r.public_id.split('/').pop(),
            mimeType: r.format ? `${r.resource_type}/${r.format}` : r.resource_type,
            size: r.bytes,
            url: r.secure_url,
            uploadedAt: r.created_at,
            provider: 'cloudinary'
          });
        });
      }
    } catch (err) {
      console.warn('Failed to fetch Cloudinary files:', err.message);
    }
  }

  if (supabaseAdmin && (type === 'all' || type === 'supabase')) {
    try {
      const bucketName = process.env.SUPABASE_BUCKET || 'media';
      const { data, error } = await supabaseAdmin.storage.from(bucketName).list('', {
        limit: Number(limit),
        offset: Number(skip),
        sortBy: { column: 'created_at', order: 'desc' }
      });
      if (error) throw error;
      if (data) {
        data.forEach(item => {
          const { data: { publicUrl } } = supabaseAdmin.storage.from(bucketName).getPublicUrl(item.name);
          files.push({
            id: item.name,
            name: item.name,
            mimeType: item.metadata?.mimetype || 'application/octet-stream',
            size: item.metadata?.size || 0,
            url: publicUrl,
            uploadedAt: item.created_at,
            provider: 'supabase'
          });
        });
      }
    } catch (err) {
      console.warn('Failed to fetch Supabase files:', err.message);
    }
  }

  res.json({ ok: true, files: files.slice(0, Number(limit)) });
});

export const deleteFile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { provider } = req.query;

  if (provider === 'supabase') {
    const bucketName = process.env.SUPABASE_BUCKET || 'media';
    const { error } = await supabaseAdmin.storage.from(bucketName).remove([id]);
    if (error) throw error;
  } else if (provider === 'cloudinary') {
    await cloudinary.uploader.destroy(id);
  }

  await AuditLog.create({
    action: 'delete_file',
    actor: req.user._id,
    target: id,
    details: { provider },
    ip: getClientIp(req)
  });

  res.json({ ok: true, message: 'File deleted successfully' });
});

export const getFileStats = asyncHandler(async (req, res) => {
  let totalCloudinarySize = 0;
  let cloudinaryCount = 0;
  const mimeTypeBreakdown = {};

  const cloudinaryReady = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  if (cloudinaryReady) {
    try {
      const result = await cloudinary.api.resources({ type: 'upload', prefix: 'blippr/' });
      if (result && result.resources) {
        cloudinaryCount = result.resources.length;
        result.resources.forEach(r => {
          totalCloudinarySize += r.bytes || 0;
          const category = r.resource_type || 'other';
          mimeTypeBreakdown[category] = (mimeTypeBreakdown[category] || 0) + (r.bytes || 0);
        });
      }
    } catch (err) {
      console.warn('Cloudinary stats warning:', err.message);
    }
  }

  let totalSupabaseSize = 0;
  let supabaseCount = 0;
  if (supabaseAdmin) {
    try {
      const bucketName = process.env.SUPABASE_BUCKET || 'media';
      const { data, error } = await supabaseAdmin.storage.from(bucketName).list();
      if (error) throw error;
      if (data) {
        supabaseCount = data.length;
        data.forEach(item => {
          const size = item.metadata?.size || 0;
          totalSupabaseSize += size;
          const category = item.metadata?.mimetype ? item.metadata.mimetype.split('/')[0] : 'other';
          mimeTypeBreakdown[category] = (mimeTypeBreakdown[category] || 0) + size;
        });
      }
    } catch (err) {
      console.warn('Supabase storage stats warning:', err.message);
    }
  }

  res.json({
    ok: true,
    stats: {
      totalSize: totalCloudinarySize + totalSupabaseSize,
      totalCount: cloudinaryCount + supabaseCount,
      gridfs: { size: 0, count: 0 },
      cloudinary: { size: totalCloudinarySize, count: cloudinaryCount },
      supabase: { size: totalSupabaseSize, count: supabaseCount },
      breakdown: mimeTypeBreakdown
    }
  });
});

/* ─── Session Revocation ─── */
export const revokeUserSessions = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const revocationTimestamp = Math.floor(Date.now() / 1000);
  await redis.set(`user_revoked_at:${id}`, revocationTimestamp);

  const io = req.app.get('io');
  if (io) {
    const sockets = await io.in(`user:${id}`).fetchSockets();
    sockets.forEach(socket => {
      socket.emit('auth:revoked');
      socket.disconnect(true);
    });
  }

  await User.findByIdAndUpdate(id, { isOnline: false });

  await AuditLog.create({
    action: 'revoke_sessions',
    actor: req.user._id,
    target: id,
    details: { timestamp: revocationTimestamp },
    ip: getClientIp(req)
  });

  res.json({ ok: true, message: 'Sessions revoked and user disconnected' });
});

/* ─── Audit Logging ─── */
export const getAuditLogs = asyncHandler(async (req, res) => {
  const logs = await AuditLog.find()
    .populate('actor', 'name username email')
    .sort({ timestamp: -1 })
    .limit(100);

  res.json({ ok: true, logs });
});
