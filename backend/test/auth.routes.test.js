const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../app');

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
