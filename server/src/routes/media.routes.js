import { Router } from 'express';
import { getMediaFile, upload, uploadMedia } from '../controllers/media.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/files/:id', getMediaFile);
router.use(requireAuth);
router.post('/upload', upload.single('file'), uploadMedia);

export default router;
