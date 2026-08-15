const bcrypt = require('bcryptjs');
const { User } = require('../collections/CortsmeModels');
const { encryptText, decryptText, lookupHash, normalizeEmail, normalizePhone } = require('./security.service');

function userView(user) {
    const raw = typeof user.toObject === 'function' ? user.toObject() : { ...user };
    return {
        id: String(raw._id || raw.id), name: raw.name,
        email: decryptText(raw.emailEncrypted), phone: decryptText(raw.phoneEncrypted),
        avatar: raw.avatar || '', role: raw.role, provider: raw.provider,
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

async function createUser(payload, role = 'USER') {
    const email = normalizeEmail(payload.email);
    const phone = normalizePhone(payload.phone);
    if (!payload.name?.trim()) throw Object.assign(new Error('Informe seu nome.'), { statusCode: 400 });
    if (!email && !phone) throw Object.assign(new Error('Informe e-mail ou telefone.'), { statusCode: 400 });
    if (!payload.password || payload.password.length < 8) throw Object.assign(new Error('A senha deve ter ao menos 8 caracteres.'), { statusCode: 400 });
    if (email && await User.exists({ emailHash: lookupHash(email) })) throw Object.assign(new Error('E-mail já cadastrado.'), { statusCode: 409 });
    if (phone && await User.exists({ phoneHash: lookupHash(phone) })) throw Object.assign(new Error('Telefone já cadastrado.'), { statusCode: 409 });
    return User.create({
        name: payload.name.trim(), emailEncrypted: encryptText(email),
        emailHash: email ? lookupHash(email) : undefined,
        phoneEncrypted: encryptText(phone), phoneHash: phone ? lookupHash(phone) : undefined,
        password: await bcrypt.hash(payload.password, 12), avatar: payload.avatar || '',
        role, provider: payload.provider || 'local'
    });
}

async function updateUser(user, payload) {
    if (payload.name !== undefined) user.name = String(payload.name).trim();
    if (payload.avatar !== undefined) user.avatar = payload.avatar;
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
    if (payload.password) user.password = await bcrypt.hash(payload.password, 12);
    return user.save();
}

module.exports = { userView, findByIdentity, createUser, updateUser };
