const jwt = require('jsonwebtoken');
const { User } = require('../collections/CortsmeModels');

async function optionalAuth(req, res, next) {
    try {
        const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
        if (!token) return next();
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.auth = { userId: payload.sub, role: payload.role };
        return next();
    } catch { return next(); }
}

async function requireAuth(req, res, next) {
    try {
        const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
        if (!token) return res.status(401).json({ message: 'Faça login para continuar.' });
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.sub);
        if (!user?.active) return res.status(401).json({ message: 'Sessão inválida.' });
        req.auth = { userId: String(user._id), role: user.role };
        req.user = user;
        next();
    } catch { res.status(401).json({ message: 'Sessão expirada ou inválida.' }); }
}

function allowRoles(...roles) {
    return (req, res, next) => roles.includes(req.auth?.role) ? next() : res.status(403).json({ message: 'Você não tem permissão para esta ação.' });
}

module.exports = { optionalAuth, requireAuth, allowRoles };
