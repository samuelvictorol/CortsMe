const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../app');
const jwt = require('jsonwebtoken');
const { User } = require('../src/collections/CortsmeModels');

test('rotas de produto exigem Bearer token antes de acessar o banco', async (context) => {
    const server = app.listen(0);
    context.after(() => server.close());

    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/product/search`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.code, 'AUTHENTICATION_REQUIRED');
});

test('rota de login permanece pública e valida o contrato HTTP', async (context) => {
    const server = app.listen(0);
    context.after(() => server.close());

    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 123 })
    });

    assert.equal(response.status, 400);
});

test('autocadastro profissional é público e exige o nome do negócio antes de acessar o banco', async (context) => {
    const server = app.listen(0);
    context.after(() => server.close());

    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/auth/register-professional`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            name: 'Profissional', email: 'profissional@example.com', password: '12345678', role: 'ADMIN'
        })
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.code, 'BUSINESS_NAME_REQUIRED');
});

test('esqueci minha senha responde de forma neutra sem enumerar conta', async (context) => {
    const server = app.listen(0);
    context.after(() => server.close());
    await new Promise((resolve) => server.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/forgot-password`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({})
    });
    const body = await response.json();
    assert.equal(response.status, 202);
    assert.equal(body.accepted, true);
    assert.match(body.message, /Se a conta existir/i);
});

test('router de cliente bloqueia BARBER antes de consultar agendamentos globais', async (context) => {
    const originalSecret = process.env.JWT_SECRET;
    const originalFindById = User.findById;
    process.env.JWT_SECRET = 'test-tenant-isolation-secret';
    User.findById = async () => ({ _id: '507f191e810c19729de860ea', active: true, role: 'BARBER', authVersion: 0 });
    context.after(() => {
        User.findById = originalFindById;
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    });
    const token = jwt.sign({ role: 'BARBER', ver: 0 }, process.env.JWT_SECRET, {
        subject: '507f191e810c19729de860ea', expiresIn: '5m'
    });
    const server = app.listen(0);
    context.after(() => server.close());
    await new Promise((resolve) => server.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/appointments`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(response.status, 403);
});
