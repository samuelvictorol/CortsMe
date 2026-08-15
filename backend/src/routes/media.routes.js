const router = require('express').Router();
const { Media } = require('../collections/CortsmeModels');
const { asyncRoute } = require('./route.helpers');

router.get('/:id', asyncRoute(async (req, res) => {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ message: 'Imagem não encontrada.' });
    res.set({ 'Content-Type': media.mimeType, 'Content-Length': media.size, 'Cache-Control': 'public, max-age=31536000, immutable' });
    res.send(media.data);
}));

module.exports = router;
