import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadBuffer } from '../services/media.service.js';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

export const uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file) {
    const error = new Error('File required');
    error.status = 422;
    throw error;
  }
  const result = await uploadBuffer(req.file);
  res.status(201).json({
    ok: true,
    media: {
      url: result.secure_url,
      publicId: result.public_id,
      type: mediaTypeFor(req.file.mimetype, result.resource_type),
      name: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    }
  });
});

function mediaTypeFor(mimeType = '', resourceType = '') {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return resourceType === 'image' || resourceType === 'video' ? resourceType : 'file';
}
