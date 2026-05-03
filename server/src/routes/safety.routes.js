import { Router } from 'express';
import { blockSchema, blockUser, listBlockedUsers, reportSchema, reportUser, unblockUser } from '../controllers/safety.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(requireAuth);
router.get('/blocked', listBlockedUsers);
router.post('/block', validate(blockSchema), blockUser);
router.post('/unblock', validate(blockSchema), unblockUser);
router.post('/report', validate(reportSchema), reportUser);

export default router;
