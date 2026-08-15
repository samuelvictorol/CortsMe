const AuthManager = require('../managers/auth.manager');
const AuthEnums = require('../enums/auth.enums');
const { handleControllerError } = require('./controller.helper');

const AuthController = {
    register: async (req, res) => {
        try {
            const result = await AuthManager.register(req.body);
            return res.status(201).json({ message: AuthEnums.USER_CREATED, ...result });
        } catch (error) {
            return handleControllerError(res, error);
        }
    },

    login: async (req, res) => {
        try {
            const result = await AuthManager.login(req.body);
            return res.status(200).json({ message: AuthEnums.LOGIN_SUCCESS, ...result });
        } catch (error) {
            return handleControllerError(res, error);
        }
    },

    me: async (req, res) => {
        try {
            const user = await AuthManager.getAuthenticatedUser(req.auth.userId);
            return res.status(200).json({ user });
        } catch (error) {
            return handleControllerError(res, error);
        }
    }
};

module.exports = AuthController;
