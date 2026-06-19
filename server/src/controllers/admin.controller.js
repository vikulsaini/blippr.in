import mongoose from 'mongoose';
import User from '../models/User.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import AnalyticsBucket from '../models/AnalyticsBucket.js';
import AuditLog from '../models/AuditLog.js';
import { redis } from '../config/redis.js';
import { cloudinary } from '../config/cloudinary.js';
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

  res.json({
    ok: true,
    stats: {
      totalUsers,
      activeUsers,
      totalChats,
      totalMessages
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
  const db = mongoose.connection.db;
  if (!db) return res.status(503).json({ ok: false, message: 'Database not ready' });

  const collections = await db.listCollections().toArray();
  const stats = [];

  for (const coll of collections) {
    const name = coll.name;
    if (name.startsWith('system.')) continue;

    try {
      const collStats = await db.command({ collStats: name });
      stats.push({
        name,
        count: collStats.count,
        size: collStats.size,
        avgObjSize: collStats.avgObjSize || 0,
        storageSize: collStats.storageSize,
        nindexes: collStats.nindexes,
        indexSizes: collStats.indexSizes || {}
      });
    } catch (err) {
      const count = await db.collection(name).countDocuments();
      stats.push({
        name,
        count,
        size: 0,
        storageSize: 0,
        nindexes: 0,
        indexSizes: {},
        error: err.message
      });
    }
  }

  res.json({ ok: true, collections: stats });
});

export const runDbQuery = asyncHandler(async (req, res) => {
  const { collection, action, filter, update, projection, limit = 50, skip = 0 } = req.body;

  if (!collection || !action) {
    return res.status(400).json({ ok: false, message: 'Collection and Action are required' });
  }

  const db = mongoose.connection.db;
  if (!db) return res.status(503).json({ ok: false, message: 'Database not ready' });

  const coll = db.collection(collection);

  let queryFilter = filter || {};
  let updateDoc = update || {};
  let projDoc = projection || {};

  if (typeof filter === 'string' && filter.trim()) queryFilter = JSON.parse(filter);
  if (typeof update === 'string' && update.trim()) updateDoc = JSON.parse(update);
  if (typeof projection === 'string' && projection.trim()) projDoc = JSON.parse(projection);

  // Security checks
  const queryStr = JSON.stringify(queryFilter);
  if (queryStr.includes('$where')) {
    return res.status(403).json({ ok: false, message: '$where queries are forbidden for security reasons.' });
  }

  // Automatically convert string _id to ObjectID if valid
  if (queryFilter._id && typeof queryFilter._id === 'string' && mongoose.Types.ObjectId.isValid(queryFilter._id)) {
    queryFilter._id = new mongoose.Types.ObjectId(queryFilter._id);
  }

  let result;
  if (action === 'find') {
    result = await coll.find(queryFilter, { projection: projDoc })
      .skip(Number(skip))
      .limit(Math.min(100, Number(limit)))
      .toArray();
  } else if (action === 'updateOne') {
    result = await coll.updateOne(queryFilter, updateDoc);
  } else if (action === 'updateMany') {
    result = await coll.updateMany(queryFilter, updateDoc);
  } else {
    return res.status(400).json({ ok: false, message: 'Invalid action. Only find, updateOne, updateMany are allowed.' });
  }

  if (action !== 'find') {
    await AuditLog.create({
      action: `db_query:${action}`,
      actor: req.user._id,
      target: collection,
      details: { filter: queryFilter, update: updateDoc, result },
      ip: getClientIp(req)
    });
  }

  res.json({ ok: true, result });
});

export const getSlowQueries = asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;
  if (!db) return res.status(503).json({ ok: false, message: 'Database not ready' });

  try {
    await db.command({ profile: 1, slowms: 100 });
  } catch (err) {
    console.warn('Failed to set profiling level:', err.message);
  }

  let slowQueries = [];
  try {
    slowQueries = await db.collection('system.profile')
      .find()
      .sort({ ts: -1 })
      .limit(20)
      .toArray();
  } catch (err) {
    console.warn('system.profile query failed:', err.message);
  }

  let activeOps = [];
  try {
    const opStats = await db.command({ currentOp: 1, active: true });
    if (opStats && opStats.inprog) {
      activeOps = opStats.inprog.map(op => ({
        opid: op.opid,
        active: op.active,
        secs_running: op.secs_running,
        op: op.op,
        ns: op.ns,
        query: op.command || op.query,
        client: op.client
      }));
    }
  } catch (err) {
    console.warn('currentOp failed:', err.message);
  }

  res.json({
    ok: true,
    profilingEnabled: true,
    slowQueries: slowQueries.map(q => ({
      timestamp: q.ts,
      op: q.op,
      ns: q.ns,
      query: q.command || q.query,
      durationMs: q.millis,
      client: q.client,
      docsExamined: q.docsExamined,
      keysExamined: q.keysExamined
    })),
    activeOperations: activeOps
  });
});

/* ─── File Explorer ─── */
export const getFilesList = asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;
  if (!db) return res.status(503).json({ ok: false, message: 'Database not ready' });

  const { type = 'all', limit = 50, skip = 0 } = req.query;
  const files = [];

  if (type === 'all' || type === 'gridfs') {
    try {
      const gridFiles = await db.collection('blippr_media.files')
        .find()
        .sort({ uploadDate: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .toArray();

      gridFiles.forEach(f => {
        files.push({
          id: f._id.toString(),
          name: f.metadata?.originalName || f.filename,
          mimeType: f.contentType,
          size: f.length || f.metadata?.size || 0,
          url: `/api/media/files/${f._id}`,
          uploadedAt: f.uploadDate,
          provider: 'gridfs'
        });
      });
    } catch (err) {
      console.warn('Failed to query GridFS files:', err.message);
    }
  }

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

  res.json({ ok: true, files: files.slice(0, Number(limit)) });
});

export const deleteFile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { provider } = req.query;

  if (provider === 'gridfs') {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, message: 'Invalid file ID' });
    }
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'blippr_media' });
    await bucket.delete(new mongoose.Types.ObjectId(id));
  } else {
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
  const db = mongoose.connection.db;
  if (!db) return res.status(503).json({ ok: false, message: 'Database not ready' });

  let totalGridFsSize = 0;
  let gridFsCount = 0;
  const mimeTypeBreakdown = {};

  try {
    const gridFiles = await db.collection('blippr_media.files').find().toArray();
    gridFsCount = gridFiles.length;
    gridFiles.forEach(f => {
      totalGridFsSize += f.length || 0;
      const category = f.contentType ? f.contentType.split('/')[0] : 'other';
      mimeTypeBreakdown[category] = (mimeTypeBreakdown[category] || 0) + (f.length || 0);
    });
  } catch (err) {
    console.warn('GridFS stats warning:', err.message);
  }

  let totalCloudinarySize = 0;
  let cloudinaryCount = 0;
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

  res.json({
    ok: true,
    stats: {
      totalSize: totalGridFsSize + totalCloudinarySize,
      totalCount: gridFsCount + cloudinaryCount,
      gridfs: { size: totalGridFsSize, count: gridFsCount },
      cloudinary: { size: totalCloudinarySize, count: cloudinaryCount },
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
