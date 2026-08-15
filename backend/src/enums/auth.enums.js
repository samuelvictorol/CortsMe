const AuthEnums = {
    NAME_REQUIRED: 'O nome é obrigatório.',
    EMAIL_REQUIRED: 'O e-mail é obrigatório.',
    INVALID_EMAIL: 'Informe um e-mail válido.',
    PASSWORD_REQUIRED: 'A senha é obrigatória.',
    PASSWORD_MIN_LENGTH: 'A senha deve ter ao menos 8 caracteres.',
    EMAIL_ALREADY_IN_USE: 'Este e-mail já está cadastrado.',
    INVALID_CREDENTIALS: 'E-mail ou senha inválidos.',
    AUTHENTICATION_REQUIRED: 'Autenticação necessária.',
    INVALID_TOKEN: 'Token inválido ou expirado.',
    USER_NOT_FOUND: 'Usuário autenticado não foi encontrado.',
    USER_CREATED: 'Usuário criado com sucesso.',
    LOGIN_SUCCESS: 'Login realizado com sucesso.'
};

module.exports = AuthEnums;
