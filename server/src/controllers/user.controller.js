import Joi from 'joi';
import mongoose from 'mongoose';
import Chat from '../models/Chat.js';
import FriendRequest from '../models/FriendRequest.js';
import User from '../models/User.js';
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
  interests: Joi.array().items(Joi.string().max(40)).max(12).optional()
});

export const updateLocationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required()
});

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

export const searchUsers = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const excludedIds = [req.user._id, ...(req.user.blockedUsers || [])];
  const filter = q
    ? {
        _id: { $nin: excludedIds },
        blockedUsers: { $ne: req.user._id },
        $or: [
          { username: { $regex: q, $options: 'i' } },
          { name: { $regex: q, $options: 'i' } }
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
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates },
        $maxDistance: maxDistance
      }
    }
  })
    .select('name username avatar bio interests isOnline lastSeenAt age gender location')
    .limit(20);

  res.json({ users });
});

export const availableUsers = asyncHandler(async (req, res) => {
  const coordinates = req.user.location?.coordinates;
  const [friendChats, pendingRequests] = await Promise.all([
    Chat.find({ type: 'direct', members: req.user._id }).select('members').lean(),
    FriendRequest.find({
      status: 'pending',
      $or: [{ from: req.user._id }, { to: req.user._id }]
    }).select('from to').lean()
  ]);
  const connectedIds = friendChats.flatMap((chat) => chat.members.map((memberId) => memberId.toString()));
  const pendingIds = pendingRequests.flatMap((request) => [request.from.toString(), request.to.toString()]);
  const baseFilter = {
    _id: { $nin: [req.user._id.toString(), ...connectedIds, ...pendingIds, ...(req.user.blockedUsers || []).map((userId) => userId.toString())] },
    blockedUsers: { $ne: req.user._id },
    isOnline: true,
    age: { $gte: 18 }
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
      .select('name username avatar bio interests isOnline lastSeenAt age gender location')
      .sort({ updatedAt: -1 })
      .limit(20);

    return res.json({ users, source: 'nearby' });
  }

  const users = await User.find({ ...baseFilter, isOnline: true })
    .select('name username avatar bio interests isOnline lastSeenAt age gender location')
    .sort('-lastSeenAt')
    .limit(20);

  res.json({ users, source: 'online' });
});

export const randomAvailableUsers = asyncHandler(async (req, res) => {
  const [friendChats, pendingRequests] = await Promise.all([
    Chat.find({ type: 'direct', members: req.user._id }).select('members').lean(),
    FriendRequest.find({
      status: 'pending',
      $or: [{ from: req.user._id }, { to: req.user._id }]
    }).select('from to').lean()
  ]);
  const connectedIds = friendChats.flatMap((chat) => chat.members.map((memberId) => memberId.toString()));
  const pendingIds = pendingRequests.flatMap((request) => [request.from.toString(), request.to.toString()]);
  const excludedIds = [req.user._id.toString(), ...connectedIds, ...pendingIds, ...(req.user.blockedUsers || []).map((userId) => userId.toString())];
  const users = await User.aggregate([
    {
      $match: {
        _id: { $nin: excludedIds.map((userId) => new mongoose.Types.ObjectId(userId)) },
        blockedUsers: { $ne: req.user._id },
        isOnline: true,
        age: { $gte: 18 }
      }
    },
    { $sample: { size: 20 } },
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

  res.json({ users, source: 'random' });
});
