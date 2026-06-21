import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { cloudinary } from '../config/cloudinary.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';

function cloudinaryReady() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

async function uploadToSupabase(file) {
  const ext = path.extname(file.originalname || '');
  const secureFilename = `${randomUUID()}${ext}`;
  const bucketName = process.env.SUPABASE_BUCKET || 'media';
  
  const { data, error } = await supabaseAdmin.storage
    .from(bucketName)
    .upload(secureFilename, file.buffer, {
      contentType: file.mimetype,
      upsert: true
    });

  if (error) {
    throw error;
  }

  const { data: { publicUrl } } = supabaseAdmin.storage.from(bucketName).getPublicUrl(secureFilename);

  return {
    secure_url: publicUrl,
    public_id: secureFilename,
    resource_type: resourceTypeFor(file.mimetype),
    storage: 'supabase'
  };
}

export function uploadBuffer(file, baseUrl = '') {
  if (supabase) return uploadToSupabase(file);
  
  if (!cloudinaryReady()) {
    throw new Error('No media storage provider configured. Please set SUPABASE_URL or CLOUDINARY credentials.');
  }

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

function resourceTypeFor(mimeType = '') {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'raw';
}

export async function deleteMediaByUrl(url) {
  if (!url) return;
  try {
    if (url.includes('/storage/v1/object/public/')) {
      const parts = url.split('/storage/v1/object/public/');
      const pathPart = parts[parts.length - 1];
      const bucketSeparatorIndex = pathPart.indexOf('/');
      if (bucketSeparatorIndex > -1) {
        const bucketName = pathPart.substring(0, bucketSeparatorIndex);
        const filename = pathPart.substring(bucketSeparatorIndex + 1);
        if (supabaseAdmin) {
          await supabaseAdmin.storage.from(bucketName).remove([filename]);
        }
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
