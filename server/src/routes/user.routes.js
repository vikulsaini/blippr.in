import { Router } from 'express';
import {
  me,
  availableUsers,
  nearbyUsers,
  randomAvailableUsers,
  searchUsers,
  suggestedUsers,
  updateLocation,
  updateLocationSchema,
  updateProfile,
  updateProfileSchema
} from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(requireAuth);
router.get('/me', me);
router.patch('/me', validate(updateProfileSchema), updateProfile);
router.patch('/me/location', validate(updateLocationSchema), updateLocation);
router.get('/search', searchUsers);
router.get('/suggested', suggestedUsers);
router.get('/nearby', nearbyUsers);
router.get('/available/random', randomAvailableUsers);
router.get('/available', availableUsers);

export default router;
