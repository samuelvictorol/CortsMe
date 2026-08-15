const test = require('node:test');
const assert = require('node:assert/strict');

const { AuthManager } = require('../src/managers/auth.manager');
const ManagerError = require('../src/errors/manager.error');

test('cadastro normaliza usuário e delega senha e token aos managers', async () => {
    const calls = [];

    class UserModel {
        static async exists() {
            return false;
        }

        constructor(data) {
            Object.assign(this, data);
            this._id = 'user-1';
        }

        async save() {
            return this;
        }

        toObject() {
            return { ...this };
        }
    }

    const manager = new AuthManager({
        userModel: UserModel,
        passwordManager: {
            async hash(password) {
                calls.push(['hash', password]);
                return 'senha-com-hash';
            }
        },
        jwtManager: {
            sign(user) {
                calls.push(['sign', user._id]);
                return 'jwt-assinado';
            }
        }
    });

    const result = await manager.register({
        name: '  Samuel  ',
        email: '  USER@EXAMPLE.COM ',
        password: '12345678'
    });

    assert.deepEqual(calls, [['hash', '12345678'], ['sign', 'user-1']]);
    assert.equal(result.user.name, 'Samuel');
    assert.equal(result.user.email, 'user@example.com');
    assert.equal(result.user.password, undefined);
    assert.equal(result.token, 'jwt-assinado');
});

test('login não informa se foi o e-mail ou a senha que falhou', async () => {
    const manager = new AuthManager({
        userModel: { findOne: async () => null },
        passwordManager: { compare: async () => false },
        jwtManager: {}
    });

    await assert.rejects(
        () => manager.login({ email: 'missing@example.com', password: '12345678' }),
        (error) => error instanceof ManagerError
            && error.statusCode === 401
            && error.code === 'INVALID_CREDENTIALS'
    );
});
