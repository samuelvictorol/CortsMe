const router = require('express').Router();

router.use('/auth', require('./corts-auth.routes'));
router.use('/public', require('./public.routes'));
router.use('/appointments', require('./appointment.routes'));
router.use('/barber', require('./barber.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/media', require('./media.routes'));
router.use('/billing', require('./billing.routes'));
// Mantém as rotas de exemplo protegidas do inicializador original disponíveis.
router.use('/', require('./product.routes'));

module.exports = router;
