import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Configure multer for memory storage (files will be stored in memory as Buffer)
const storage = multer.memoryStorage();

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes: Record<string, string[]> = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv'],
    video: ['video/mp4', 'video/webm', 'video/ogg'],
  };

  const allAllowed = Object.values(allowedMimes).flat();
  if (allAllowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: images, audio, documents, video.`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
    files: 1,
  },
});

export interface UploadedFile {
  url: string;
  type: string;
  name: string;
  size: number;
  mimeType: string;
}

// POST /api/upload — Upload a file (image, voice note, document)
router.post('/', authMiddleware, (req: AuthenticatedRequest, res) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: 'File size exceeds the 25MB limit.' });
          return;
        }
        res.status(400).json({ error: `Upload error: ${err.message}` });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file provided.' });
      return;
    }

    // Determine file category from mime type
    let fileType = 'document';
    if (req.file.mimetype.startsWith('image/')) fileType = 'image';
    else if (req.file.mimetype.startsWith('audio/')) fileType = 'audio';
    else if (req.file.mimetype.startsWith('video/')) fileType = 'video';

    // In production, you would upload to cloud storage (S3, Cloudinary, etc.)
    // For now, encode as base64 data URI for immediate use
    const base64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${base64}`;

    const uploaded: UploadedFile = {
      url: dataUri,
      type: fileType,
      name: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    };

    res.status(200).json({ success: true, file: uploaded });
  });
});

export default router;
