const mongoose = require('mongoose');

function sendValidationError(res, errors) {
    return res.status(400).json({
        message: 'Dados da requisição inválidos.',
        errors
    });
}

function validateCreate(req, res, next) {
    const errors = [];

    if (typeof req.body?.name !== 'string') {
        errors.push({ field: 'name', message: 'O campo deve ser uma string.' });
    }

    if (!['number', 'string'].includes(typeof req.body?.price)) {
        errors.push({ field: 'price', message: 'O campo deve ser um número.' });
    }

    if (req.body?.description !== undefined && typeof req.body.description !== 'string') {
        errors.push({ field: 'description', message: 'O campo deve ser uma string.' });
    }

    return errors.length > 0 ? sendValidationError(res, errors) : next();
}

function validateUpdate(req, res, next) {
    const allowedFields = ['name', 'price', 'description'];
    const receivedFields = Object.keys(req.body || {}).filter((field) => allowedFields.includes(field));
    const errors = [];

    if (receivedFields.length === 0) {
        errors.push({ field: 'body', message: 'Informe ao menos um campo para atualização.' });
    }

    if (req.body?.name !== undefined && typeof req.body.name !== 'string') {
        errors.push({ field: 'name', message: 'O campo deve ser uma string.' });
    }

    if (req.body?.price !== undefined && !['number', 'string'].includes(typeof req.body.price)) {
        errors.push({ field: 'price', message: 'O campo deve ser um número.' });
    }

    if (req.body?.description !== undefined && typeof req.body.description !== 'string') {
        errors.push({ field: 'description', message: 'O campo deve ser uma string.' });
    }

    return errors.length > 0 ? sendValidationError(res, errors) : next();
}

function validateSearch(req, res, next) {
    if (req.query.name !== undefined && typeof req.query.name !== 'string') {
        return sendValidationError(res, [
            { field: 'name', message: 'O parâmetro deve ser uma string.' }
        ]);
    }

    return next();
}

function validateId(req, res, next) {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
        return sendValidationError(res, [
            { field: 'id', message: 'O identificador informado é inválido.' }
        ]);
    }

    return next();
}

module.exports = {
    validateCreate,
    validateUpdate,
    validateSearch,
    validateId
};
