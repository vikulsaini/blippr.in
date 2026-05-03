import Joi from 'joi';
import Notification from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { removePushSubscription, savePushSubscription } from '../services/notification.service.js';

export const subscriptionSchema = Joi.object({
  endpoint: Joi.string().uri().required(),
  keys: Joi.object({
    p256dh: Joi.string().required(),
    auth: Joi.string().required()
  }).required()
});

export const saveSubscription = asyncHandler(async (req, res) => {
  const subscription = await savePushSubscription(req.user, req.body, req.get('user-agent'));
  res.status(201).json({ subscription });
});

export const deleteSubscription = asyncHandler(async (req, res) => {
  await removePushSubscription(req.user, req.body.endpoint);
  res.json({ ok: true });
});

export const getPublicKey = asyncHandler(async (_req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const isValid = /^[A-Za-z0-9_-]{40,}$/.test(publicKey);
  res.json({ publicKey: isValid ? publicKey : null });
});

export const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(60)
    .populate('actor', 'name username avatar gender age')
    .lean();
  const unreadCount = await Notification.countDocuments({ user: req.user._id, readAt: null });
  res.json({ notifications, unreadCount });
});

export const markNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { readAt: new Date() });
  res.json({ ok: true });
});
