const bcrypt = require('bcryptjs');
const { User, Media } = require('../collections/CortsmeModels');
const { encryptText, decryptText, lookupHash, normalizeEmail, normalizePhone } = require('./security.service');
const { disconnectUserSockets } = require('../realtime/socket');
const { avatarPublicUrl, normalizeAvatarUrl } = require('./avatar.service');

function normalizeWhatsappMetaPhone(value) {
    const phone = String(value || '').trim();
    if (!phone) return '';
    // O override do provedor deve ser canônico e separado do telefone
    // principal. Aceitamos números brasileiros com 8 ou 9 dígitos locais e
    // nunca removemos/adicionamos o nono dígito informado pelo usuário.
    if (!/^\+55[1-9]\d[1-9]\d{7,8}$/.test(phone)) {
        throw Object.assign(new Error('O número alternativo do WhatsApp deve estar no formato E.164 brasileiro, por exemplo +556181748795.'), {
            statusCode: 400,
            code: 'WHATSAPP_META_PHONE_INVALID'
        });
    }
    return phone;
}

function userView(user) {
    const raw = typeof user.toObject === 'function' ? user.toObject() : { ...user };
    return {
        id: String(raw._id || raw.id), name: raw.name,
        email: decryptText(raw.emailEncrypted), phone: decryptText(raw.phoneEncrypted),
        whatsappMetaPhone: decryptText(raw.whatsappMetaPhoneEncrypted),
        avatar: avatarPublicUrl(raw), avatarUrl: avatarPublicUrl(raw),
        avatarSource: raw.avatarMedia ? 'upload' : (raw.avatar ? 'url' : ''),
        role: raw.role, provider: raw.provider,
        active: raw.active, createdAt: raw.createdAt
    };
}

async function findByIdentity(identity, withPassword = false) {
    const raw = String(identity || '').trim();
    const normalized = raw.includes('@') ? normalizeEmail(raw) : normalizePhone(raw);
    const field = raw.includes('@') ? 'emailHash' : 'phoneHash';
    const query = User.findOne({ [field]: lookupHash(normalized) });
    return withPassword ? query.select('+password') : query;
}

async function createUser(payload, role = 'USER', options = {}) {
    const email = normalizeEmail(payload.email);
    const phone = normalizePhone(payload.phone);
    const whatsappMetaPhone = normalizeWhatsappMetaPhone(payload.whatsappMetaPhone);
    if (!payload.name?.trim()) throw Object.assign(new Error('Informe seu nome.'), { statusCode: 400 });
    if (!email && !phone) throw Object.assign(new Error('Informe e-mail ou telefone.'), { statusCode: 400 });
    if (!payload.password || payload.password.length < 8 || payload.password.length > 128) throw Object.assign(new Error('A senha deve ter entre 8 e 128 caracteres.'), { statusCode: 400 });
    if (email && await User.exists({ emailHash: lookupHash(email) })) throw Object.assign(new Error('E-mail já cadastrado.'), { statusCode: 409 });
    if (phone && await User.exists({ phoneHash: lookupHash(phone) })) throw Object.assign(new Error('Telefone já cadastrado.'), { statusCode: 409 });
    const data = {
        name: payload.name.trim(), emailEncrypted: encryptText(email),
        emailHash: email ? lookupHash(email) : undefined,
        phoneEncrypted: encryptText(phone), phoneHash: phone ? lookupHash(phone) : undefined,
        whatsappMetaPhoneEncrypted: encryptText(whatsappMetaPhone),
        password: await bcrypt.hash(payload.password, 12), avatar: normalizeAvatarUrl(payload.avatar),
        role, provider: payload.provider || 'local'
    };
    if (options.session) return (await User.create([data], { session: options.session }))[0];
    return User.create(data);
}

async function createGoogleUser(payload, role = 'USER', options = {}) {
    const email = normalizeEmail(payload.email);
    const phone = normalizePhone(payload.phone);
    const whatsappMetaPhone = normalizeWhatsappMetaPhone(payload.whatsappMetaPhone);
    const name = String(payload.name || '').trim();
    if (!name) throw Object.assign(new Error('O Google não informou seu nome.'), { statusCode: 400, code: 'GOOGLE_NAME_REQUIRED' });
    if (!email) throw Object.assign(new Error('O Google não informou seu e-mail.'), { statusCode: 400, code: 'GOOGLE_EMAIL_REQUIRED' });
    if (await User.exists({ emailHash: lookupHash(email) })) {
        throw Object.assign(new Error('E-mail já cadastrado.'), { statusCode: 409, code: 'EMAIL_ALREADY_REGISTERED' });
    }
    if (phone && await User.exists({ phoneHash: lookupHash(phone) })) {
        throw Object.assign(new Error('Telefone já cadastrado.'), { statusCode: 409, code: 'PHONE_ALREADY_REGISTERED' });
    }
    const data = {
        name,
        emailEncrypted: encryptText(email),
        emailHash: lookupHash(email),
        phoneEncrypted: encryptText(phone),
        phoneHash: phone ? lookupHash(phone) : undefined,
        whatsappMetaPhoneEncrypted: encryptText(whatsappMetaPhone),
        avatar: normalizeAvatarUrl(payload.avatar),
        role,
        provider: 'google'
    };
    if (options.session) return (await User.create([data], { session: options.session }))[0];
    return User.create(data);
}

async function updateUser(user, payload) {
    let avatarMediaToDelete = null;
    if (payload.name !== undefined) user.name = String(payload.name).trim();
    if (payload.avatar !== undefined && String(payload.avatar || '').trim() !== avatarPublicUrl(user)) {
        user.avatar = normalizeAvatarUrl(payload.avatar);
        avatarMediaToDelete = user.avatarMedia || null;
        user.avatarMedia = null;
        user.avatarUpdatedAt = new Date();
    }
    if (payload.active !== undefined) user.active = Boolean(payload.active);
    if (payload.email !== undefined) {
        const email = normalizeEmail(payload.email);
        user.emailEncrypted = encryptText(email);
        user.emailHash = email ? lookupHash(email) : undefined;
    }
    if (payload.phone !== undefined) {
        const phone = normalizePhone(payload.phone);
        user.phoneEncrypted = encryptText(phone);
        user.phoneHash = phone ? lookupHash(phone) : undefined;
    }
    if (payload.whatsappMetaPhone !== undefined) {
        user.whatsappMetaPhoneEncrypted = encryptText(normalizeWhatsappMetaPhone(payload.whatsappMetaPhone));
    }
    if (payload.password) {
        if (user.provider === 'google') throw Object.assign(new Error('Sua senha é gerenciada pelo Google.'), { statusCode: 400, code: 'GOOGLE_PASSWORD_MANAGED' });
        if (typeof payload.password !== 'string' || payload.password.length < 8 || payload.password.length > 128) {
            throw Object.assign(new Error('A senha deve ter entre 8 e 128 caracteres.'), { statusCode: 400 });
        }
        user.password = await bcrypt.hash(payload.password, 12);
        user.passwordChangedAt = new Date();
    }
    const invalidatesSession = Boolean(payload.password)
        || (typeof user.isModified === 'function' && (user.isModified('role') || user.isModified('active')));
    if (invalidatesSession) user.authVersion = Number(user.authVersion || 0) + 1;
    const saved = await user.save();
    if (avatarMediaToDelete) await Media.deleteOne({ _id: avatarMediaToDelete, owner: saved._id, kind: 'avatar' });
    if (invalidatesSession) disconnectUserSockets(saved._id);
    return saved;
}

module.exports = {
    userView,
    findByIdentity,
    createUser,
    createGoogleUser,
    updateUser,
    normalizeWhatsappMetaPhone
};
