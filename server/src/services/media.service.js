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
      { folder: 'varta', resource_type: 'auto' },
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
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'varta_media' });
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
