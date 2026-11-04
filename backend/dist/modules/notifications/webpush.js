"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVapidPublicKey = getVapidPublicKey;
exports.sendWebPush = sendWebPush;
exports.sendPushNotification = sendPushNotification;
const crypto_1 = __importDefault(require("crypto"));
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const url_1 = require("url");
const db_1 = require("../../config/db");
function base64UrlToBuffer(b64url) {
    let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4)
        b64 += '=';
    return Buffer.from(b64, 'base64');
}
function bufferToBase64Url(buf) {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function hkdf(salt, ikm, info, length) {
    const prk = crypto_1.default.createHmac('sha256', salt).update(ikm).digest();
    let t = Buffer.alloc(0);
    let okm = Buffer.alloc(0);
    let i = 0;
    while (okm.length < length) {
        i++;
        t = crypto_1.default.createHmac('sha256', prk).update(Buffer.concat([t, info, Buffer.from([i])])).digest();
        okm = Buffer.concat([okm, t]);
    }
    return okm.slice(0, length);
}
// Convert DER signature from crypto.sign to JOSE IEEE P1363 (R+S 64 bytes)
function derToJose(der) {
    let offset = 3;
    let rLen = der[offset];
    offset++;
    let r = der.slice(offset, offset + rLen);
    offset += rLen + 1;
    let sLen = der[offset];
    offset++;
    let s = der.slice(offset, offset + sLen);
    while (r.length > 32)
        r = r.slice(1);
    while (r.length < 32)
        r = Buffer.concat([Buffer.alloc(1, 0), r]);
    while (s.length > 32)
        s = s.slice(1);
    while (s.length < 32)
        s = Buffer.concat([Buffer.alloc(1, 0), s]);
    return Buffer.concat([r, s]);
}
// RFC 8291 Web Push message encryption
function encryptPayload(clientPublicKeyB64, clientAuthSecretB64, payloadStr) {
    const clientPublicKey = base64UrlToBuffer(clientPublicKeyB64);
    const clientAuth = base64UrlToBuffer(clientAuthSecretB64);
    const localECDH = crypto_1.default.createECDH('prime256v1');
    localECDH.generateKeys();
    const localPublicKey = localECDH.getPublicKey();
    const sharedSecret = localECDH.computeSecret(clientPublicKey);
    const salt = crypto_1.default.randomBytes(16);
    const keyInfo = Buffer.concat([
        Buffer.from('WebPush: info\0', 'utf8'),
        clientPublicKey,
        localPublicKey,
    ]);
    const prk = crypto_1.default.createHmac('sha256', clientAuth).update(sharedSecret).digest();
    const ikm = hkdf(salt, prk, keyInfo, 32);
    const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16);
    const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12);
    const recordHeader = Buffer.concat([
        salt,
        Buffer.from([0x00, 0x00, 0x10, 0x00]), // 4096 record size
        Buffer.from([localPublicKey.length]),
        localPublicKey,
    ]);
    const cipher = crypto_1.default.createCipheriv('aes-128-gcm', cek, nonce);
    const payloadBuf = Buffer.from(payloadStr, 'utf8');
    const padded = Buffer.concat([payloadBuf, Buffer.from([0x02])]);
    const encrypted = Buffer.concat([cipher.update(padded), cipher.final(), cipher.getAuthTag()]);
    return Buffer.concat([recordHeader, encrypted]);
}
// Global VAPID keys (can be set via env, or generated once per server instance)
let vapidKeyPair = null;
function getOrCreateVapidKeys() {
    if (!vapidKeyPair) {
        const kp = crypto_1.default.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
        const jwk = kp.publicKey.export({ format: 'jwk' });
        const x = base64UrlToBuffer(jwk.x);
        const y = base64UrlToBuffer(jwk.y);
        const rawPublicKey = Buffer.concat([Buffer.from([0x04]), x, y]);
        vapidKeyPair = {
            publicKey: kp.publicKey,
            privateKey: kp.privateKey,
            rawPublicKeyB64: bufferToBase64Url(rawPublicKey),
        };
    }
    return vapidKeyPair;
}
function getVapidPublicKey() {
    return getOrCreateVapidKeys().rawPublicKeyB64;
}
function createVapidJwt(endpointUrl) {
    const { privateKey } = getOrCreateVapidKeys();
    const urlObj = new url_1.URL(endpointUrl);
    const aud = `${urlObj.protocol}//${urlObj.host}`;
    const header = bufferToBase64Url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
    const payload = bufferToBase64Url(Buffer.from(JSON.stringify({
        aud,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: 'mailto:support@rentu.site',
    })));
    const unsignedToken = `${header}.${payload}`;
    const sign = crypto_1.default.createSign('SHA256');
    sign.update(unsignedToken);
    const derSig = sign.sign(privateKey);
    const signature = bufferToBase64Url(derToJose(derSig));
    return `${unsignedToken}.${signature}`;
}
async function sendWebPush(subscription, payload) {
    try {
        const payloadStr = JSON.stringify(payload);
        const encryptedBody = encryptPayload(subscription.p256dh, subscription.auth, payloadStr);
        const jwt = createVapidJwt(subscription.endpoint);
        const vapidPublicKey = getVapidPublicKey();
        const parsedUrl = new url_1.URL(subscription.endpoint);
        const isHttps = parsedUrl.protocol === 'https:';
        const requestFn = isHttps ? https_1.default.request : http_1.default.request;
        return new Promise((resolve) => {
            const req = requestFn(parsedUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Content-Encoding': 'aes128gcm',
                    'Content-Length': encryptedBody.length,
                    TTL: '86400',
                    Urgency: 'high',
                    Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
                },
                timeout: 10000,
            }, (res) => {
                const status = res.statusCode || 0;
                if (status === 404 || status === 410) {
                    // Subscription expired or unregistered: prune from database
                    (0, db_1.query)(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [subscription.endpoint]).catch(() => { });
                }
                resolve({ success: status >= 200 && status < 300, statusCode: status });
            });
            req.on('error', (err) => {
                console.warn('Web Push delivery network notice:', err.message);
                resolve({ success: false });
            });
            req.write(encryptedBody);
            req.end();
        });
    }
    catch (err) {
        console.warn('Web Push encryption/dispatch error:', err.message);
        return { success: false };
    }
}
async function sendPushNotification(userIds, notification) {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    if (ids.length === 0)
        return;
    try {
        const subsRes = await (0, db_1.query)(`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1::text[])`, [ids]);
        if (subsRes.rows.length === 0)
            return;
        const pushPayload = {
            title: notification.title,
            body: notification.body,
            type: notification.type || 'NOTIFICATION',
            booking_id: notification.bookingId,
            reference_id: notification.referenceId,
            reference_type: notification.referenceType,
            url: notification.type?.includes('MESSAGE') || notification.referenceType === 'MESSAGE'
                ? '/messages'
                : notification.bookingId || notification.referenceType === 'BOOKING'
                    ? '/bookings'
                    : '/',
            created_at: new Date().toISOString(),
        };
        await Promise.allSettled(subsRes.rows.map((sub) => sendWebPush(sub, pushPayload)));
    }
    catch (err) {
        console.warn('Failed to dispatch user push notifications:', err);
    }
}
