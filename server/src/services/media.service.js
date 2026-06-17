import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import { cloudinary } from '../config/cloudinary.js';

function cloudinaryReady() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

export function uploadBuffer(file, baseUrl = '') {
  const urlBase = (process.env.PUBLIC_API_URL || process.env.API_URL || baseUrl).replace(/\/$/, '');
  if (!cloudinaryReady()) return uploadToGridFs(file, urlBase);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'blippr', resource_type: 'auto' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    Readable.from(file.buffer).pipe(stream);
  });
}

function bucket() {
  if (!mongoose.connection.db) {
    const error = new Error('Media database is not connected');
    error.status = 503;
    error.code = 'MEDIA_STORAGE_MISSING';
    throw error;
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'blippr_media' });
}

function uploadToGridFs(file, baseUrl) {
  return new Promise((resolve, reject) => {
    const stream = bucket().openUploadStream(file.originalname || `media-${Date.now()}`, {
      contentType: file.mimetype,
      metadata: {
        size: file.size,
        uploadedAt: new Date()
      }
    });

    stream.on('error', reject);
    stream.on('finish', () => {
      const id = stream.id.toString();
      resolve({
        secure_url: `${baseUrl}/api/media/files/${id}`,
        public_id: id,
        resource_type: resourceTypeFor(file.mimetype),
        storage: 'gridfs'
      });
    });
    Readable.from(file.buffer).pipe(stream);
  });
}

export async function findMediaFile(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const files = await bucket().find({ _id: new mongoose.Types.ObjectId(id) }).limit(1).toArray();
  return files[0] || null;
}

export function openMediaDownloadStream(id) {
  return bucket().openDownloadStream(new mongoose.Types.ObjectId(id));
}

function resourceTypeFor(mimeType = '') {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'raw';
}

export async function deleteMediaByUrl(url) {
  if (!url) return;
  try {
    if (url.includes('/api/media/files/')) {
      const parts = url.split('/api/media/files/');
      const id = parts[parts.length - 1];
      if (mongoose.Types.ObjectId.isValid(id)) {
        await bucket().delete(new mongoose.Types.ObjectId(id));
      }
    } else if (cloudinaryReady() && url.includes('cloudinary.com')) {
      const publicId = extractCloudinaryPublicId(url);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
      }
    }
  } catch (err) {
    console.warn(`Failed to delete media at URL ${url}: ${err.message}`);
  }
}

function extractCloudinaryPublicId(url) {
  const parts = url.split('/upload/');
  if (parts.length < 2) return null;
  const path = parts[1].replace(/^v\d+\//, '');
  const lastDot = path.lastIndexOf('.');
  return lastDot > -1 ? path.substring(0, lastDot) : path;
}
