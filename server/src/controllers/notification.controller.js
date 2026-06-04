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

function pageLimit(value, fallback = 30, max = 80) {
  return Math.min(Math.max(Number(value) || fallback, 1), max);
}

function dateCursor(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const importantNotificationTypes = ['friend-request', 'friend-request-accepted', 'login', 'system'];

export const listNotifications = asyncHandler(async (req, res) => {
  const limit = pageLimit(req.query.limit, 40, 80);
  const cursor = dateCursor(req.query.cursor);
  const typeFilter = { type: { $in: importantNotificationTypes } };
  const notifications = await Notification.find({
    user: req.user._id,
    ...typeFilter,
    ...(cursor ? { createdAt: { $lt: cursor } } : {})
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actor', 'name username avatar gender age')
    .lean();
  const unreadCount = await Notification.countDocuments({ user: req.user._id, readAt: null, ...typeFilter });
  res.json({
    notifications,
    unreadCount,
    pageInfo: {
      nextCursor: notifications.length === limit ? notifications[notifications.length - 1]?.createdAt?.toISOString?.() || String(notifications[notifications.length - 1]?.createdAt || '') : null,
      hasMore: notifications.length === limit
    }
  });
});

export const markNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null, type: { $in: importantNotificationTypes } }, { readAt: new Date() });
  res.json({ ok: true });
});
