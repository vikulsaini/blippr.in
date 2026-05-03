import { Router } from 'express';
import {
  continueAsGuest,
  emailLoginSchema,
  emailSignupSchema,
  guestSchema,
  guestUpgradeSchema,
  googleLogin,
  googleLoginSchema,
  loginWithEmail,
  requestOtp,
  requestOtpSchema,
  signupWithEmail,
  upgradeGuest,
  verifyOtpSchema,
  verifyPhoneOtp
} from '../controllers/auth.controller.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post('/otp/request', authLimiter, validate(requestOtpSchema), requestOtp);
router.post('/otp/verify', authLimiter, validate(verifyOtpSchema), verifyPhoneOtp);
router.post('/email/signup', authLimiter, validate(emailSignupSchema), signupWithEmail);
router.post('/email/login', authLimiter, validate(emailLoginSchema), loginWithEmail);
router.post('/guest', authLimiter, validate(guestSchema), continueAsGuest);
router.post('/guest/upgrade', requireAuth, validate(guestUpgradeSchema), upgradeGuest);
router.post('/google', authLimiter, validate(googleLoginSchema), googleLogin);

export default router;
