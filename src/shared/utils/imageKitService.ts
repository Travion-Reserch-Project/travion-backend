/**
 * ImageKit Service
 * Uploads base64-encoded images to ImageKit and returns permanent CDN URLs.
 * Gracefully disabled when IMAGEKIT_* env vars are not configured.
 */

import ImageKit from 'imagekit';
import { logger } from '../config/logger';

let imagekit: ImageKit | null = null;

function getClient(): ImageKit | null {
  if (imagekit) return imagekit;

  const { IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } = process.env;

  if (
    !IMAGEKIT_PUBLIC_KEY ||
    !IMAGEKIT_PRIVATE_KEY ||
    !IMAGEKIT_URL_ENDPOINT ||
    IMAGEKIT_PUBLIC_KEY === 'your_imagekit_public_key'
  ) {
    return null;
  }

  imagekit = new ImageKit({
    publicKey: IMAGEKIT_PUBLIC_KEY,
    privateKey: IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: IMAGEKIT_URL_ENDPOINT,
  });

  return imagekit;
}

/**
 * Upload a base64 image to ImageKit.
 * Accepts raw base64 or a data URI (data:image/jpeg;base64,...).
 * Returns the permanent CDN URL, or null if ImageKit is not configured / upload fails.
 */
export async function uploadImageToImageKit(
  base64: string,
  folder = '/travion/chat-uploads'
): Promise<string | null> {
  const client = getClient();
  if (!client) {
    logger.warn('ImageKit not configured — skipping image upload');
    return null;
  }

  try {
    // Strip data URI prefix if present so ImageKit gets raw base64
    const raw = base64.includes(',') ? base64.split(',')[1] : base64;
    const fileName = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;

    const result = await client.upload({
      file: raw,
      fileName,
      folder,
      useUniqueFileName: true,
    });

    logger.info(`ImageKit upload success: ${result.url}`);
    return result.url;
  } catch (err) {
    logger.error('ImageKit upload failed:', err);
    return null;
  }
}
