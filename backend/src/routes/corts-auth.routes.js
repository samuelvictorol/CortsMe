const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, SecureLink } = require('../collections/CortsmeModels');
const { createUser, findByIdentity, userView, updateUser } = require('../services/user.service');
const { requireAuth } = require('../middlewares/corts-auth.middleware');
const { asyncRoute } = require('./route.helpers');
const { registerProfessional } = require('../services/professional-registration.service');
const { createSecureLink, verifySecureLink, consumeSecureLink } = require('../services/secure-link.service');
const { enqueuePasswordReset } = require('../services/notification.service');
const { disconnectUserSockets } = require('../realtime/socket');
const { authenticateGoogle } = require('../services/google-auth.service');
const { parseAvatarUpload, saveAvatarUpload, setAvatarUrl, avatarPublicUrl } = require('../services/avatar.service');

function session(user) {
    return {
        token: jwt.sign({ role: user.role, ver: Number(user.authVersion || 0) }, process.env.JWT_SECRET, { subject: String(user._id), expiresIn: process.env.JWT_EXPIRES_IN || '120d' }),
        user: userView(user)
    };
}

router.post('/register', asyncRoute(async (req, res) => {
    const user = await createUser(req.body, 'USER');
    res.status(201).json(session(user));
}));

/**
 * @openapi
 * /auth/register-professional:
 *   post:
 *     tags: [Autenticação]
 *     summary: Cria uma conta profissional com perfil e plano gratuito
 *     description: O papel é sempre BARBER, independentemente de qualquer role enviado pelo cliente.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, password, businessName]
 *             anyOf:
 *               - required: [email]
 *               - required: [phone]
 *             properties:
 *               name: { type: string, example: Samuel Silva }
 *               email: { type: string, format: email, example: samuel@example.com }
 *               phone: { type: string, example: "(11) 99999-9999" }
 *               whatsappMetaPhone: { type: string, pattern: '^\\+55[1-9]\\d[1-9]\\d{7,8}$', example: '+556181748795' }
 *               password: { type: string, format: password, minLength: 8 }
 *               businessName: { type: string, maxLength: 120, example: Barbearia Samuel }
 *               slug: { type: string, example: barbearia-samuel }
 *     responses:
 *       201:
 *         description: Conta profissional, perfil e assinatura gratuita criados.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       409:
 *         description: E-mail ou telefone já cadastrado.
 */
router.post('/register-professional', asyncRoute(async (req, res) => {
    const professional = await registerProfessional(req.body);
    res.status(201).json({
        ...session(professional.user),
        profile: professional.profile,
        billing: professional.billing
    });
}));

router.post('/login', asyncRoute(async (req, res) => {
    const identity = req.body.identity || req.body.email || req.body.phone;
    if (typeof identity !== 'string' || typeof req.body.password !== 'string' || req.body.password.length > 128) {
        throw Object.assign(new Error('Informe e-mail ou telefone e senha.'), { statusCode: 400 });
    }
    const user = await findByIdentity(identity, true);
    if (!user || !user.active || !await bcrypt.compare(String(req.body.password || ''), user.password || '')) {
        throw Object.assign(new Error('E-mail, telefone ou senha inválidos.'), { statusCode: 401 });
    }
    res.json(session(user));
}));

router.post('/google', asyncRoute(async (req, res) => {
    const result = await authenticateGoogle(req.body);
    res.json({
        ...session(result.user),
        ...(result.profile ? { profile: result.profile } : {}),
        ...(result.billing ? { billing: result.billing } : {})
    });
}));

router.post('/forgot-password', asyncRoute(async (req, res) => {
    const identity = typeof req.body?.identity === 'string' ? req.body.identity.trim() : '';
    if (identity) {
        const user = await findByIdentity(identity);
        if (user?.active && user.provider !== 'google') {
            try {
                const secure = await createSecureLink({
                    purpose: 'RESET_PASSWORD', userId: user._id,
                    expiresInSeconds: 60 * 60, revokePrevious: true,
                    metadata: { role: user.role }
                });
                await enqueuePasswordReset({
                    user, token: secure.token,
                    accountType: user.role === 'BARBER' ? 'professional' : 'client'
                });
            } catch (error) {
                console.warn(`Password reset notification could not be queued: ${error.code || error.message}`);
            }
        }
    }
    res.status(202).json({
        accepted: true,
        message: 'Se a conta existir e usar senha, você receberá as instruções de redefinição.'
    });
}));

router.get('/reset-password/:token', asyncRoute(async (req, res) => {
    const { record } = await verifySecureLink(req.params.token, 'RESET_PASSWORD');
    const user = await User.findOne({ _id: record.user, active: true });
    if (!user || user.provider === 'google') {
        return res.status(410).json({ message: 'Este link é inválido ou expirou.', code: 'SECURE_LINK_INVALID' });
    }
    res.json({
        valid: true,
        accountType: user.role === 'BARBER' ? 'professional' : 'client',
        displayName: user.name
    });
}));

router.post('/reset-password', asyncRoute(async (req, res) => {
    const password = String(req.body?.password || '');
    if (password.length < 8 || password.length > 128) {
        return res.status(400).json({ message: 'A nova senha deve ter entre 8 e 128 caracteres.' });
    }
    const { record } = await verifySecureLink(req.body?.token, 'RESET_PASSWORD');
    const user = await User.findOne({ _id: record.user, active: true }).select('+password');
    if (!user || user.provider === 'google') {
        return res.status(410).json({ message: 'Este link é inválido ou expirou.', code: 'SECURE_LINK_INVALID' });
    }
    await consumeSecureLink(record);
    user.password = await bcrypt.hash(password, 12);
    user.authVersion = Number(user.authVersion || 0) + 1;
    user.passwordChangedAt = new Date();
    await user.save();
    await SecureLink.updateMany(
        { _id: { $ne: record._id }, purpose: 'RESET_PASSWORD', user: user._id, consumedAt: null, revokedAt: null },
        { $set: { revokedAt: new Date() } }
    );
    disconnectUserSockets(user._id);
    res.json({ success: true, message: 'Senha redefinida. Entre novamente com sua nova senha.' });
}));

router.get('/me', requireAuth, asyncRoute(async (req, res) => res.json({ user: userView(req.user) })));
router.patch('/me', requireAuth, asyncRoute(async (req, res) => {
    const passwordChanged = Boolean(req.body?.password);
    await updateUser(req.user, req.body);
    res.json(passwordChanged ? session(req.user) : { user: userView(req.user) });
}));

router.post('/avatar', requireAuth, parseAvatarUpload, asyncRoute(async (req, res) => {
    const user = await saveAvatarUpload(req.auth.userId, req.file);
    res.status(201).json({ user: userView(user), url: avatarPublicUrl(user), source: 'upload' });
}));

router.put('/avatar', requireAuth, asyncRoute(async (req, res) => {
    const user = await setAvatarUrl(req.auth.userId, req.body?.url);
    res.json({ user: userView(user), url: avatarPublicUrl(user), source: user.avatar ? 'url' : '' });
}));

router.delete('/avatar', requireAuth, asyncRoute(async (req, res) => {
    const user = await setAvatarUrl(req.auth.userId, '');
    res.json({ user: userView(user), url: '', source: '' });
}));

module.exports = router;
