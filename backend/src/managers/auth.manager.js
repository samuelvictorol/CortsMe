const { User: UserModel } = require('../collections/User');
const PasswordManager = require('./password.manager');
const JwtManager = require('./jwt.manager');
const ManagerError = require('../errors/manager.error');
const AuthEnums = require('../enums/auth.enums');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
    const data = typeof user.toObject === 'function' ? user.toObject() : { ...user };
    delete data.password;
    return data;
}

class AuthManager {
    constructor({
        userModel = UserModel,
        passwordManager = PasswordManager,
        jwtManager = JwtManager
    } = {}) {
        this.userModel = userModel;
        this.passwordManager = passwordManager;
        this.jwtManager = jwtManager;
    }

    async register(payload) {
        const name = payload.name?.trim();
        const email = payload.email?.trim().toLowerCase();
        const password = payload.password;

        this.#validateCredentials({ name, email, password });

        if (await this.userModel.exists({ email })) {
            throw new ManagerError(AuthEnums.EMAIL_ALREADY_IN_USE, {
                statusCode: 409,
                code: 'EMAIL_ALREADY_IN_USE'
            });
        }

        const passwordHash = await this.passwordManager.hash(password);
        const user = new this.userModel({ name, email, password: passwordHash });

        try {
            await user.save();
        } catch (error) {
            if (error.code === 11000) {
                throw new ManagerError(AuthEnums.EMAIL_ALREADY_IN_USE, {
                    statusCode: 409,
                    code: 'EMAIL_ALREADY_IN_USE'
                });
            }
            throw error;
        }

        return {
            user: publicUser(user),
            token: this.jwtManager.sign(user)
        };
    }

    async login(payload) {
        const email = payload.email?.trim().toLowerCase();
        const password = payload.password;

        if (!email || !EMAIL_PATTERN.test(email) || typeof password !== 'string') {
            throw this.#invalidCredentialsError();
        }

        const query = this.userModel.findOne({ email });
        const user = typeof query.select === 'function'
            ? await query.select('+password')
            : await query;

        const passwordMatches = user
            ? await this.passwordManager.compare(password, user.password)
            : false;

        if (!passwordMatches) {
            throw this.#invalidCredentialsError();
        }

        return {
            user: publicUser(user),
            token: this.jwtManager.sign(user)
        };
    }

    async getAuthenticatedUser(userId) {
        const user = await this.userModel.findById(userId);

        if (!user) {
            throw new ManagerError(AuthEnums.USER_NOT_FOUND, {
                statusCode: 401,
                code: 'AUTHENTICATED_USER_NOT_FOUND'
            });
        }

        return publicUser(user);
    }

    #validateCredentials({ name, email, password }) {
        if (!name) {
            throw new ManagerError(AuthEnums.NAME_REQUIRED, {
                code: 'AUTH_NAME_REQUIRED'
            });
        }

        if (!email || !EMAIL_PATTERN.test(email)) {
            throw new ManagerError(AuthEnums.INVALID_EMAIL, {
                code: 'INVALID_AUTH_EMAIL'
            });
        }

        if (typeof password !== 'string' || password.length < 8) {
            throw new ManagerError(AuthEnums.PASSWORD_MIN_LENGTH, {
                code: 'AUTH_PASSWORD_TOO_SHORT'
            });
        }
    }

    #invalidCredentialsError() {
        return new ManagerError(AuthEnums.INVALID_CREDENTIALS, {
            statusCode: 401,
            code: 'INVALID_CREDENTIALS'
        });
    }
}

module.exports = new AuthManager();
module.exports.AuthManager = AuthManager;
