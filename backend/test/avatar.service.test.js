const test = require('node:test');
const assert = require('node:assert/strict');

const { Media } = require('../src/collections/CortsmeModels');
const {
    MAX_AVATAR_BYTES,
    detectImageMime,
    validateAvatarFile,
    normalizeAvatarUrl,
    avatarPublicUrl,
    saveAvatarUpload,
    setAvatarUrl
} = require('../src/services/avatar.service');

function pngFile(buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { buffer, size: buffer.length, mimetype: 'image/png', originalname: '../foto\u0000.png' };
}

test('detecta assinatura raster e rejeita MIME declarado diferente do conteúdo', () => {
    assert.equal(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0x00])), 'image/jpeg');
    assert.equal(detectImageMime(Buffer.from('RIFF0000WEBP', 'ascii')), 'image/webp');
    assert.equal(detectImageMime(Buffer.from('<svg></svg>')), '');
    assert.throws(
        () => validateAvatarFile({ ...pngFile(), mimetype: 'image/jpeg' }),
        (error) => error.statusCode === 400 && error.code === 'AVATAR_TYPE_INVALID'
    );
});

test('limita avatar a 4 MB e higieniza o nome antes de persistir', () => {
    const validated = validateAvatarFile(pngFile());
    assert.equal(validated.mimeType, 'image/png');
    assert.equal(validated.filename, 'foto.png');
    assert.match(validated.sha256, /^[a-f\d]{64}$/);
    const oversized = Buffer.alloc(MAX_AVATAR_BYTES + 1);
    oversized.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.throws(
        () => validateAvatarFile(pngFile(oversized)),
        (error) => error.code === 'AVATAR_TOO_LARGE'
    );
});

test('aceita somente URL HTTPS sem credenciais, data URL ou blob persistido', () => {
    assert.equal(normalizeAvatarUrl('https://cdn.example.com/avatar.png#preview'), 'https://cdn.example.com/avatar.png');
    assert.equal(normalizeAvatarUrl(''), '');
    for (const value of ['http://example.com/a.png', 'data:image/png;base64,AAAA', 'blob:https://example.com/id', 'https://user:secret@example.com/a.png']) {
        assert.throws(() => normalizeAvatarUrl(value), (error) => error.statusCode === 400);
    }
});

test('gera URL pública versionada para mídia associada e preserva URL externa', (context) => {
    const previous = process.env.API_PUBLIC_URL;
    process.env.API_PUBLIC_URL = 'https://cortsme.example/';
    context.after(() => { if (previous === undefined) delete process.env.API_PUBLIC_URL; else process.env.API_PUBLIC_URL = previous; });
    const updatedAt = new Date('2026-08-16T12:00:00.000Z');
    assert.equal(
        avatarPublicUrl({ _id: '507f1f77bcf86cd799439011', avatarMedia: '507f1f77bcf86cd799439012', avatarUpdatedAt: updatedAt }),
        `https://cortsme.example/api/media/avatar/507f1f77bcf86cd799439011?v=${updatedAt.getTime()}`
    );
    assert.equal(avatarPublicUrl({ _id: '1', avatar: 'https://cdn.example/a.jpg' }), 'https://cdn.example/a.jpg');
});

test('upload persiste um novo blob antes de trocar o ponteiro e só então remove o anterior', async () => {
    const calls = [];
    const userId = '507f1f77bcf86cd799439011';
    const user = { _id: userId, avatarMedia: 'media-new' };
    const dependencies = {
        Media: {
            create: async (data) => { calls.push({ type: 'media-create', data }); return { _id: 'media-new' }; },
            deleteOne: async (filter) => { calls.push({ type: 'media-delete', filter }); return {}; },
            updateOne: async (filter, update) => { calls.push({ type: 'media-promote', filter, update }); return {}; }
        },
        User: {
            findById: async () => ({ _id: userId, avatarMedia: 'media-old' }),
            findOneAndUpdate: async (filter, update, options) => {
                calls.push({ type: 'user-update', filter, update, options });
                return user;
            }
        }
    };
    const result = await saveAvatarUpload(userId, pngFile(), dependencies);
    assert.equal(result, user);
    assert.equal(calls[0].type, 'media-create');
    assert.equal(calls[0].data.kind, 'general');
    assert.equal(calls[1].type, 'user-update');
    assert.equal(calls[1].update.$set.avatarMedia, 'media-new');
    assert.equal(calls[1].update.$set.avatar, '');
    assert.equal(calls[2].type, 'media-delete');
    assert.equal(calls[2].filter._id, 'media-old');
    assert.equal(calls[3].type, 'media-promote');
});

test('troca por URL externa remove somente a mídia de avatar do mesmo owner', async () => {
    const deleted = [];
    const userId = '507f1f77bcf86cd799439011';
    const user = {
        _id: userId, avatar: 'https://cdn.example.com/new.webp', avatarMedia: null
    };
    const result = await setAvatarUrl(userId, 'https://cdn.example.com/new.webp', {
        User: {
            findById: async () => ({ _id: userId, avatarMedia: 'media-1' }),
            findOneAndUpdate: async () => user
        },
        Media: { deleteOne: async (filter) => deleted.push(filter) }
    });
    assert.equal(result.avatar, 'https://cdn.example.com/new.webp');
    assert.equal(result.avatarMedia, null);
    assert.deepEqual(deleted, [{ _id: 'media-1', owner: userId, kind: { $in: ['avatar', 'general'] } }]);
});

test('falha antes de associar remove somente o blob staged e preserva o avatar anterior', async () => {
    const deleted = [];
    const userId = '507f1f77bcf86cd799439011';
    await assert.rejects(() => saveAvatarUpload(userId, pngFile(), {
        User: {
            findById: async () => ({ _id: userId, avatarMedia: 'media-old' }),
            findOneAndUpdate: async () => { throw new Error('mongo indisponível'); },
            findOne: async () => null
        },
        Media: {
            create: async () => ({ _id: 'media-staged' }),
            deleteOne: async (filter) => { deleted.push(filter); return {}; }
        }
    }), /mongo indisponível/);
    assert.deepEqual(deleted, [{ _id: 'media-staged', owner: userId, kind: 'general' }]);
});

test('erro de resposta após escrita confirmada preserva e retorna o novo avatar', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const associated = { _id: userId, avatarMedia: 'media-new' };
    const result = await saveAvatarUpload(userId, pngFile(), {
        User: {
            findById: async () => ({ _id: userId, avatarMedia: 'media-old' }),
            findOneAndUpdate: async () => { throw new Error('resultado de escrita incerto'); },
            findOne: async () => associated
        },
        Media: {
            create: async () => ({ _id: 'media-new' }),
            deleteOne: async () => ({}),
            updateOne: async () => ({})
        }
    });
    assert.equal(result, associated);
});

test('falha de limpeza após associação não retorna falso fracasso', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const saved = { _id: userId, avatarMedia: 'media-new' };
    const warnings = [];
    const result = await saveAvatarUpload(userId, pngFile(), {
        User: {
            findById: async () => ({ _id: userId, avatarMedia: 'media-old' }),
            findOneAndUpdate: async () => saved
        },
        Media: {
            create: async () => ({ _id: 'media-new' }),
            deleteOne: async () => { throw new Error('limpeza atrasada'); },
            updateOne: async () => ({})
        },
        logger: { warn: (...args) => warnings.push(args) }
    });
    assert.equal(result, saved);
    assert.equal(warnings.length, 1);
});

test('não cria mídia quando o identificador de usuário é inválido', async () => {
    let touched = false;
    await assert.rejects(() => saveAvatarUpload('../admin', pngFile(), {
        Media: { findOneAndUpdate: async () => { touched = true; } },
        User: {}
    }), (error) => error.statusCode === 404 && error.code === 'USER_NOT_FOUND');
    assert.equal(touched, false);
});

test('schema mantém limite maior de mídia de site sem ampliar o limite do avatar', async () => {
    const fiveMb = Buffer.alloc(5 * 1024 * 1024, 1);
    const avatar = new Media({ owner: '507f1f77bcf86cd799439011', kind: 'avatar', mimeType: 'image/png', size: fiveMb.length, data: fiveMb });
    const site = new Media({ owner: '507f1f77bcf86cd799439011', kind: 'site', mimeType: 'image/png', size: fiveMb.length, data: fiveMb });
    await assert.rejects(() => avatar.validate(), (error) => Boolean(error.errors?.data));
    await site.validate();
});
