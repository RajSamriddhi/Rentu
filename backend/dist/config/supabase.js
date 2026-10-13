"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUCKET_NAME = exports.supabase = void 0;
exports.uploadItemPhoto = uploadItemPhoto;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("./env");
exports.supabase = (0, supabase_js_1.createClient)(env_1.ENV.SUPABASE_URL || 'https://placeholder.supabase.co', env_1.ENV.SUPABASE_SERVICE_ROLE_KEY || env_1.ENV.SUPABASE_ANON_KEY || 'placeholder-key', {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});
exports.BUCKET_NAME = 'item-photos';
/**
 * Upload an image buffer or file to Supabase Storage
 */
async function uploadItemPhoto(filePath, fileBuffer, contentType = 'image/jpeg') {
    const { data, error } = await exports.supabase.storage
        .from(exports.BUCKET_NAME)
        .upload(filePath, fileBuffer, {
        contentType,
        upsert: true,
    });
    if (error) {
        console.error('Supabase upload error:', error);
        throw error;
    }
    const { data: publicData } = exports.supabase.storage
        .from(exports.BUCKET_NAME)
        .getPublicUrl(data.path);
    return publicData.publicUrl;
}
