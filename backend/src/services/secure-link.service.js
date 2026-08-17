const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { SecureLink } = require('../collections/CortsmeModels');

const ISSUER = 'cortsme-api';
const AUDIENCE = 'cortsme-secure-links';

function signingSecret() {
    const secret = process.env.LINK_SIGNING_SECRET || process.env.JWT_SECRET;
    if (!secret) throw Object.assign(new Error('Assinatura de links não configurada.'), { statusCode: 503, code: 'LINK_SIGNING_NOT_CONFIGURED' });
    return secret;
}

function tokenHash(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

async function createSecureLink({
    purpose,
    userId = null,
    profileId = null,
    appointmentId = null,
    expiresInSeconds = 3600,
    metadata = null,
    revokePrevious = false
}) {
    const expiresIn = Math.max(60, Number(expiresInSeconds) || 3600);
    if (revokePrevious && userId) {
        await SecureLink.updateMany(
            { purpose, user: userId, consumedAt: null, revokedAt: null },
            { $set: { revokedAt: new Date() } }
        );
    }
    const jwtId = crypto.randomUUID();
    const claims = {
        purpose,
        ...(userId ? { userId: String(userId) } : {}),
        ...(profileId ? { profileId: String(profileId) } : {}),
        ...(appointmentId ? { appointmentId: String(appointmentId) } : {})
    };
    const token = jwt.sign(claims, signingSecret(), {
        algorithm: 'HS256', issuer: ISSUER, audience: AUDIENCE,
        jwtid: jwtId, expiresIn
    });
    const decoded = jwt.decode(token);
    const record = await SecureLink.create({
        tokenHash: tokenHash(token), purpose,
        user: userId, profile: profileId, appointment: appointmentId,
        expiresAt: new Date(decoded.exp * 1000), metadata
    });
    return { token, record, expiresAt: record.expiresAt };
}

async function verifySecureLink(token, expectedPurpose) {
    let payload;
    try {
        payload = jwt.verify(String(token || ''), signingSecret(), {
            algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE
        });
    } catch {
        throw Object.assign(new Error('Este link é inválido ou expirou.'), { statusCode: 410, code: 'SECURE_LINK_INVALID' });
    }
    if (payload.purpose !== expectedPurpose) {
        throw Object.assign(new Error('Este link não pode ser usado para esta ação.'), { statusCode: 403, code: 'SECURE_LINK_PURPOSE_MISMATCH' });
    }
    const record = await SecureLink.findOne({ tokenHash: tokenHash(token), purpose: expectedPurpose });
    if (!record || record.revokedAt || record.consumedAt || record.expiresAt <= new Date()) {
        throw Object.assign(new Error('Este link é inválido ou expirou.'), { statusCode: 410, code: 'SECURE_LINK_INVALID' });
    }
    const referencesMatch = (!payload.userId || String(record.user) === payload.userId)
        && (!payload.profileId || String(record.profile) === payload.profileId)
        && (!payload.appointmentId || String(record.appointment) === payload.appointmentId);
    if (!referencesMatch) {
        throw Object.assign(new Error('Este link não corresponde ao recurso solicitado.'), { statusCode: 403, code: 'SECURE_LINK_REFERENCE_MISMATCH' });
    }
    return { payload, record };
}

async function consumeSecureLink(record) {
    const consumed = await SecureLink.findOneAndUpdate(
        { _id: record._id, consumedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } },
        { $set: { consumedAt: new Date() } },
        { returnDocument: 'after' }
    );
    if (!consumed) {
        throw Object.assign(new Error('Este link já foi utilizado ou expirou.'), { statusCode: 410, code: 'SECURE_LINK_CONSUMED' });
    }
    return consumed;
}

module.exports = { createSecureLink, verifySecureLink, consumeSecureLink, tokenHash };
