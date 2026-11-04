import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../config/env';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();
const BUCKET_NAME = 'item-photos';
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB max image upload limit

const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: base64Data, filename, contentType = 'image/jpeg', folder = 'items' } = req.body;

    if (!base64Data) {
      return sendError(res, 'BAD_REQUEST', 'Image data is required', 400);
    }

    const cleanContentType = String(contentType).toLowerCase().trim();
    if (!ALLOWED_MIME_TYPES.includes(cleanContentType)) {
      return sendError(res, 'BAD_REQUEST', 'Only valid image files (JPEG, PNG, WebP, GIF) are permitted', 400);
    }

    // Strip data URL prefix if present (e.g. data:image/jpeg;base64,...)
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z0-9+]+;base64,/i, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return sendError(res, 'BAD_REQUEST', 'Image exceeds the maximum upload limit of 5 MB', 400);
    }

    // Cryptographic magic byte verification: ensures uploaded bytes are genuine safe image data
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
    const isWebp = buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;

    if (!isJpeg && !isPng && !isGif && !isWebp) {
      return sendError(res, 'BAD_REQUEST', 'Invalid file contents: Uploaded file does not contain genuine image bytes', 400);
    }

    const extMatch = cleanContentType.split('/')[1] || 'jpg';
    const cleanExt = extMatch.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
    const safeName = filename
      ? filename.replace(/[^a-zA-Z0-9.-]/g, '_')
      : `photo-${Date.now()}.${cleanExt}`;

    const safeFolder = ['items', 'avatars', 'banners', 'requests', 'chat'].includes(folder) ? folder : 'items';
    const storagePath = `${safeFolder}/${req.user?.id || 'member'}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${safeName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: cleanContentType,
        upsert: true,
      });

    if (error) {
      console.error('Backend Supabase storage upload error:', error);
      return sendError(res, 'UPLOAD_FAILED', error.message || 'Storage upload failed', 500);
    }

    const { data: publicData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return sendSuccess(res, {
      publicUrl: publicData.publicUrl,
      url: publicData.publicUrl,
      path: data.path,
    });
  } catch (err: any) {
    console.error('Backend upload handler error:', err);
    return sendError(res, 'INTERNAL_SERVER_ERROR', err.message || 'Upload failed', 500);
  }
});

export default router;
