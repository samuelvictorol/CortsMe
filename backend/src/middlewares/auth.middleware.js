const JwtManager = require('../managers/jwt.manager');
const ManagerError = require('../errors/manager.error');
const AuthEnums = require('../enums/auth.enums');

function sendValidationError(res, errors) {
    return res.status(400).json({
        message: 'Dados da requisição inválidos.',
        errors
    });
}

function validateRegister(req, res, next) {
    const errors = [];

    if (typeof req.body?.name !== 'string') {
        errors.push({ field: 'name', message: 'O campo deve ser uma string.' });
    }
    if (typeof req.body?.email !== 'string') {
        errors.push({ field: 'email', message: 'O campo deve ser uma string.' });
    }
    if (typeof req.body?.password !== 'string') {
        errors.push({ field: 'password', message: 'O campo deve ser uma string.' });
    }

    return errors.length > 0 ? sendValidationError(res, errors) : next();
}

function validateLogin(req, res, next) {
    const errors = [];

    if (typeof req.body?.email !== 'string') {
        errors.push({ field: 'email', message: 'O campo deve ser uma string.' });
    }
    if (typeof req.body?.password !== 'string') {
        errors.push({ field: 'password', message: 'O campo deve ser uma string.' });
    }

    return errors.length > 0 ? sendValidationError(res, errors) : next();
}

function authenticate(req, res, next) {
    const authorization = req.get('authorization');
    const [scheme, token] = authorization?.split(' ') || [];

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
        return res.status(401).json({
            message: AuthEnums.AUTHENTICATION_REQUIRED,
            code: 'AUTHENTICATION_REQUIRED'
        });
    }

    try {
        const payload = JwtManager.verify(token);
        req.auth = { userId: payload.sub, email: payload.email };
        return next();
    } catch (error) {
        if (error instanceof ManagerError) {
            return res.status(error.statusCode).json({
                message: error.message,
                code: error.code
            });
        }

        return next(error);
    }
}

module.exports = { validateRegister, validateLogin, authenticate };
