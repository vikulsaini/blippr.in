import { Router } from 'express';
import {
  continueAsGuest,
  emailLoginSchema,
  emailResendSchema,
  emailSignupSchema,
  emailVerifySchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  requestPasswordReset,
  resetPassword,
  guestSchema,
  guestUpgradeSchema,
  loginWithEmail,
  logout,
  resendEmailVerification,
  signupWithEmail,
  upgradeGuest,
  verifyEmail,
  supabaseAuthSchema,
  supabaseLogin,
  checkUsernameAvailable,
  runDiagnostic
} from '../controllers/auth.controller.js';
import { authLimiter, guestLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post('/email/signup', authLimiter, validate(emailSignupSchema), signupWithEmail);
router.post('/email/login', authLimiter, validate(emailLoginSchema), loginWithEmail);
router.post('/email/verify', authLimiter, validate(emailVerifySchema), verifyEmail);
router.post('/email/resend', authLimiter, validate(emailResendSchema), resendEmailVerification);
router.post('/email/forgot-password', authLimiter, validate(forgotPasswordSchema), requestPasswordReset);
router.post('/email/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);
router.post('/guest', guestLimiter, validate(guestSchema), continueAsGuest);
router.post('/guest/upgrade', requireAuth, validate(guestUpgradeSchema), upgradeGuest);
router.post('/supabase', authLimiter, validate(supabaseAuthSchema), supabaseLogin);
router.get('/username-check', authLimiter, checkUsernameAvailable);
router.get('/diagnostic', runDiagnostic);
router.post('/logout', logout);

export default router;
