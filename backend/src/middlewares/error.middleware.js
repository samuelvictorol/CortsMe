function notFound(req, res) {
    return res.status(404).json({ message: 'Rota não encontrada.' });
}

function errorHandler(error, req, res, next) {
    if (res.headersSent) {
        return next(error);
    }

    console.error(error);

    if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) });
    }

    if (error.code === 11000) {
        return res.status(409).json({ message: 'Já existe um registro com estes dados.' });
    }

    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return res.status(400).json({ message: 'JSON inválido.' });
    }

    return res.status(500).json({ message: 'Erro interno do servidor.' });
}

module.exports = { notFound, errorHandler };
