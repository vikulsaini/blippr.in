import Joi from 'joi';
import Report from '../models/Report.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const reportSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  reason: Joi.string().min(3).max(120).required(),
  notes: Joi.string().max(1000).allow('').optional()
});

export const blockSchema = Joi.object({
  userId: Joi.string().hex().length(24).required()
});

export const blockUser = asyncHandler(async (req, res) => {
  req.user.blockedUsers.addToSet(req.body.userId);
  await req.user.save();
  res.json({ ok: true });
});

export const listBlockedUsers = asyncHandler(async (req, res) => {
  await req.user.populate('blockedUsers', 'name username avatar bio age gender isOnline lastSeenAt');
  res.json({ users: req.user.blockedUsers });
});

export const unblockUser = asyncHandler(async (req, res) => {
  req.user.blockedUsers.pull(req.body.userId);
  await req.user.save();
  res.json({ ok: true });
});

export const reportUser = asyncHandler(async (req, res) => {
  const report = await Report.create({
    reporter: req.user._id,
    reported: req.body.userId,
    reason: req.body.reason,
    notes: req.body.notes
  });
  res.status(201).json({ report });
});
