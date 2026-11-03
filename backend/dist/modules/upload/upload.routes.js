"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("../../config/env");
const response_1 = require("../../middleware/response");
const router = (0, express_1.Router)();
const BUCKET_NAME = 'item-photos';
const supabase = (0, supabase_js_1.createClient)(env_1.ENV.SUPABASE_URL, env_1.ENV.SUPABASE_ANON_KEY);
router.post('/', async (req, res) => {
    try {
        const { data: base64Data, filename, contentType = 'image/jpeg', folder = 'items' } = req.body;
        if (!base64Data) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Image data is required', 400);
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
            return (0, response_1.sendError)(res, 'UPLOAD_FAILED', error.message || 'Storage upload failed', 500);
        }
        const { data: publicData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(data.path);
        return (0, response_1.sendSuccess)(res, {
            publicUrl: publicData.publicUrl,
            url: publicData.publicUrl,
            path: data.path,
        });
    }
    catch (err) {
        console.error('Backend upload handler error:', err);
        return (0, response_1.sendError)(res, 'INTERNAL_SERVER_ERROR', err.message || 'Upload failed', 500);
    }
});
exports.default = router;
