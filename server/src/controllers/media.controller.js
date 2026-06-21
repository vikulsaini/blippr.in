import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadBuffer } from '../services/media.service.js';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed =
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('audio/') ||
      file.mimetype.startsWith('video/') ||
      [
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ].includes(file.mimetype);
    if (!allowed) {
      const error = new Error('Unsupported media type');
      error.status = 415;
      error.code = 'UNSUPPORTED_MEDIA_TYPE';
      return cb(error);
    }
    cb(null, true);
  }
});

export const uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file) {
    const error = new Error('File required');
    error.status = 422;
    throw error;
  }

  const isImage = req.file.mimetype.startsWith('image/');
  const maxAllowedSize = isImage ? 5 * 1024 * 1024 : 25 * 1024 * 1024;
  if (req.file.size > maxAllowedSize) {
    const error = new Error(isImage ? 'Image file size must be under 5 MB.' : 'File size must be under 25 MB.');
    error.status = 413;
    error.code = 'FILE_TOO_LARGE';
    throw error;
  }

  const result = await uploadBuffer(req.file, `${req.protocol}://${req.get('host')}`);
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

export const getMediaFile = asyncHandler(async (req, res) => {
  const error = new Error('GridFS media files are deprecated. Access Supabase public URLs directly.');
  error.status = 404;
  throw error;
});

function mediaTypeFor(mimeType = '', resourceType = '') {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return resourceType === 'image' || resourceType === 'video' ? resourceType : 'file';
}
