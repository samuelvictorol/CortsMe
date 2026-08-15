const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../app');
const swaggerSpec = require('../src/config/swagger.config');

test('gera uma especificação OpenAPI com todos os endpoints', () => {
    assert.equal(swaggerSpec.openapi, '3.0.3');
    assert.deepEqual(Object.keys(swaggerSpec.paths).sort(), [
        '/auth/login',
        '/auth/me',
        '/auth/register',
        '/auth/register-professional',
        '/product/create',
        '/product/delete/{id}',
        '/product/search',
        '/product/update/{id}'
    ]);
    assert.equal(
        swaggerSpec.components.securitySchemes.bearerAuth.scheme,
        'bearer'
    );
});

test('publica a especificação OpenAPI em JSON', async (context) => {
    const server = app.listen(0);
    context.after(() => server.close());

    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api-docs.json`);
    const specification = await response.json();

    assert.equal(response.status, 200);
    assert.equal(specification.info.title, 'Express Mongo Initializer API');
});

test('publica a interface Swagger UI', async (context) => {
    const server = app.listen(0);
    context.after(() => server.close());

    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api-docs/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Swagger UI/);
});
