const test = require('node:test');
const assert = require('node:assert/strict');

const { createGoogleAuthService } = require('../src/services/google-auth.service');

function googlePayload(overrides = {}) {
    return {
        name: 'Profissional Google',
        email: 'PROFISSIONAL@EXAMPLE.COM',
        email_verified: true,
        picture: 'https://example.com/avatar.jpg',
        ...overrides
    };
}

function userRepository(existing = null) {
    return { findOne: async () => existing };
}

test('novo profissional Google cria BARBER, perfil e cobrança sem senha', async () => {
    const calls = [];
    const authenticate = createGoogleAuthService({
        clientId: 'google-client-id',
        verifyCredential: async (credential, clientId) => {
            calls.push(['verify', credential, clientId]);
            return googlePayload();
        },
        User: userRepository(),
        registerProfessional: async (payload, options) => {
            calls.push(['register', payload, options]);
            return {
                user: { _id: 'barber-1', role: 'BARBER', active: true, provider: 'google' },
                profile: { id: 'profile-1', businessName: payload.businessName, slug: payload.slug },
                billing: { status: 'FREE' }
            };
        }
    });

    const result = await authenticate({
        credential: 'signed-google-token',
        accountType: 'professional',
        businessName: 'Barbearia Google',
        phone: '(11) 99999-9999',
        slug: 'barbearia-google'
    });

    assert.equal(result.created, true);
    assert.equal(result.user.role, 'BARBER');
    assert.equal(result.profile.id, 'profile-1');
    assert.equal(result.billing.status, 'FREE');
    assert.deepEqual(calls[0], ['verify', 'signed-google-token', 'google-client-id']);
    assert.equal(calls[1][0], 'register');
    assert.equal(calls[1][1].email, 'profissional@example.com');
    assert.equal(calls[1][1].password, undefined);
    assert.equal(calls[1][1].businessName, 'Barbearia Google');
    assert.deepEqual(calls[1][2], { provider: 'google' });
});

test('login Google preserva profissional existente sem reprovisionar perfil', async () => {
    let registrations = 0;
    let saves = 0;
    const existing = {
        _id: 'barber-existing', role: 'BARBER', active: true, provider: 'google', avatar: '',
        save: async () => { saves += 1; }
    };
    const authenticate = createGoogleAuthService({
        verifyCredential: async () => googlePayload(),
        User: userRepository(existing),
        registerProfessional: async () => { registrations += 1; }
    });

    const result = await authenticate({ credential: 'token', accountType: 'professional' });

    assert.equal(result.user, existing);
    assert.equal(result.created, false);
    assert.equal(registrations, 0);
    assert.equal(existing.avatar, 'https://example.com/avatar.jpg');
    assert.equal(saves, 1);
});

test('Google profissional nunca converte uma conta de cliente existente', async () => {
    const authenticate = createGoogleAuthService({
        verifyCredential: async () => googlePayload(),
        User: userRepository({ _id: 'client-1', role: 'USER', active: true, provider: 'google' })
    });

    await assert.rejects(
        () => authenticate({ credential: 'token', accountType: 'professional', businessName: 'Não converter' }),
        (error) => error.statusCode === 403 && error.code === 'PROFESSIONAL_ACCOUNT_REQUIRED'
    );
});

test('login Google rejeita usuário inativo antes de criar sessão', async () => {
    const authenticate = createGoogleAuthService({
        verifyCredential: async () => googlePayload(),
        User: userRepository({ _id: 'inactive-1', role: 'BARBER', active: false, provider: 'google' })
    });

    await assert.rejects(
        () => authenticate({ credential: 'token', accountType: 'professional' }),
        (error) => error.statusCode === 403 && error.code === 'ACCOUNT_INACTIVE'
    );
});

test('novo cliente Google continua sendo criado como USER', async () => {
    let created;
    const authenticate = createGoogleAuthService({
        verifyCredential: async () => googlePayload({ name: 'Cliente Google' }),
        User: userRepository(),
        createGoogleUser: async (payload, role) => {
            created = { payload, role };
            return { _id: 'client-new', role, active: true, provider: 'google' };
        }
    });

    const result = await authenticate({
        credential: 'token',
        accountType: 'client',
        phone: '(61) 98174-8795'
    });

    assert.equal(result.user.role, 'USER');
    assert.equal(created.role, 'USER');
    assert.equal(created.payload.email, 'profissional@example.com');
    assert.equal(created.payload.phone, '(61) 98174-8795');
});

test('Google sem e-mail verificado é rejeitado', async () => {
    const authenticate = createGoogleAuthService({
        verifyCredential: async () => googlePayload({ email_verified: false }),
        User: userRepository()
    });

    await assert.rejects(
        () => authenticate({ credential: 'token', accountType: 'client' }),
        (error) => error.statusCode === 401 && error.code === 'GOOGLE_EMAIL_NOT_VERIFIED'
    );
});
