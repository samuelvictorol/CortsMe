const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const { User, Media } = require('../collections/CortsmeModels');

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AVATAR_MEDIA_KINDS = ['avatar', 'general'];

function avatarError(message, code = 'AVATAR_INVALID') {
    return Object.assign(new Error(message), { statusCode: 400, code });
}

function detectImageMime(buffer) {
    if (!Buffer.isBuffer(buffer)) return '';
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    return '';
}

function validateAvatarFile(file) {
    if (!file?.buffer || !file.size) throw avatarError('Selecione uma imagem.', 'AVATAR_REQUIRED');
    if (file.size > MAX_AVATAR_BYTES || file.buffer.length > MAX_AVATAR_BYTES) {
        throw avatarError('A imagem deve ter no máximo 4 MB.', 'AVATAR_TOO_LARGE');
    }
    const declaredMime = String(file.mimetype || '').toLowerCase();
    const detectedMime = detectImageMime(file.buffer);
    if (!ALLOWED_AVATAR_MIME_TYPES.has(declaredMime) || detectedMime !== declaredMime) {
        throw avatarError('Use uma imagem JPEG, PNG ou WebP válida.', 'AVATAR_TYPE_INVALID');
    }
    const filename = path.basename(String(file.originalname || 'avatar')).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 160) || 'avatar';
    return {
        filename,
        mimeType: detectedMime,
        size: file.buffer.length,
        data: file.buffer,
        sha256: crypto.createHash('sha256').update(file.buffer).digest('hex')
    };
}

function normalizeAvatarUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.length > 2048) throw avatarError('A URL da imagem é muito longa.', 'AVATAR_URL_INVALID');
    let parsed;
    try { parsed = new URL(raw); } catch { throw avatarError('Informe uma URL de imagem válida.', 'AVATAR_URL_INVALID'); }
    const localHttp = parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !localHttp) {
        throw avatarError('A imagem por URL deve usar HTTPS.', 'AVATAR_URL_INSECURE');
    }
    if (parsed.username || parsed.password) throw avatarError('A URL da imagem não pode conter credenciais.', 'AVATAR_URL_INVALID');
    parsed.hash = '';
    return parsed.toString();
}

function publicApiBase() {
    return String(process.env.API_PUBLIC_URL || '').trim().replace(/\/+$/, '');
}

function avatarPublicUrl(user) {
    const raw = typeof user?.toObject === 'function' ? user.toObject() : user || {};
    if (!raw.avatarMedia) return raw.avatar || '';
    const id = String(raw._id || raw.id || '');
    if (!id) return '';
    const versionDate = raw.avatarUpdatedAt || raw.updatedAt;
    const version = versionDate ? new Date(versionDate).getTime() : 0;
    return `${publicApiBase()}/api/media/avatar/${encodeURIComponent(id)}${version ? `?v=${version}` : ''}`;
}

const multerAvatar = multer({
    storage: multer.memoryStorage(),
    limits: { files: 1, fileSize: MAX_AVATAR_BYTES },
    fileFilter: (req, file, callback) => {
        const accepted = ALLOWED_AVATAR_MIME_TYPES.has(String(file.mimetype || '').toLowerCase());
        callback(accepted ? null : avatarError('Use uma imagem JPEG, PNG ou WebP.', 'AVATAR_TYPE_INVALID'), accepted);
    }
}).single('image');

function parseAvatarUpload(req, res, next) {
    multerAvatar(req, res, (error) => {
        if (!error) return next();
        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            return next(avatarError('A imagem deve ter no máximo 4 MB.', 'AVATAR_TOO_LARGE'));
        }
        if (!error.statusCode) {
            error.statusCode = 400;
            error.code = error.code || 'AVATAR_UPLOAD_INVALID';
        }
        return next(error);
    });
}

async function saveAvatarUpload(userId, file, dependencies = {}) {
    const deps = { User, Media, ...dependencies };
    const validated = validateAvatarFile(file);
    const owner = String(userId || '');
    if (!mongoose.isValidObjectId(owner)) {
        throw Object.assign(new Error('Usuário não encontrado.'), { statusCode: 404, code: 'USER_NOT_FOUND' });
    }
    let userQuery = deps.User.findById(owner);
    if (userQuery && typeof userQuery.select === 'function') userQuery = userQuery.select('avatarMedia');
    if (dependencies.session && userQuery && typeof userQuery.session === 'function') {
        userQuery = userQuery.session(dependencies.session);
    }
    const currentUser = await userQuery;
    if (!currentUser) {
        throw Object.assign(new Error('Usuário não encontrado.'), { statusCode: 404, code: 'USER_NOT_FOUND' });
    }
    const previousMedia = currentUser.avatarMedia || null;
    let stagedMedia;
    try {
        const created = dependencies.session
            ? await deps.Media.create([{ owner, profile: null, kind: 'general', ...validated }], { session: dependencies.session })
            : await deps.Media.create({ owner, profile: null, kind: 'general', ...validated });
        stagedMedia = Array.isArray(created) ? created[0] : created;
    } catch (error) {
        throw error;
    }

    let user;
    try {
        user = await deps.User.findOneAndUpdate(
            { _id: owner, avatarMedia: previousMedia || null },
            { $set: { avatar: '', avatarMedia: stagedMedia._id, avatarUpdatedAt: new Date() } },
            { new: true, runValidators: true, ...(dependencies.session ? { session: dependencies.session } : {}) }
        );
    } catch (error) {
        let associationChecked = false;
        let associatedUser = null;
        if (typeof deps.User.findOne === 'function') {
            try {
                let associationQuery = deps.User.findOne({ _id: owner, avatarMedia: stagedMedia._id });
                if (dependencies.session && associationQuery && typeof associationQuery.session === 'function') {
                    associationQuery = associationQuery.session(dependencies.session);
                }
                associatedUser = await associationQuery;
                associationChecked = true;
            } catch (_verificationError) {
                // Estado de escrita incerto: preservar o blob é mais seguro do que quebrar
                // um ponteiro que pode ter sido confirmado pelo Mongo.
            }
        }
        if (associatedUser) user = associatedUser;
        else {
            if (associationChecked) {
                await deps.Media.deleteOne({ _id: stagedMedia._id, owner, kind: 'general' }).catch(() => {});
            }
            throw error;
        }
    }
    if (!user) {
        await deps.Media.deleteOne({ _id: stagedMedia._id, owner, kind: 'general' }).catch(() => {});
        throw Object.assign(new Error('O avatar foi alterado em outra sessão. Atualize a página e tente novamente.'), {
            statusCode: 409,
            code: 'AVATAR_CONCURRENT_UPDATE'
        });
    }

    // A associação já está confirmada. Falhas de limpeza não devem transformar uma
    // troca concluída em falso erro para o cliente; a rota pública usa o ponteiro do usuário.
    try {
        if (previousMedia && String(previousMedia) !== String(stagedMedia._id)) {
            await deps.Media.deleteOne({
                _id: previousMedia,
                owner,
                kind: { $in: AVATAR_MEDIA_KINDS }
            });
        }
        if (typeof deps.Media.updateOne === 'function') {
            await deps.Media.updateOne(
                { _id: stagedMedia._id, owner, kind: 'general' },
                { $set: { kind: 'avatar' } },
                dependencies.session ? { session: dependencies.session } : undefined
            );
        }
    } catch (error) {
        (dependencies.logger || console).warn('Avatar associado; limpeza posterior pendente.', {
            userId: owner,
            error: error.message
        });
    }
    return user;
}

async function setAvatarUrl(userId, value, dependencies = {}) {
    const deps = { User, Media, ...dependencies };
    const avatar = normalizeAvatarUrl(value);
    if (!mongoose.isValidObjectId(userId)) {
        throw Object.assign(new Error('Usuário não encontrado.'), { statusCode: 404, code: 'USER_NOT_FOUND' });
    }
    let userQuery = deps.User.findById(userId);
    if (userQuery && typeof userQuery.select === 'function') userQuery = userQuery.select('avatarMedia');
    const currentUser = await userQuery;
    if (!currentUser) throw Object.assign(new Error('Usuário não encontrado.'), { statusCode: 404, code: 'USER_NOT_FOUND' });
    const previousMedia = currentUser.avatarMedia || null;
    const user = await deps.User.findOneAndUpdate(
        { _id: userId, avatarMedia: previousMedia || null },
        { $set: { avatar, avatarMedia: null, avatarUpdatedAt: new Date() } },
        { new: true, runValidators: true }
    );
    if (!user) {
        throw Object.assign(new Error('O avatar foi alterado em outra sessão. Atualize a página e tente novamente.'), {
            statusCode: 409,
            code: 'AVATAR_CONCURRENT_UPDATE'
        });
    }
    if (previousMedia) {
        try {
            await deps.Media.deleteOne({
                _id: previousMedia,
                owner: user._id,
                kind: { $in: AVATAR_MEDIA_KINDS }
            });
        } catch (error) {
            (dependencies.logger || console).warn('Avatar por URL salvo; mídia anterior aguardando limpeza.', {
                userId: String(user._id),
                error: error.message
            });
        }
    }
    return user;
}

module.exports = {
    MAX_AVATAR_BYTES,
    ALLOWED_AVATAR_MIME_TYPES,
    detectImageMime,
    validateAvatarFile,
    normalizeAvatarUrl,
    avatarPublicUrl,
    parseAvatarUpload,
    saveAvatarUpload,
    setAvatarUrl
};
