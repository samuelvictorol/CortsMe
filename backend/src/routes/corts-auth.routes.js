const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { OAuth2Client } = require('google-auth-library');
const { User, Media } = require('../collections/CortsmeModels');
const { createUser, findByIdentity, userView, updateUser } = require('../services/user.service');
const { lookupHash, normalizeEmail, encryptText } = require('../services/security.service');
const { requireAuth } = require('../middlewares/corts-auth.middleware');
const { asyncRoute } = require('./route.helpers');
const { registerProfessional } = require('../services/professional-registration.service');
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 }, fileFilter: (req, file, callback) => callback(file.mimetype.startsWith('image/') ? null : new Error('Envie apenas imagens.'), file.mimetype.startsWith('image/')) });

function session(user) {
    return {
        token: jwt.sign({ role: user.role }, process.env.JWT_SECRET, { subject: String(user._id), expiresIn: process.env.JWT_EXPIRES_IN || '90d' }),
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
    if (typeof identity !== 'string' || typeof req.body.password !== 'string') {
        throw Object.assign(new Error('Informe e-mail ou telefone e senha.'), { statusCode: 400 });
    }
    const user = await findByIdentity(identity, true);
    if (!user || !user.active || !await bcrypt.compare(String(req.body.password || ''), user.password || '')) {
        throw Object.assign(new Error('E-mail, telefone ou senha inválidos.'), { statusCode: 401 });
    }
    res.json(session(user));
}));

router.post('/google', asyncRoute(async (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID) throw Object.assign(new Error('Login Google ainda não foi configurado.'), { statusCode: 503 });
    const professionalAccess = req.body.accountType === 'professional';
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: req.body.credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const email = normalizeEmail(payload.email);
    let user = await User.findOne({ emailHash: lookupHash(email) });
    if (!user && professionalAccess) {
        throw Object.assign(new Error('Crie primeiro seu espaço profissional pelo formulário. Depois você poderá entrar com o Google.'), { statusCode: 409, code: 'PROFESSIONAL_GOOGLE_REGISTRATION_REQUIRED' });
    }
    if (user && professionalAccess && !['BARBER', 'ADMIN'].includes(user.role)) {
        throw Object.assign(new Error('Este Google está vinculado a uma conta de cliente. Use uma conta profissional.'), { statusCode: 403, code: 'PROFESSIONAL_ACCOUNT_REQUIRED' });
    }
    if (!user) {
        user = await User.create({ name: payload.name, emailEncrypted: encryptText(email), emailHash: lookupHash(email), avatar: payload.picture, provider: 'google', role: 'USER' });
    } else if (!user.avatar && payload.picture) {
        user.avatar = payload.picture;
        await user.save();
    }
    res.json(session(user));
}));

router.get('/me', requireAuth, asyncRoute(async (req, res) => res.json({ user: userView(req.user) })));
router.patch('/me', requireAuth, asyncRoute(async (req, res) => {
    await updateUser(req.user, req.body);
    res.json({ user: userView(req.user) });
}));

router.post('/avatar', requireAuth, avatarUpload.single('image'), asyncRoute(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Selecione uma imagem.' });
    const media = await Media.create({ owner: req.auth.userId, filename: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size, data: req.file.buffer });
    req.user.avatar = `${process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`}/api/media/${media._id}`;
    await req.user.save();
    res.status(201).json({ user: userView(req.user), url: req.user.avatar });
}));

module.exports = router;
