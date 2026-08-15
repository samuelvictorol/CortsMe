const ManagerError = require('../errors/manager.error');

function handleControllerError(res, error) {
    if (error instanceof ManagerError) {
        return res.status(error.statusCode).json({
            message: error.message,
            code: error.code,
            ...(error.details && { details: error.details })
        });
    }

    if (error.name === 'ValidationError') {
        return res.status(422).json({
            message: 'Não foi possível validar os dados.',
            errors: Object.values(error.errors).map(({ path, message }) => ({
                field: path,
                message
            }))
        });
    }

    console.error(error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
}

module.exports = { handleControllerError };
