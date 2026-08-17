const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');
const { User, BarberProfile } = require('../collections/CortsmeModels');
const { getRedis } = require('../config/redis.connection');

async function configureSocket(server) {
    const io = new Server(server, { cors: { origin: (process.env.CORS_ORIGIN || 'http://localhost:9000').split(','), credentials: true } });
    const pubClient = getRedis();
    if (pubClient) {
        const subClient = pubClient.duplicate({ lazyConnect: true });
        await subClient.connect();
        io.adapter(createAdapter(pubClient, subClient));
    }
    io.use(async (socket, next) => {
        try {
            const payload = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
            const user = await User.findById(payload.sub).select('role active authVersion');
            if (!user?.active || Number(payload.ver || 0) !== Number(user.authVersion || 0)) return next(new Error('unauthorized'));
            socket.auth = { sub: String(user._id), role: user.role };
            if (user.role === 'BARBER') {
                const profile = await BarberProfile.findOne({ owner: user._id }).select('_id').lean();
                socket.auth.profileId = profile ? String(profile._id) : null;
            }
            next();
        } catch { next(new Error('unauthorized')); }
    });
    io.on('connection', (socket) => {
        socket.join(`user:${socket.auth.sub}`);
        if (socket.auth.role === 'BARBER') {
            socket.join(`barber:${socket.auth.sub}`);
            if (socket.auth.profileId) socket.join(`profile:${socket.auth.profileId}`);
        }
        if (socket.auth.role === 'ADMIN') socket.join('admin');
    });
    global.cortsmeIo = io;
    return io;
}

function disconnectUserSockets(userId) {
    const io = global.cortsmeIo;
    if (!io || !userId) return false;
    io.in(`user:${String(userId)}`).disconnectSockets(true);
    return true;
}

module.exports = { configureSocket, disconnectUserSockets };
