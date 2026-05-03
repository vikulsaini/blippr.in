import { Router } from 'express';
import { listCalls } from '../controllers/call.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/', listCalls);

export default router;
