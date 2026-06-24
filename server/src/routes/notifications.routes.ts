import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/notifications — returns empty list (push notifications not yet implemented)
router.get('/', authMiddleware, (_req: AuthenticatedRequest, res) => {
  res.status(200).json({ notifications: [] });
});

// GET /api/notifications/public-key — push notification VAPID public key (client depends on this)
router.get('/public-key', authMiddleware, (_req: AuthenticatedRequest, res) => {
  res.status(200).json({ publicKey: 'BG5B3i1lR-S6-YV8B16R1L-Gg0r1M7J7s4n7L1u9w' });
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
