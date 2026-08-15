const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeHandle, completeWebhookUrl, isIntegrationReady,
    normalizePlanPayload, calculateSubscriptionState,
    normalizeProviderEvent, paymentEventKey
} = require('../src/services/billing.service');
const app = require('../app');

test('normaliza InfiniteTag e completa a rota oficial do webhook', () => {
    assert.equal(normalizeHandle('  $AitoSoftwares '), 'aitosoftwares');
    assert.equal(
        completeWebhookUrl('https://exemplo.ngrok-free.app'),
        'https://exemplo.ngrok-free.app/api/billing/infinitepay/webhook'
    );
    assert.equal(
        completeWebhookUrl('https://exemplo.ngrok-free.app/api/billing/infinitepay/webhook'),
        'https://exemplo.ngrok-free.app/api/billing/infinitepay/webhook'
    );
});

test('só considera a InfinitePay pronta com handle válido e webhook HTTPS', () => {
    assert.equal(isIntegrationReady({ enabled: true, handle: '$aitosoftwares', webhookUrl: 'https://corts.ngrok.app' }), true);
    assert.equal(isIntegrationReady({ enabled: true, handle: 'ai', webhookUrl: 'https://corts.ngrok.app' }), false);
    assert.equal(isIntegrationReady({ enabled: true, handle: 'aitosoftwares', webhookUrl: 'http://localhost:3000' }), false);
});

test('plano gratuito preserva o site e bloqueia bot e confirmação online', () => {
    const plan = normalizePlanPayload({
        name: 'Gratuito', isFree: true, priceCents: 9999,
        entitlements: { onlineBooking: true, chatbot: true, publishedSite: false }
    });
    assert.equal(plan.priceCents, 0);
    assert.deepEqual(plan.entitlements, { onlineBooking: false, chatbot: false, publishedSite: true });
});

test('valida preço em centavos e duração dos planos pagos', () => {
    assert.throws(() => normalizePlanPayload({ name: 'Pro', priceCents: 0 }), /preço/i);
    assert.throws(() => normalizePlanPayload({ name: 'Pro', priceCents: 5000, durationDays: 0 }), /duração/i);
    assert.equal(normalizePlanPayload({ name: 'Pro', priceCents: 5990 }).priceCents, 5990);
});

test('calcula aviso regressivo em até sete dias e expiração sem apagar dados', () => {
    const now = new Date('2026-08-15T12:00:00.000Z');
    const plan = {
        _id: 'pro', name: 'Pro', slug: 'pro', priceCents: 5990,
        entitlements: { onlineBooking: true, chatbot: true, publishedSite: true }
    };
    const warning = calculateSubscriptionState({
        _id: 'sub', status: 'ACTIVE', plan, periodEnd: new Date(now.getTime() + 7 * 86400000)
    }, plan, now);
    assert.equal(warning.phase, 'WARNING');
    assert.equal(warning.daysRemaining, 7);
    assert.equal(warning.entitlements.onlineBooking, true);

    const expired = calculateSubscriptionState({
        _id: 'sub', status: 'ACTIVE', plan, periodEnd: new Date(now.getTime() - 1)
    }, plan, now);
    assert.equal(expired.status, 'EXPIRED');
    assert.equal(expired.entitlements.onlineBooking, false);
    assert.equal(expired.entitlements.publishedSite, true);
});

test('normaliza o webhook oficial e produz uma chave idempotente estável', () => {
    const event = normalizeProviderEvent({
        order_nsu: 'pedido-1', transaction_nsu: 'tx-1', invoice_slug: 'fatura-1', amount: 5990
    });
    assert.deepEqual(event, {
        orderNsu: 'pedido-1', transactionNsu: 'tx-1', invoiceSlug: 'fatura-1', amount: 5990
    });
    assert.equal(paymentEventKey('infinitepay', event.transactionNsu, event.orderNsu), 'INFINITEPAY:tx-1:pedido-1');
    assert.equal(paymentEventKey('INFINITEPAY', event.transactionNsu, event.orderNsu), 'INFINITEPAY:tx-1:pedido-1');
    assert.throws(() => normalizeProviderEvent({ order_nsu: 'pedido-1', amount: 5990 }), /Transação/i);
});

test('webhook inválido responde no contrato de retry da InfinitePay', async (context) => {
    const server = app.listen(0);
    context.after(() => server.close());
    await new Promise((resolve) => server.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/billing/infinitepay/webhook`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ order_nsu: 'pedido-sem-transacao' })
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.match(body.message, /Transação/i);
});
