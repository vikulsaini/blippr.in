import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/notifications — returns empty list (push notifications not yet implemented)
router.get('/', authMiddleware, (_req: AuthenticatedRequest, res) => {
  res.status(200).json({ notifications: [] });
});

// POST /api/notifications/subscriptions — registers a push subscription
router.post('/subscriptions', authMiddleware, (_req: AuthenticatedRequest, res) => {
  res.status(200).json({ success: true });
});

// PATCH /api/notifications/read — marks notifications as read
router.patch('/read', authMiddleware, (_req: AuthenticatedRequest, res) => {
  res.status(200).json({ success: true });
});

export default router;
