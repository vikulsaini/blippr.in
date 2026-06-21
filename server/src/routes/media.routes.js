import { Router } from 'express';
import { getMediaFile, upload, uploadMedia } from '../controllers/media.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.get('/files/:id', getMediaFile);
router.use(requireAuth);
router.post('/upload', uploadLimiter, upload.single('file'), uploadMedia);

export default router;
