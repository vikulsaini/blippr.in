import { Readable } from 'node:stream';
import { cloudinary } from '../config/cloudinary.js';

export function uploadBuffer(file) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    const error = new Error('Media storage is not configured');
    error.status = 503;
    error.code = 'MEDIA_STORAGE_MISSING';
    throw error;
  }

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
