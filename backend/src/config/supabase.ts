import { createClient } from '@supabase/supabase-js';
import { ENV } from './env';

export const supabase = createClient(
  ENV.SUPABASE_URL || 'https://placeholder.supabase.co',
  ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export const BUCKET_NAME = 'item-photos';

/**
 * Upload an image buffer or file to Supabase Storage
 */
export async function uploadItemPhoto(
  filePath: string,
  fileBuffer: Buffer,
  contentType: string = 'image/jpeg'
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error('Supabase upload error:', error);
    throw error;
  }

  const { data: publicData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return publicData.publicUrl;
}
