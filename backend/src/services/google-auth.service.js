const { OAuth2Client } = require('google-auth-library');
const { User } = require('../collections/CortsmeModels');
const { createGoogleUser } = require('./user.service');
const { registerProfessional } = require('./professional-registration.service');
const { lookupHash, normalizeEmail } = require('./security.service');

function httpError(message, statusCode, code) {
    return Object.assign(new Error(message), { statusCode, code });
}

async function verifyGoogleCredential(credential, clientId) {
    if (!clientId) throw httpError('Login Google ainda não foi configurado.', 503, 'GOOGLE_NOT_CONFIGURED');
    if (typeof credential !== 'string' || !credential.trim()) {
        throw httpError('Credencial Google não informada.', 400, 'GOOGLE_CREDENTIAL_REQUIRED');
    }
    try {
        const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: credential, audience: clientId });
        return ticket.getPayload();
    } catch {
        throw httpError('Não foi possível validar este acesso com o Google.', 401, 'GOOGLE_CREDENTIAL_INVALID');
    }
}

function createGoogleAuthService(dependencies = {}) {
    const deps = {
        User,
        createGoogleUser,
        registerProfessional,
        verifyCredential: verifyGoogleCredential,
        clientId: process.env.GOOGLE_CLIENT_ID,
        ...dependencies
    };

    return async function authenticateGoogle(request = {}) {
        const accountType = request.accountType === 'professional' ? 'professional' : 'client';
        const payload = await deps.verifyCredential(request.credential, deps.clientId || process.env.GOOGLE_CLIENT_ID);
        if (typeof payload?.email !== 'string' || !payload.email.trim() || payload.email_verified !== true) {
            throw httpError('O Google não confirmou este endereço de e-mail.', 401, 'GOOGLE_EMAIL_NOT_VERIFIED');
        }

        const email = normalizeEmail(payload.email);
        const name = String(payload.name || payload.given_name || email.split('@')[0]).trim();
        let user = await deps.User.findOne({ emailHash: lookupHash(email) });
        if (user) {
            if (!user.active) {
                throw httpError('Esta conta está inativa. Fale com o suporte para recuperar o acesso.', 403, 'ACCOUNT_INACTIVE');
            }
            if (accountType === 'professional' && !['BARBER', 'ADMIN'].includes(user.role)) {
                throw httpError(
                    'Este Google está vinculado a uma conta de cliente. Use outra conta para criar seu espaço profissional.',
                    403,
                    'PROFESSIONAL_ACCOUNT_REQUIRED'
                );
            }
            if (!user.avatar && payload.picture) {
                user.avatar = payload.picture;
                await user.save();
            }
            return { user, created: false };
        }

        if (accountType === 'professional') {
            const professional = await deps.registerProfessional({
                name,
                email,
                avatar: payload.picture,
                phone: request.phone,
                businessName: request.businessName,
                slug: request.slug,
                planCode: request.planCode
            }, { provider: 'google' });
            return { ...professional, created: true };
        }

        user = await deps.createGoogleUser({
            name,
            email,
            avatar: payload.picture
        }, 'USER');
        return { user, created: true };
    };
}

const authenticateGoogle = createGoogleAuthService();

module.exports = { verifyGoogleCredential, createGoogleAuthService, authenticateGoogle };
