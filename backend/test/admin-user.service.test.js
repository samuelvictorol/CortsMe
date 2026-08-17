const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parseAdminUserPayload,
    createAdminUserService
} = require('../src/services/admin-user.service');

test('payload multipart administrativo aceita somente objeto JSON', () => {
    assert.deepEqual(parseAdminUserPayload({ data: '{"name":"Samuel"}' }), { name: 'Samuel' });
    assert.deepEqual(parseAdminUserPayload({ name: 'Samuel' }), { name: 'Samuel' });
    assert.throws(
        () => parseAdminUserPayload({ data: '["indevido"]' }),
        (error) => error.code === 'ADMIN_USER_PAYLOAD_INVALID'
    );
});

test('arquivo inválido é rejeitado antes de criar usuário administrativo', async () => {
    let created = false;
    const create = createAdminUserService({
        validateAvatarFile: () => { throw Object.assign(new Error('imagem inválida'), { code: 'AVATAR_TYPE_INVALID' }); },
        createUser: async () => { created = true; },
        logger: { warn() {}, error() {} }
    });
    await assert.rejects(() => create({ role: 'USER' }, { buffer: Buffer.from('x') }), /imagem inválida/);
    assert.equal(created, false);
});

test('falha ao criar perfil compensa usuário BARBER em vez de deixá-lo órfão', async () => {
    const cleaned = [];
    const create = createAdminUserService({
        createUser: async () => ({ _id: 'user-new', name: 'Barbeiro' }),
        createDefaultProfile: async () => { throw new Error('slug duplicado'); },
        User: { deleteOne: async (filter) => cleaned.push(['user', filter]) },
        BarberProfile: { deleteMany: async (filter) => cleaned.push(['profile', filter]) },
        Media: { deleteMany: async (filter) => cleaned.push(['media', filter]) },
        logger: { warn() {}, error() {} }
    });
    await assert.rejects(() => create({ role: 'BARBER', businessName: 'Corts' }), /slug duplicado/);
    assert.deepEqual(cleaned.map(([kind]) => kind).sort(), ['media', 'profile', 'user']);
});

test('falha de persistência do avatar reconhece criação concluída sem falso fracasso', async () => {
    const warnings = [];
    const user = { _id: 'user-new', name: 'Cliente' };
    const create = createAdminUserService({
        validateAvatarFile: () => ({}),
        createUser: async () => user,
        saveAvatarUpload: async () => { throw Object.assign(new Error('mongo'), { code: 'AVATAR_SAVE_FAILED' }); },
        logger: { warn: (...args) => warnings.push(args), error() {} }
    });
    const result = await create({ role: 'USER' }, { buffer: Buffer.from('imagem') });
    assert.equal(result.user, user);
    assert.match(result.avatarWarning, /Usuário criado/);
    assert.equal(warnings.length, 1);
});
