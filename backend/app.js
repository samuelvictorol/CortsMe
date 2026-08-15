const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const router = require('./src/routes/router');
const { notFound, errorHandler } = require('./src/middlewares/error.middleware');
const swaggerSpec = require('./src/config/swagger.config');

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:9000').split(','), credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7' }));
app.use('/api/public', rateLimit({ windowMs: 60 * 1000, limit: 180, standardHeaders: 'draft-7' }));
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'cortsme-api', timestamp: new Date().toISOString() }));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: {
        persistAuthorization: true
    }
}));
app.use('/api', router);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
