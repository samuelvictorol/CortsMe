const router = require('express').Router();
const { requireAuth, allowRoles } = require('../middlewares/corts-auth.middleware');
const { asyncRoute } = require('./route.helpers');
const { userView } = require('../services/user.service');
const {
    parseAvatarUpload,
    saveAvatarUpload,
    setAvatarUrl,
    avatarPublicUrl
} = require('../services/avatar.service');

const adminOnly = [requireAuth, allowRoles('ADMIN')];

router.post('/:id/avatar', ...adminOnly, parseAvatarUpload, asyncRoute(async (req, res) => {
    const user = await saveAvatarUpload(req.params.id, req.file);
    res.status(201).json({ user: userView(user), url: avatarPublicUrl(user), source: 'upload' });
}));

router.put('/:id/avatar', ...adminOnly, asyncRoute(async (req, res) => {
    const user = await setAvatarUrl(req.params.id, req.body?.url);
    res.json({ user: userView(user), url: avatarPublicUrl(user), source: user.avatar ? 'url' : '' });
}));

router.delete('/:id/avatar', ...adminOnly, asyncRoute(async (req, res) => {
    const user = await setAvatarUrl(req.params.id, '');
    res.json({ user: userView(user), url: '', source: '' });
}));

module.exports = router;
