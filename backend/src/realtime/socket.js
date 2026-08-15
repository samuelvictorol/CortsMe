const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

function configureSocket(server) {
    const io = new Server(server, { cors: { origin: (process.env.CORS_ORIGIN || 'http://localhost:9000').split(','), credentials: true } });
    io.use((socket, next) => {
        try {
            const payload = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
            socket.auth = payload;
            next();
        } catch { next(new Error('unauthorized')); }
    });
    io.on('connection', (socket) => {
        socket.join(`user:${socket.auth.sub}`);
        if (socket.auth.role === 'BARBER') socket.join(`barber:${socket.auth.sub}`);
        if (socket.auth.role === 'ADMIN') socket.join('admin');
    });
    global.cortsmeIo = io;
    return io;
}

module.exports = { configureSocket };
