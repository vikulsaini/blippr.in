import Joi from 'joi';
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
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});
