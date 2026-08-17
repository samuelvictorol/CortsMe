const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const routesGlob = path
    .resolve(__dirname, '../routes/*.routes.js')
    .replace(/\\/g, '/');

const swaggerSpec = swaggerJsdoc({
    failOnErrors: true,
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'Express Mongo Initializer API',
            version: '1.0.0',
            description: 'API de exemplo com Express, MongoDB, managers, middlewares e JWT.'
        },
        servers: [
            {
                url: '/api',
                description: 'Servidor atual'
            }
        ],
        tags: [
            { name: 'Autenticação', description: 'Cadastro, login e sessão do usuário.' },
            { name: 'Produtos', description: 'Operações protegidas de produtos.' }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string', example: '64b7f1d24f1c2a0012345678' },
                        name: { type: 'string', example: 'Samuel Silva' },
                        email: { type: 'string', format: 'email', example: 'samuel@example.com' },
                        phone: { type: 'string', example: '61981748795' },
                        whatsappMetaPhone: { type: 'string', pattern: '^\\+55[1-9]\\d[1-9]\\d{7,8}$', example: '+556181748795' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                AuthRegister: {
                    type: 'object',
                    required: ['name', 'email', 'password'],
                    properties: {
                        name: { type: 'string', example: 'Samuel Silva' },
                        email: { type: 'string', format: 'email', example: 'samuel@example.com' },
                        phone: { type: 'string', example: '(61) 98174-8795' },
                        whatsappMetaPhone: { type: 'string', pattern: '^\\+55[1-9]\\d[1-9]\\d{7,8}$', example: '+556181748795' },
                        password: { type: 'string', format: 'password', minLength: 8, example: 'senha-segura' }
                    }
                },
                AuthLogin: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email', example: 'samuel@example.com' },
                        password: { type: 'string', format: 'password', example: 'senha-segura' }
                    }
                },
                AuthResponse: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                        user: { $ref: '#/components/schemas/User' },
                        token: { type: 'string', description: 'JWT usado no esquema Bearer.' }
                    }
                },
                Product: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string', example: '64b7f1d24f1c2a0012345678' },
                        name: { type: 'string', example: 'Teclado mecânico' },
                        price: { type: 'number', format: 'double', minimum: 0.01, example: 299.9 },
                        description: { type: 'string', maxLength: 500, example: 'Teclado ABNT2.' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                ProductCreate: {
                    type: 'object',
                    required: ['name', 'price'],
                    properties: {
                        name: { type: 'string', example: 'Teclado mecânico' },
                        price: { type: 'number', minimum: 0.01, example: 299.9 },
                        description: { type: 'string', maxLength: 500, example: 'Teclado ABNT2.' }
                    }
                },
                ProductUpdate: {
                    type: 'object',
                    minProperties: 1,
                    properties: {
                        name: { type: 'string', example: 'Teclado mecânico RGB' },
                        price: { type: 'number', minimum: 0.01, example: 349.9 },
                        description: { type: 'string', maxLength: 500 }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', example: 'Não foi possível processar a requisição.' },
                        code: { type: 'string', example: 'ERROR_CODE' }
                    }
                },
                ValidationError: {
                    allOf: [
                        { $ref: '#/components/schemas/Error' },
                        {
                            type: 'object',
                            properties: {
                                errors: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            field: { type: 'string' },
                                            message: { type: 'string' }
                                        }
                                    }
                                }
                            }
                        }
                    ]
                }
            },
            responses: {
                BadRequest: {
                    description: 'Contrato HTTP inválido.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ValidationError' }
                        }
                    }
                },
                Unauthorized: {
                    description: 'JWT ausente, inválido ou expirado.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' }
                        }
                    }
                },
                NotFound: {
                    description: 'Recurso não encontrado.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' }
                        }
                    }
                }
            }
        }
    },
    apis: [routesGlob]
});

module.exports = swaggerSpec;
