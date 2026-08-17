const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeProfessionalPayload,
    supportsTransactions,
    createProfessionalRegistrationService
} = require('../src/services/professional-registration.service');

function standaloneConnection() {
    return { client: { topology: { description: { type: 'Single' } } } };
}

test('normaliza os dados próprios do profissional e rejeita negócio inválido', () => {
    const normalized = normalizeProfessionalPayload({
        name: 'Samuel', businessName: '  Salão Exemplo  ', slug: ' Salão Exemplo ',
        email: 'SAMUEL@EXAMPLE.COM', password: '12345678', role: 'ADMIN'
    });

    assert.equal(normalized.businessName, 'Salão Exemplo');
    assert.equal(normalized.requestedSlug, 'salao-exemplo');
    assert.equal(normalized.user.role, undefined);
    assert.throws(
        () => normalizeProfessionalPayload({ name: 'Samuel', businessName: '  ' }),
        (error) => error.statusCode === 400 && error.code === 'BUSINESS_NAME_REQUIRED'
    );
});

test('autocadastro sempre cria BARBER, perfil padrão e assinatura gratuita', async () => {
    const calls = [];
    const freePlan = { _id: 'free-plan', isFree: true, entitlements: {} };
    const service = createProfessionalRegistrationService({
        connection: standaloneConnection(),
        ensureFreePlan: async () => freePlan,
        createUser: async (payload, role) => {
            calls.push(['user', role, payload.role]);
            return { _id: 'user-1', name: payload.name, role };
        },
        createDefaultProfile: async (owner, businessName, slug) => {
            calls.push(['profile', owner, businessName, slug]);
            return { _id: 'profile-1', businessName, slug, active: true, published: false };
        },
        Subscription: {
            create: async (data) => {
                calls.push(['subscription', data.profile, data.plan, data.status]);
                return { _id: 'subscription-1', ...data };
            },
            deleteMany: async () => ({ deletedCount: 0 })
        },
        BarberProfile: { deleteOne: async () => ({ deletedCount: 0 }), deleteMany: async () => ({ deletedCount: 0 }) },
        User: { deleteOne: async () => ({ deletedCount: 0 }) },
        calculateSubscriptionState: (subscription, plan) => ({
            id: subscription._id, status: subscription.status, phase: 'FREE', plan
        })
    });

    const result = await service({
        name: 'Samuel', email: 'samuel@example.com', password: '12345678',
        businessName: 'Barbearia Samuel', slug: 'barbearia-samuel', role: 'ADMIN'
    });

    assert.deepEqual(calls, [
        ['user', 'BARBER', undefined],
        ['profile', 'user-1', 'Barbearia Samuel', 'barbearia-samuel'],
        ['subscription', 'profile-1', 'free-plan', 'FREE']
    ]);
    assert.equal(result.user.role, 'BARBER');
    assert.equal(result.profile.id, 'profile-1');
    assert.equal(result.billing.status, 'FREE');
});

test('remove usuário e perfil quando o provisionamento gratuito falha no Mongo standalone', async () => {
    const cleanup = [];
    const originalError = new Error('subscription failed');
    const service = createProfessionalRegistrationService({
        connection: standaloneConnection(),
        ensureFreePlan: async () => ({ _id: 'free-plan', isFree: true }),
        createUser: async (payload, role) => ({ _id: 'user-2', name: payload.name, role }),
        createDefaultProfile: async () => ({ _id: 'profile-2', businessName: 'Teste', slug: 'teste' }),
        Subscription: {
            create: async () => { throw originalError; },
            deleteMany: async (filter) => cleanup.push(['subscription', filter.profile])
        },
        BarberProfile: {
            deleteOne: async (filter) => cleanup.push(['profile', filter._id]),
            deleteMany: async () => undefined
        },
        User: { deleteOne: async (filter) => cleanup.push(['user', filter._id]) },
        calculateSubscriptionState: () => ({})
    });

    await assert.rejects(
        () => service({ name: 'Teste', email: 'test@example.com', password: '12345678', businessName: 'Teste' }),
        (error) => error === originalError
    );
    assert.deepEqual(cleanup, [
        ['subscription', 'profile-2'],
        ['profile', 'profile-2'],
        ['user', 'user-2']
    ]);
});

test('usa transação única quando a topologia Mongo oferece suporte', async () => {
    const events = [];
    const dbSession = {
        withTransaction: async (callback) => { events.push('transaction:start'); await callback(); events.push('transaction:commit'); },
        endSession: async () => events.push('session:end')
    };
    const connection = {
        client: { topology: { description: { type: 'ReplicaSetWithPrimary' } } },
        startSession: async () => dbSession
    };
    const service = createProfessionalRegistrationService({
        connection,
        ensureFreePlan: async () => ({ _id: 'free-plan', isFree: true }),
        createUser: async (payload, role, options) => {
            assert.equal(options.session, dbSession);
            return { _id: 'user-3', name: payload.name, role };
        },
        createDefaultProfile: async (owner, name, slug, options) => {
            assert.equal(options.session, dbSession);
            return { _id: 'profile-3', businessName: name, slug: slug || 'teste', active: true };
        },
        Subscription: {
            create: async (records, options) => {
                assert.equal(options.session, dbSession);
                return [{ _id: 'subscription-3', ...records[0] }];
            }
        },
        calculateSubscriptionState: () => ({ status: 'FREE' })
    });

    const result = await service({ name: 'Teste', phone: '(11) 99999-9999', password: '12345678', businessName: 'Teste' });

    assert.equal(supportsTransactions(connection), true);
    assert.equal(result.billing.status, 'FREE');
    assert.deepEqual(events, ['transaction:start', 'transaction:commit', 'session:end']);
});

test('cadastro profissional Google exige telefone e usa criador sem senha', async () => {
    assert.throws(
        () => normalizeProfessionalPayload({ businessName: 'Google Barber' }, { provider: 'google' }),
        (error) => error.statusCode === 400 && error.code === 'PROFESSIONAL_PHONE_REQUIRED'
    );

    const calls = [];
    const service = createProfessionalRegistrationService({
        connection: standaloneConnection(),
        ensureFreePlan: async () => ({ _id: 'free-google', isFree: true }),
        createUser: async () => { throw new Error('cadastro Google não deve usar senha'); },
        createGoogleUser: async (payload, role) => {
            calls.push(['google-user', payload.password, role, payload.phone]);
            return { _id: 'google-barber', name: payload.name, role, provider: 'google' };
        },
        createDefaultProfile: async (owner, name, slug) => {
            calls.push(['profile', owner, name, slug]);
            return { _id: 'google-profile', businessName: name, slug, active: true };
        },
        Subscription: {
            create: async (data) => {
                calls.push(['subscription', data.profile, data.plan, data.status]);
                return { _id: 'google-subscription', ...data };
            },
            deleteMany: async () => ({ deletedCount: 0 })
        },
        BarberProfile: { deleteOne: async () => ({ deletedCount: 0 }), deleteMany: async () => ({ deletedCount: 0 }) },
        User: { deleteOne: async () => ({ deletedCount: 0 }) },
        calculateSubscriptionState: () => ({ status: 'FREE' })
    });

    const result = await service({
        name: 'Profissional Google', email: 'google@example.com', phone: '(11) 98888-7777',
        businessName: 'Google Barber', slug: 'google-barber'
    }, { provider: 'google' });

    assert.equal(result.user.provider, 'google');
    assert.equal(result.billing.status, 'FREE');
    assert.deepEqual(calls, [
        ['google-user', undefined, 'BARBER', '(11) 98888-7777'],
        ['profile', 'google-barber', 'Google Barber', 'google-barber'],
        ['subscription', 'google-profile', 'free-google', 'FREE']
    ]);
});
