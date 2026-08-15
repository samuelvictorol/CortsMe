const crypto = require('crypto');

function key() {
    const value = process.env.DATA_ENCRYPTION_KEY || 'change-this-cortsme-development-key';
    return crypto.createHash('sha256').update(value).digest();
}

function encryptText(value) {
    if (!value) return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
    const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

function decryptText(value) {
    if (!value) return '';
    try {
        const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
        const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch {
        return '';
    }
}

function lookupHash(value) {
    return crypto.createHmac('sha256', key()).update(String(value || '')).digest('hex');
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
    return String(value || '').replace(/\D/g, '');
}

module.exports = { encryptText, decryptText, lookupHash, normalizeEmail, normalizePhone };
