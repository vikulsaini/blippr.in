import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/notifications
router.get('/', authMiddleware, (req, res) => {
  res.status(200).json({ notifications: [] });
});

// GET /api/notifications/public-key
router.get('/public-key', authMiddleware, (req, res) => {
  res.status(200).json({ publicKey: 'BG5B3i1lR-S6-YV8B16R1L-Gg0r1M7J7s4n7L1u9w' });
});

// POST /api/notifications/subscriptions
router.post('/subscriptions', authMiddleware, (req, res) => {
  res.status(200).json({ success: true });
});

// PATCH /api/notifications/read
router.patch('/read', authMiddleware, (req, res) => {
  res.status(200).json({ success: true });
});

export default router;
