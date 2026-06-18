import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { claimAdmin, getStats, searchUsers, updateUserStatus, broadcastMessage } from '../controllers/admin.controller.js';

const router = Router();

// Protected by requireAuth, but NOT requireAdmin (so a regular user can claim the role)
router.post('/claim', requireAuth, claimAdmin);

// All other routes require Admin
router.use(requireAuth, requireAdmin);

router.get('/stats', getStats);
router.get('/users', searchUsers);
router.patch('/users/:id', updateUserStatus);
router.post('/broadcast', broadcastMessage);

export default router;
