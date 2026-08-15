class ManagerError extends Error {
    constructor(message, { statusCode = 422, code = 'BUSINESS_RULE_ERROR', details } = {}) {
        super(message);
        this.name = 'ManagerError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

module.exports = ManagerError;
