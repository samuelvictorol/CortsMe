const jwt = require('jsonwebtoken');
const ManagerError = require('../errors/manager.error');
const AuthEnums = require('../enums/auth.enums');

class JwtManager {
    constructor({ secret, expiresIn } = {}) {
        this.secret = secret;
        this.expiresIn = expiresIn;
    }

    sign(user) {
        return jwt.sign(
            { email: user.email },
            this.#getSecret(),
            {
                subject: String(user._id),
                expiresIn: this.expiresIn || process.env.JWT_EXPIRES_IN || '1d'
            }
        );
    }

    verify(token) {
        const secret = this.#getSecret();

        try {
            return jwt.verify(token, secret);
        } catch (error) {
            throw new ManagerError(AuthEnums.INVALID_TOKEN, {
                statusCode: 401,
                code: 'INVALID_AUTH_TOKEN'
            });
        }
    }

    #getSecret() {
        const secret = this.secret || process.env.JWT_SECRET;

        if (!secret) {
            throw new Error('A variável JWT_SECRET não foi configurada.');
        }

        return secret;
    }
}

module.exports = new JwtManager();
module.exports.JwtManager = JwtManager;
