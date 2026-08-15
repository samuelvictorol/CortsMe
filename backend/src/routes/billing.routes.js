const router = require('express').Router();
const { getBillingSettings, settingsView, listPublicPlans, confirmPayment } = require('../services/billing.service');
const { asyncRoute } = require('./route.helpers');

router.get('/public', asyncRoute(async (req, res) => {
    const settings = settingsView(await getBillingSettings());
    res.json({
        provider: 'INFINITEPAY', providerConfigured: settings.ready, config: settings,
        plans: await listPublicPlans()
    });
}));

router.get('/plans', asyncRoute(async (req, res) => {
    const settings = settingsView(await getBillingSettings());
    res.json({ providerConfigured: settings.ready, config: settings, plans: await listPublicPlans() });
}));

// A InfinitePay não assina o webhook. O evento só libera acesso depois da
// confirmação server-to-server em /payment_check e da validação de valor/NSUs.
router.post('/infinitepay/webhook', async (req, res) => {
    try {
        const result = await confirmPayment(req.body);
        return res.status(200).json({
            success: true, message: null, idempotent: result.idempotent,
            paymentId: String(result.payment._id), billing: result.billing
        });
    } catch (error) {
        // A InfinitePay repete a entrega quando recebe 400.
        console.warn(`Webhook InfinitePay rejeitado: ${error.message}`);
        return res.status(400).json({ success: false, message: error.message || 'Não foi possível processar o pagamento.' });
    }
});

module.exports = router;
