const test = require('node:test');
const assert = require('node:assert/strict');

const { JwtManager } = require('../src/managers/jwt.manager');
const ManagerError = require('../src/errors/manager.error');

test('assina e valida um JWT com o usuário no subject', () => {
    const manager = new JwtManager({ secret: 'segredo-seguro-para-testes', expiresIn: '1h' });
    const token = manager.sign({ _id: 'user-123', email: 'user@example.com' });
    const payload = manager.verify(token);

    assert.equal(payload.sub, 'user-123');
    assert.equal(payload.email, 'user@example.com');
});

test('rejeita JWT inválido sem expor detalhes internos', () => {
    const manager = new JwtManager({ secret: 'segredo-seguro-para-testes' });

    assert.throws(
        () => manager.verify('token-invalido'),
        (error) => error instanceof ManagerError
            && error.statusCode === 401
            && error.code === 'INVALID_AUTH_TOKEN'
    );
});
