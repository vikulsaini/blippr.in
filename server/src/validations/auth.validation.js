import Joi from 'joi';

const pushSubscriptionSchema = Joi.object({
  endpoint: Joi.string().uri().required(),
  keys: Joi.object({
    p256dh: Joi.string().required(),
    auth: Joi.string().required()
  }).required()
}).optional();

export const emailSignupSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  username: Joi.string().lowercase().pattern(/^[a-z0-9_]{3,24}$/).required(),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(8).max(72).required(),
  age: Joi.number().integer().min(18).max(120).required(),
  dob: Joi.date().iso().optional(),
  contact: Joi.string().trim().max(40).allow('').optional(),
  gender: Joi.string().valid('male', 'female').required(),
  bio: Joi.string().max(160).allow('').optional(),
  interests: Joi.array().items(Joi.string().trim().max(40)).max(12).optional(),
  pushSubscription: pushSubscriptionSchema
});

export const emailLoginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(8).max(72).required(),
  pushSubscription: pushSubscriptionSchema
});

export const emailVerifySchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  code: Joi.string().length(6).required()
});

export const emailResendSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  pushSubscription: pushSubscriptionSchema
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().lowercase().required()
});

export const resetPasswordSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  code: Joi.string().length(6).required(),
  password: Joi.string().min(8).max(72).required()
});

export const guestUpgradeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(8).max(72).required(),
  age: Joi.number().integer().min(18).max(120).required(),
  dob: Joi.date().iso().optional(),
  contact: Joi.string().trim().max(40).allow('').optional(),
  gender: Joi.string().valid('male', 'female').required(),
  bio: Joi.string().max(160).allow('').optional(),
  interests: Joi.array().items(Joi.string().trim().max(40)).max(12).optional()
});

export const guestSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  age: Joi.number().integer().min(18).max(120).required(),
  gender: Joi.string().valid('male', 'female').required(),
  bio: Joi.string().max(160).allow('').optional()
});

export const supabaseAuthSchema = Joi.object({
  accessToken: Joi.string().required(),
  name: Joi.string().trim().min(2).max(80).optional(),
  username: Joi.string().lowercase().pattern(/^[a-z0-9_]{3,24}$/).optional(),
  age: Joi.number().integer().min(18).max(120).optional(),
  gender: Joi.string().valid('male', 'female').optional(),
  bio: Joi.string().max(160).allow('').optional(),
  interests: Joi.array().items(Joi.string().trim().max(40)).max(12).optional()
});
