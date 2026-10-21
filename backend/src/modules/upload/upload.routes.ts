import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../config/env';
import { sendError, sendSuccess } from '../../middleware/response';

const router = Router();
const BUCKET_NAME = 'item-photos';

const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);

router.post('/', async (req: Request, res: Response) => {
  try {
    const { data: base64Data, filename, contentType = 'image/jpeg', folder = 'items' } = req.body;

    if (!base64Data) {
      return sendError(res, 'BAD_REQUEST', 'Image data is required', 400);
    }

    // Strip data URL prefix if present (e.g. data:image/jpeg;base64,...)
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z0-9+]+;base64,/i, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const extMatch = contentType.split('/')[1] || 'jpg';
    const cleanExt = extMatch.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
    const safeName = filename
      ? filename.replace(/[^a-zA-Z0-9.-]/g, '_')
      : `photo-${Date.now()}.${cleanExt}`;
    const storagePath = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${safeName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType,
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
