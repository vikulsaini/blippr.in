import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler.js';
import { findMediaFile, openMediaDownloadStream, uploadBuffer } from '../services/media.service.js';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
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
  const file = await findMediaFile(req.params.id);
  if (!file) {
    const error = new Error('Media not found');
    error.status = 404;
    throw error;
  }

  res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename || 'varta-media')}"`);
  const stream = openMediaDownloadStream(req.params.id);
  stream.on('error', () => {
    if (!res.headersSent) res.status(404).end();
    else res.end();
  });
  stream.pipe(res);
});

function mediaTypeFor(mimeType = '', resourceType = '') {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return resourceType === 'image' || resourceType === 'video' ? resourceType : 'file';
}
