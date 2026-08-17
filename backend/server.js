require('dotenv').config();

const http = require('http');
const app = require('./app');
const mongoConn = require('./src/config/mongo.connection');
const { connectRedis } = require('./src/config/redis.connection');
const { configureSocket } = require('./src/realtime/socket');
const { ensureSystemData } = require('./src/services/bootstrap.service');

async function startServer() {
    try {
        await mongoConn();
        await connectRedis();
        await ensureSystemData();
        const server = http.createServer(app);
        await configureSocket(server);
        server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
            console.log(`CortsMe API online: ${process.env.PORT || 3000}`);
        });
    } catch (error) {
        console.error(`Não foi possível iniciar o servidor: ${error.message}`);
        process.exitCode = 1;
    }
}

startServer();
