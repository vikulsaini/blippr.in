import { Router } from 'express';
import {
  continueAsGuest,
  emailLoginSchema,
  emailResendSchema,
  emailSignupSchema,
  emailVerifySchema,
  guestSchema,
  guestUpgradeSchema,
  googleLogin,
  googleLoginSchema,
  loginWithEmail,
  logout,
  requestOtp,
  requestOtpSchema,
  resendEmailVerification,
  signupWithEmail,
  upgradeGuest,
  verifyEmail,
  verifyOtpSchema,
  verifyPhoneOtp
} from '../controllers/auth.controller.js';
import { authLimiter, guestLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post('/otp/request', authLimiter, validate(requestOtpSchema), requestOtp);
router.post('/otp/verify', authLimiter, validate(verifyOtpSchema), verifyPhoneOtp);
router.post('/email/signup', authLimiter, validate(emailSignupSchema), signupWithEmail);
router.post('/email/login', authLimiter, validate(emailLoginSchema), loginWithEmail);
router.post('/email/verify', authLimiter, validate(emailVerifySchema), verifyEmail);
router.post('/email/resend', authLimiter, validate(emailResendSchema), resendEmailVerification);
router.post('/guest', guestLimiter, validate(guestSchema), continueAsGuest);
router.post('/guest/upgrade', requireAuth, validate(guestUpgradeSchema), upgradeGuest);
router.post('/google', authLimiter, validate(googleLoginSchema), googleLogin);
router.post('/logout', logout);

export default router;
