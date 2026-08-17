const router = require('express').Router();
const mongoose = require('mongoose');
const { User, Media } = require('../collections/CortsmeModels');
const { asyncRoute } = require('./route.helpers');

function sendMedia(req, res, media, immutable = true) {
    if (!media) return res.status(404).json({ message: 'Imagem não encontrada.' });
    const etag = media.sha256 ? `"${media.sha256}"` : '';
    if (etag && req.headers['if-none-match'] === etag) return res.status(304).end();
    res.set({
        'Content-Type': media.mimeType,
        'Content-Length': media.size,
        'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        ...(etag ? { ETag: etag } : {})
    });
    return res.send(media.data);
}

router.get('/avatar/:userId', asyncRoute(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({ message: 'Imagem não encontrada.' });
    const user = await User.findById(req.params.userId).select('avatarMedia').lean();
    if (!user?.avatarMedia) return res.status(404).json({ message: 'Imagem não encontrada.' });
    const media = await Media.findOne({
        _id: user.avatarMedia,
        owner: req.params.userId,
        kind: { $in: ['avatar', 'general'] }
    }).select('mimeType size sha256 data');
    return sendMedia(req, res, media, Boolean(req.query.v));
}));

router.get('/:id', asyncRoute(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Imagem não encontrada.' });
    const media = await Media.findById(req.params.id);
    return sendMedia(req, res, media, true);
}));

module.exports = router;
