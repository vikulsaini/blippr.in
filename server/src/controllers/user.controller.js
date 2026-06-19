import Joi from 'joi';
import mongoose from 'mongoose';
import Chat from '../models/Chat.js';
import FriendRequest from '../models/FriendRequest.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import Call from '../models/Call.js';
import NotificationSubscription from '../models/NotificationSubscription.js';
import { deleteMediaByUrl } from '../services/media.service.js';
import { clearAuthCookie } from '../utils/authCookie.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const updateProfileSchema = Joi.object({
  name: Joi.string().max(80).optional(),
  username: Joi.string().lowercase().pattern(/^[a-z0-9_]{3,24}$/).optional(),
  age: Joi.number().integer().min(18).max(120).optional(),
  dob: Joi.date().iso().optional(),
  contact: Joi.string().trim().max(40).allow('').optional(),
  gender: Joi.string().valid('male', 'female').optional(),
  bio: Joi.string().max(160).allow('').optional(),
  avatar: Joi.string().uri().optional(),
  interests: Joi.array().items(Joi.string().max(40)).max(12).optional(),
  privacy: Joi.object({
    showLastSeen: Joi.boolean().optional(),
    readReceipts: Joi.boolean().optional()
  }).optional(),
  safety: Joi.object({
    blockedWords: Joi.array().items(Joi.string().trim().lowercase().max(40)).max(80).optional()
  }).optional()
});

export const updateLocationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required()
});

export const vaultPasswordSchema = Joi.object({
  vaultPassword: Joi.string().allow(null, '').optional()
});

export const verifyVaultPasswordSchema = Joi.object({
  password: Joi.string().required()
});

const matchUserFields = 'name username avatar bio interests isOnline lastSeenAt age gender location';

function pageLimit(value, fallback = 20, max = 50) {
  return Math.min(Math.max(Number(value) || fallback, 1), max);
}

function dateCursor(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchPageInfo(users, limit, field = 'lastSeenAt') {
  const last = users[users.length - 1];
  const cursorValue = last?.[field] || last?.updatedAt;
  return {
    nextCursor: users.length === limit && cursorValue ? new Date(cursorValue).toISOString() : null,
    hasMore: users.length === limit
  };
}

async function getExcludedMatchUserIds(user) {
  const [friendChats, pendingRequests] = await Promise.all([
    Chat.find({ type: 'direct', members: user._id }).select('members').lean(),
    FriendRequest.find({
      status: 'pending',
      $or: [{ from: user._id }, { to: user._id }]
    }).select('from to').lean()
  ]);

  return [
    user._id.toString(),
    ...friendChats.flatMap((chat) => chat.members.map((memberId) => memberId.toString())),
    ...pendingRequests.flatMap((request) => [request.from.toString(), request.to.toString()]),
    ...(user.blockedUsers || []).map((userId) => userId.toString())
  ];
}

function toObjectIds(ids) {
  return ids.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
}

export const me = asyncHandler(async (req, res) => res.json({ user: req.user }));

export const updateProfile = asyncHandler(async (req, res) => {
  if (req.body.username && req.body.username !== req.user.username) {
    const exists = await User.exists({ username: req.body.username, _id: { $ne: req.user._id } });
    if (exists) {
      const error = new Error('Username is already taken');
      error.status = 409;
      throw error;
    }
  }
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json({ user: req.user });
});

export const updateVaultPassword = asyncHandler(async (req, res) => {
  if (!req.user.privacy) req.user.privacy = {};
  req.user.privacy.vaultPassword = req.body.vaultPassword || undefined;
  await req.user.save();
  res.json({ ok: true, message: 'Vault password updated' });
});

export const verifyVaultPassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+privacy.vaultPassword');
  const isValid = user?.privacy?.vaultPassword && user.privacy.vaultPassword === req.body.password;
  res.json({ valid: !!isValid });
});

export const exportAccountData = asyncHandler(async (req, res) => {
  const [chats, messages, notifications, reports] = await Promise.all([
    Chat.find({ members: req.user._id }).lean(),
    Message.find({ $or: [{ sender: req.user._id }, { seenBy: req.user._id }] }).limit(1000).lean(),
    Notification.find({ user: req.user._id }).limit(1000).lean(),
    Report.find({ reporter: req.user._id }).limit(1000).lean()
  ]);
  res.json({
    export: {
      generatedAt: new Date().toISOString(),
      user: req.user.toObject(),
      chats,
      messages,
      notifications,
      reports
    }
  });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // 1. Gather all message media urls to delete
  const messagesWithMedia = await Message.find({
    sender: userId,
    media: { $ne: null }
  }).select('media').lean();
  
  const mediaUrls = messagesWithMedia.map(m => m.media?.url).filter(Boolean);
  
  // 2. Gather reports screenshots
  const reportsWithMedia = await Report.find({
    $or: [{ reporter: userId }, { reported: userId }],
    screenshots: { $exists: true, $not: { $size: 0 } }
  }).select('screenshots').lean();
  
  const reportUrls = reportsWithMedia.flatMap(r => r.screenshots || []).filter(Boolean);

  // 3. User avatar
  if (req.user.avatar) {
    mediaUrls.push(req.user.avatar);
  }

  // 4. Trigger media deletion
  const allUrls = [...new Set([...mediaUrls, ...reportUrls])];
  for (const url of allUrls) {
    deleteMediaByUrl(url).catch(err => console.warn(`Media deletion error: ${err.message}`));
  }

  // 5. Cascade delete documents
  await Promise.all([
    Chat.updateMany({ members: userId }, { $pull: { members: userId } }),
    Message.deleteMany({ sender: userId }),
    Notification.deleteMany({ user: userId }),
    FriendRequest.deleteMany({ $or: [{ from: userId }, { to: userId }] }),
    Call.deleteMany({ $or: [{ caller: userId }, { receiver: userId }] }),
    NotificationSubscription.deleteMany({ user: userId }),
    Report.deleteMany({ $or: [{ reporter: userId }, { reported: userId }] })
  ]);
  
  await User.deleteOne({ _id: userId });
  clearAuthCookie(res);
  res.json({ ok: true, message: 'Account deleted' });
});

export const searchUsers = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  
  if (q.length > 50) {
    const error = new Error('Search query is too long');
    error.status = 400;
    throw error;
  }

  const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const excludedIds = [req.user._id, ...(req.user.blockedUsers || [])];
  
  const filter = escapedQ
    ? {
        _id: { $nin: excludedIds },
        blockedUsers: { $ne: req.user._id },
        $or: [
          { username: { $regex: '^' + escapedQ, $options: 'i' } },
          { name: { $regex: '^' + escapedQ, $options: 'i' } }
        ]
      }
    : { _id: { $nin: excludedIds }, blockedUsers: { $ne: req.user._id } };
    
  const users = await User.find(filter).select('name username avatar bio interests isOnline lastSeenAt age gender').limit(20);
  res.json({ users });
});

export const suggestedUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ _id: { $nin: [req.user._id, ...(req.user.blockedUsers || [])] }, blockedUsers: { $ne: req.user._id } })
    .select('name username avatar bio interests isOnline lastSeenAt age gender')
    .sort('-createdAt')
    .limit(20);
  res.json({ users });
});

export const updateLocation = asyncHandler(async (req, res) => {
  req.user.location = {
    type: 'Point',
    coordinates: [req.body.longitude, req.body.latitude],
    updatedAt: new Date()
  };
  await req.user.save();
  res.json({ user: req.user });
});

export const nearbyUsers = asyncHandler(async (req, res) => {
  const limit = pageLimit(req.query.limit, 20, 50);
  const cursor = dateCursor(req.query.cursor);
  const maxDistance = Math.min(Number(req.query.maxDistance || 25000), 100000);
  const coordinates = req.user.location?.coordinates;
  const excludedIds = [req.user._id, ...(req.user.blockedUsers || [])];

  if (!coordinates?.length) {
    const error = new Error('Share your location first to find nearby strangers');
    error.status = 422;
    throw error;
  }

  const users = await User.find({
    _id: { $nin: excludedIds },
    blockedUsers: { $ne: req.user._id },
    isOnline: true,
    age: { $gte: 18 },
    ...(cursor ? { lastSeenAt: { $lt: cursor } } : {}),
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates },
        $maxDistance: maxDistance
      }
    }
  })
    .select(matchUserFields)
    .limit(limit)
    .lean();

  res.json({ users, pageInfo: matchPageInfo(users, limit, 'lastSeenAt') });
});

export const availableUsers = asyncHandler(async (req, res) => {
  const limit = pageLimit(req.query.limit, 20, 50);
  const cursor = dateCursor(req.query.cursor);
  const coordinates = req.user.location?.coordinates;
  const excludedIds = await getExcludedMatchUserIds(req.user);
  const baseFilter = {
    _id: { $nin: excludedIds },
    blockedUsers: { $ne: req.user._id },
    isOnline: true,
    age: { $gte: 18 },
    ...(cursor ? { lastSeenAt: { $lt: cursor } } : {})
  };

  if (coordinates?.length) {
    const users = await User.find({
      ...baseFilter,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates },
          $maxDistance: Math.min(Number(req.query.maxDistance || 25000), 100000)
        }
      }
    })
      .select(matchUserFields)
      .limit(limit)
      .lean();

    return res.json({ users, source: 'nearby', pageInfo: matchPageInfo(users, limit, 'lastSeenAt') });
  }

  const users = await User.find({ ...baseFilter, isOnline: true })
    .select(matchUserFields)
    .sort('-lastSeenAt')
    .limit(limit)
    .lean();

  res.json({ users, source: 'online', pageInfo: matchPageInfo(users, limit, 'lastSeenAt') });
});

export const randomAvailableUsers = asyncHandler(async (req, res) => {
  const limit = pageLimit(req.query.limit, 20, 50);
  const excludedIds = await getExcludedMatchUserIds(req.user);
  const users = await User.aggregate([
    {
      $match: {
        _id: { $nin: toObjectIds(excludedIds) },
        blockedUsers: { $ne: req.user._id },
        isOnline: true,
        age: { $gte: 18 }
      }
    },
    { $sample: { size: limit } },
    {
      $project: {
        name: 1,
        username: 1,
        avatar: 1,
        bio: 1,
        interests: 1,
        isOnline: 1,
        lastSeenAt: 1,
        age: 1,
        gender: 1,
        location: 1
      }
    }
  ]);

  res.json({ users, source: 'random', pageInfo: { nextCursor: null, hasMore: users.length === limit } });
});
