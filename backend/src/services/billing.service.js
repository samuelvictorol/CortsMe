const crypto = require('crypto');
const axios = require('axios');
const {
    BillingSettings, BillingPlan, Subscription, BillingPayment, BillingEvent,
    BarberProfile
} = require('../collections/CortsmeModels');
const { getRedis } = require('../config/redis.connection');
const { userView } = require('./user.service');

const INFINITEPAY_LINKS_URL = 'https://api.checkout.infinitepay.io/links';
const INFINITEPAY_CHECK_URL = 'https://api.checkout.infinitepay.io/payment_check';
const BILLING_WEBHOOK_PATH = '/api/billing/infinitepay/webhook';
const DEFAULT_NGROK_WEBHOOK_BASE = 'https://e35a-2804-7f3-ff03-c6e9-816e-a277-318c-8040.ngrok-free.app';
const DAY_MS = 24 * 60 * 60 * 1000;

function httpError(message, statusCode = 400, code = 'BILLING_ERROR', details) {
    return Object.assign(new Error(message), { statusCode, code, details });
}

function normalizeHandle(value) {
    return String(value || '').trim().toLowerCase().replace(/^[$@]+/, '').replace(/\s+/g, '');
}

function isValidHandle(value) {
    return /^[a-z0-9][a-z0-9._-]{1,48}[a-z0-9]$/.test(normalizeHandle(value));
}

function parseUrl(value, { httpsOnly = false, field = 'URL', allowEmpty = true } = {}) {
    const raw = String(value || '').trim();
    if (!raw && allowEmpty) return '';
    let parsed;
    try { parsed = new URL(raw); } catch { throw httpError(`${field} inválida.`); }
    if (!['http:', 'https:'].includes(parsed.protocol) || (httpsOnly && parsed.protocol !== 'https:')) {
        throw httpError(`${field} deve usar ${httpsOnly ? 'HTTPS' : 'HTTP ou HTTPS'}.`);
    }
    return parsed.toString().replace(/\/$/, '');
}

function completeWebhookUrl(value) {
    const normalized = parseUrl(value, { httpsOnly: true, field: 'URL do webhook' });
    if (!normalized) return '';
    const parsed = new URL(normalized);
    if (parsed.pathname === '/' || parsed.pathname === '') parsed.pathname = BILLING_WEBHOOK_PATH;
    return parsed.toString().replace(/\/$/, '');
}

function isIntegrationReady(settings) {
    if (!settings?.enabled || !isValidHandle(settings.handle)) return false;
    try {
        const webhook = completeWebhookUrl(settings.webhookUrl);
        return Boolean(webhook && !/seu-dominio|example\.com/i.test(webhook));
    } catch { return false; }
}

function settingsView(settings) {
    const raw = typeof settings?.toObject === 'function' ? settings.toObject() : (settings || {});
    return {
        id: raw._id ? String(raw._id) : undefined,
        provider: 'INFINITEPAY',
        handle: normalizeHandle(raw.handle),
        displayHandle: raw.handle ? `$${normalizeHandle(raw.handle)}` : '',
        webhookUrl: raw.webhookUrl || '',
        redirectBaseUrl: raw.redirectBaseUrl || '',
        enabled: raw.enabled !== false, updatedAt: raw.updatedAt || null,
        ready: isIntegrationReady(raw),
        requirements: {
            handle: isValidHandle(raw.handle),
            webhookHttps: (() => { try { return Boolean(completeWebhookUrl(raw.webhookUrl)); } catch { return false; } })()
        }
    };
}

function planView(plan) {
    const raw = typeof plan?.toObject === 'function' ? plan.toObject() : plan;
    if (!raw) return null;
    return {
        id: String(raw._id || raw.id), name: raw.name, slug: raw.slug, code: raw.slug,
        description: raw.description || '', priceCents: raw.priceCents,
        price: Number(raw.priceCents || 0) / 100, durationDays: raw.durationDays || 30,
        isFree: Boolean(raw.isFree), active: raw.active !== false,
        highlighted: Boolean(raw.highlighted), badge: raw.badge || '',
        displayOrder: raw.displayOrder || 0, features: raw.features || [],
        entitlements: {
            onlineBooking: raw.isFree ? false : raw.entitlements?.onlineBooking !== false,
            chatbot: raw.isFree ? false : raw.entitlements?.chatbot !== false,
            publishedSite: true
        }
    };
}

function slugifyPlan(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

function normalizePlanPayload(payload, existing = null) {
    const source = { ...(existing || {}), ...(payload || {}) };
    const name = String(source.name || '').trim().slice(0, 80);
    if (!name) throw httpError('Informe o nome do plano.');
    const slug = slugifyPlan(source.slug || name);
    if (!slug) throw httpError('Informe um identificador válido para o plano.');
    const isFree = Boolean(source.isFree);
    const priceCents = isFree ? 0 : Number(source.priceCents);
    if (!isFree && (!Number.isInteger(priceCents) || priceCents < 1)) {
        throw httpError('O preço do plano pago deve ser informado em centavos e ser maior que zero.');
    }
    const durationDays = Number(source.durationDays ?? 30);
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 366) {
        throw httpError('A duração deve estar entre 1 e 366 dias.');
    }
    const features = Array.isArray(source.features)
        ? source.features.map((item) => String(item).trim()).filter(Boolean).slice(0, 20)
        : [];
    const entitlements = {
        onlineBooking: isFree ? false : source.entitlements?.onlineBooking !== false,
        chatbot: isFree ? false : source.entitlements?.chatbot !== false,
        publishedSite: true
    };
    return {
        name, slug, description: String(source.description || '').trim().slice(0, 500),
        priceCents, durationDays, isFree, active: source.active !== false,
        highlighted: Boolean(source.highlighted), badge: String(source.badge || '').trim().slice(0, 30),
        displayOrder: Number.isFinite(Number(source.displayOrder)) ? Number(source.displayOrder) : 0,
        features, entitlements
    };
}

async function getBillingSettings() {
    const webhookEnv = process.env.INFINITEPAY_WEBHOOK_URL || DEFAULT_NGROK_WEBHOOK_BASE;
    const webhookUrl = webhookEnv ? completeWebhookUrl(webhookEnv) : '';
    const redirectBaseUrl = process.env.CHECKOUT_REDIRECT_URL
        || String(process.env.CORS_ORIGIN || '').split(',')[0].trim();
    return BillingSettings.findOneAndUpdate(
        { key: 'default' },
        {
            $setOnInsert: {
                key: 'default', handle: normalizeHandle(process.env.INFINITEPAY_HANDLE || 'aitosoftwares'),
                webhookUrl, redirectBaseUrl, enabled: true
            }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
}

async function updateBillingSettings(payload, adminId) {
    const current = await getBillingSettings();
    if (payload.handle !== undefined) {
        const handle = normalizeHandle(payload.handle);
        if (handle && !isValidHandle(handle)) throw httpError('InfiniteTag inválida. Use a identificação sem o símbolo $.');
        current.handle = handle;
    }
    if (payload.webhookUrl !== undefined) current.webhookUrl = completeWebhookUrl(payload.webhookUrl);
    if (payload.redirectBaseUrl !== undefined) {
        current.redirectBaseUrl = parseUrl(payload.redirectBaseUrl, { field: 'URL de retorno' });
    }
    if (payload.enabled !== undefined) current.enabled = Boolean(payload.enabled);
    current.updatedBy = adminId;
    await current.save();
    return current;
}

async function listPublicPlans() {
    const plans = await BillingPlan.find({ active: true }).sort({ displayOrder: 1, priceCents: 1 }).lean();
    return plans.map(planView);
}

async function ensureFreePlan() {
    let plan = await BillingPlan.findOne({ isFree: true });
    if (!plan) {
        try {
            plan = await BillingPlan.create(normalizePlanPayload({
                name: 'Gratuito', slug: 'gratuito', isFree: true, priceCents: 0,
                description: 'Site público e vitrine digital para começar.', displayOrder: 0,
                features: ['Site público publicado', 'Vitrine de serviços', 'Agenda e bot em modo demonstração']
            }));
        } catch (error) {
            if (error.code !== 11000) throw error;
            plan = await BillingPlan.findOne({ isFree: true });
        }
    }
    return plan;
}

async function ensureBillingSeed(demoProfile = null) {
    await getBillingSettings();
    await ensureFreePlan();
    const defaults = [
        {
            name: 'Essencial', slug: 'essencial', priceCents: 2990, durationDays: 30, displayOrder: 1,
            description: 'Agendamentos online e gestão profissional para começar a crescer.',
            features: ['Agendamento online', 'Agenda profissional', 'Site público'],
            entitlements: { onlineBooking: true, chatbot: false, publishedSite: true }
        },
        {
            name: 'Pro', slug: 'pro', priceCents: 5990, durationDays: 30, displayOrder: 2,
            highlighted: true, badge: 'Mais escolhido',
            description: 'Agenda e chatbot trabalhando juntos para converter mais clientes.',
            features: ['Tudo do Essencial', 'Chatbot de atendimento', 'Notificações em tempo real'],
            entitlements: { onlineBooking: true, chatbot: true, publishedSite: true }
        },
        {
            name: 'Premium', slug: 'premium', priceCents: 9990, durationDays: 30, displayOrder: 3,
            badge: 'Experiência completa',
            description: 'A experiência completa do CortsMe para negócios que querem escalar.',
            features: ['Tudo do Pro', 'Recursos premium futuros', 'Prioridade em novidades'],
            entitlements: { onlineBooking: true, chatbot: true, publishedSite: true }
        }
    ];
    for (const item of defaults) {
        if (!await BillingPlan.exists({ slug: item.slug })) await BillingPlan.create(normalizePlanPayload(item));
    }
    if (demoProfile) {
        const existing = await Subscription.findOne({ profile: demoProfile._id });
        if (!existing) {
            const premium = await BillingPlan.findOne({ slug: 'premium' });
            const now = new Date();
            await Subscription.create({
                profile: demoProfile._id, plan: premium._id, status: 'ACTIVE',
                periodStart: now, periodEnd: new Date(now.getTime() + 3650 * DAY_MS),
                note: 'Assinatura demonstrativa da Barbearia Premium.'
            });
        }
    }
}

async function ensureSubscription(profileId) {
    let subscription = await Subscription.findOne({ profile: profileId }).populate('plan');
    if (!subscription) {
        const freePlan = await ensureFreePlan();
        try {
            subscription = await Subscription.create({ profile: profileId, plan: freePlan._id, status: 'FREE' });
        } catch (error) {
            if (error.code !== 11000) throw error;
            subscription = await Subscription.findOne({ profile: profileId });
        }
        subscription = await Subscription.findById(subscription._id).populate('plan');
    }
    return subscription;
}

function calculateSubscriptionState(subscription, plan, now = new Date()) {
    const raw = typeof subscription?.toObject === 'function' ? subscription.toObject() : subscription;
    const selectedPlan = planView(plan || raw?.plan);
    const periodEnd = raw?.periodEnd ? new Date(raw.periodEnd) : null;
    const status = raw?.status || (selectedPlan?.isFree ? 'FREE' : 'EXPIRED');
    let normalizedStatus = status;
    if (selectedPlan?.isFree) normalizedStatus = 'FREE';
    else if (['ACTIVE', 'PENDING_PAYMENT'].includes(status) && (!periodEnd || periodEnd <= now)) normalizedStatus = 'EXPIRED';
    const active = normalizedStatus === 'ACTIVE' && periodEnd > now;
    const daysRemaining = active ? Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / DAY_MS)) : 0;
    const phase = selectedPlan?.isFree ? 'FREE'
        : active && daysRemaining <= 7 ? 'WARNING'
            : active ? 'ACTIVE'
                : normalizedStatus;
    const entitled = active;
    return {
        id: raw?._id ? String(raw._id) : undefined,
        status: normalizedStatus, phase, active, daysRemaining,
        periodStart: raw?.periodStart || null, periodEnd: raw?.periodEnd || null,
        expiresAt: raw?.periodEnd || null, plan: selectedPlan,
        entitlements: {
            onlineBooking: entitled && selectedPlan?.entitlements.onlineBooking === true,
            chatbot: entitled && selectedPlan?.entitlements.chatbot === true,
            publishedSite: true
        },
        banner: phase === 'WARNING'
            ? { type: 'warning', message: `Seu plano expira em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}.`, action: '/barber/financeiro' }
            : ['EXPIRED', 'SUSPENDED', 'CANCELLED'].includes(phase)
                ? { type: 'expired', message: 'Seu acesso premium está suspenso. Renove para liberar agendamentos e chatbot.', action: '/barber/financeiro' }
                : null
    };
}

async function getSubscriptionSummary(profileId, { persist = true, notify = false } = {}) {
    let subscription = await ensureSubscription(profileId);
    let summary = calculateSubscriptionState(subscription, subscription.plan);
    if (persist && summary.status !== subscription.status) {
        subscription.status = summary.status;
        await subscription.save();
        if (notify) await notifyBillingChanged(profileId, 'expired');
        subscription = await Subscription.findById(subscription._id).populate('plan');
        summary = calculateSubscriptionState(subscription, subscription.plan);
    }
    return summary;
}

async function invalidateProfileCache(profileId) {
    const profile = await BarberProfile.findById(profileId).select('slug').lean();
    if (profile?.slug) await getRedis()?.del(`cortsme:public:${profile.slug}`);
    return profile;
}

async function notifyBillingChanged(profileId, event = 'updated', suppliedSummary = null) {
    const profile = await BarberProfile.findById(profileId).select('owner slug').lean();
    if (!profile) return;
    if (profile.slug) await getRedis()?.del(`cortsme:public:${profile.slug}`);
    const summary = suppliedSummary || await getSubscriptionSummary(profileId, { persist: false });
    const payload = { event, billing: summary };
    const io = global.cortsmeIo;
    if (io) {
        io.to(`barber:${profile.owner}`).emit('billing:changed', payload);
        io.to('admin').emit('billing:changed', { ...payload, profileId: String(profileId) });
    }
}

async function assertOnlineBookingAllowed(profileId) {
    const billing = await getSubscriptionSummary(profileId, { notify: true });
    if (!billing.entitlements.onlineBooking) {
        throw httpError(
            'Agendamento online não disponível no plano gratuito ou com pagamento expirado. Avise a barbearia para liberar este recurso.',
            402,
            'BILLING_PLAN_REQUIRED',
            { locked: true, feature: 'onlineBooking', billing }
        );
    }
    return billing;
}

function lockedBotPayload(billing) {
    return {
        success: false, locked: true, code: 'BILLING_PLAN_REQUIRED',
        message: 'Chatbot não disponível no plano gratuito ou com pagamento expirado.',
        answer: 'O assistente virtual está em modo demonstração. A barbearia precisa ativar um plano para liberar esta conversa.',
        intent: 'billing_locked', action: { type: 'BILLING_REQUIRED', url: '/barber/financeiro' },
        billing
    };
}

function customerForInfinitePay(user) {
    const customer = userView(user);
    const phoneDigits = String(customer.phone || '').replace(/\D/g, '');
    const result = { name: customer.name };
    if (customer.email) result.email = customer.email;
    if (phoneDigits) result.phone_number = `+${phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`}`;
    return result;
}

function checkoutRedirect(baseUrl, orderNsu) {
    if (!baseUrl) return '';
    const parsed = new URL(baseUrl);
    parsed.searchParams.set('billing_return', '1');
    parsed.searchParams.set('order_nsu', orderNsu);
    return parsed.toString();
}

async function createCheckout({ profile, user, planId }) {
    const settings = await getBillingSettings();
    if (!isIntegrationReady(settings)) {
        throw httpError('Pagamentos ainda não foram configurados pelo administrador.', 503, 'BILLING_NOT_CONFIGURED');
    }
    const plan = await BillingPlan.findOne({ _id: planId, active: true });
    if (!plan) throw httpError('Plano não encontrado.', 404, 'BILLING_PLAN_NOT_FOUND');
    if (plan.isFree || plan.priceCents <= 0) throw httpError('O plano gratuito não exige pagamento.');
    const subscription = await ensureSubscription(profile._id);
    const reusable = await BillingPayment.findOne({
        profile: profile._id, plan: plan._id, status: 'PENDING', checkoutUrl: { $ne: '' }, expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });
    if (reusable) return { payment: reusable, checkoutUrl: reusable.checkoutUrl, reused: true };

    const orderNsu = `cortsme-${String(profile._id)}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const payment = await BillingPayment.create({
        profile: profile._id, subscription: subscription._id, plan: plan._id,
        orderNsu, amountCents: plan.priceCents, durationDays: plan.durationDays,
        planSnapshot: planView(plan), createdBy: user._id
    });
    const payload = {
        handle: normalizeHandle(settings.handle), order_nsu: orderNsu,
        webhook_url: completeWebhookUrl(settings.webhookUrl),
        items: [{ quantity: 1, price: plan.priceCents, description: `CortsMe — Plano ${plan.name} (${plan.durationDays} dias)` }],
        customer: customerForInfinitePay(user)
    };
    if (settings.redirectBaseUrl) payload.redirect_url = checkoutRedirect(settings.redirectBaseUrl, orderNsu);
    try {
        const response = await axios.post(INFINITEPAY_LINKS_URL, payload, { timeout: 12000 });
        const checkoutUrl = String(response.data?.url || '').trim();
        if (!/^https:\/\//i.test(checkoutUrl)) throw new Error('A InfinitePay não retornou uma URL de checkout válida.');
        payment.checkoutUrl = checkoutUrl;
        payment.providerPayload = { checkoutResponse: response.data, request: { ...payload, customer: undefined } };
        await payment.save();
        return { payment, checkoutUrl, reused: false };
    } catch (error) {
        payment.status = 'FAILED';
        payment.failureReason = String(error.response?.data?.message || error.message || 'Falha ao criar checkout').slice(0, 500);
        payment.providerPayload = { error: error.response?.data || null };
        await payment.save();
        throw httpError('Não foi possível criar o checkout da InfinitePay. Tente novamente.', 502, 'INFINITEPAY_CHECKOUT_ERROR');
    }
}

function normalizeProviderEvent(payload) {
    const orderNsu = String(payload?.order_nsu || payload?.orderNsu || '').trim();
    const transactionNsu = String(payload?.transaction_nsu || payload?.transactionNsu || '').trim();
    const invoiceSlug = String(payload?.invoice_slug || payload?.slug || '').trim();
    const amount = Number(payload?.amount);
    if (!orderNsu) throw httpError('Pedido não informado.', 400, 'INFINITEPAY_INVALID_EVENT');
    if (!transactionNsu) throw httpError('Transação não informada.', 400, 'INFINITEPAY_INVALID_EVENT');
    if (!invoiceSlug) throw httpError('Fatura não informada.', 400, 'INFINITEPAY_INVALID_EVENT');
    if (!Number.isInteger(amount) || amount <= 0) throw httpError('Valor do pagamento inválido.', 400, 'INFINITEPAY_INVALID_EVENT');
    return { orderNsu, transactionNsu, invoiceSlug, amount };
}

function paymentEventKey(provider, transactionNsu, orderNsu) {
    return `${String(provider || 'INFINITEPAY').toUpperCase()}:${String(transactionNsu).trim()}:${String(orderNsu).trim()}`;
}

async function activatePaidSubscription(payment) {
    let subscription = await Subscription.findById(payment.subscription).populate('plan');
    if (!subscription) throw httpError('Assinatura do pagamento não encontrada.', 400, 'BILLING_SUBSCRIPTION_NOT_FOUND');
    if (String(subscription.lastPayment || '') === String(payment._id)) {
        return getSubscriptionSummary(subscription.profile, { persist: false });
    }
    const plan = await BillingPlan.findById(payment.plan);
    if (!plan) throw httpError('Plano do pagamento não encontrado.', 400, 'BILLING_PLAN_NOT_FOUND');
    const now = new Date();
    const currentEnd = subscription.periodEnd ? new Date(subscription.periodEnd) : null;
    const base = subscription.status === 'ACTIVE' && currentEnd > now ? currentEnd : now;
    const periodEnd = new Date(base.getTime() + (payment.durationDays || plan.durationDays) * DAY_MS);
    await Subscription.updateOne(
        { _id: subscription._id, lastPayment: { $ne: payment._id } },
        {
            $set: {
                plan: plan._id, status: 'ACTIVE', periodStart: now, periodEnd,
                lastPayment: payment._id, note: ''
            }
        }
    );
    subscription = await Subscription.findById(subscription._id).populate('plan');
    const summary = calculateSubscriptionState(subscription, subscription.plan);
    await notifyBillingChanged(subscription.profile, 'payment_confirmed', summary);
    return summary;
}

async function claimEvent(eventKey, type, payload, paymentId, provider = 'INFINITEPAY') {
    try {
        return { event: await BillingEvent.create({ provider, eventKey, type, payload, payment: paymentId }), created: true };
    } catch (error) {
        if (error.code !== 11000) throw error;
        return { event: await BillingEvent.findOne({ eventKey }), created: false };
    }
}

async function confirmPayment(payload, { skipProviderCheck = false, provider = 'INFINITEPAY' } = {}) {
    const normalized = normalizeProviderEvent(payload);
    const payment = await BillingPayment.findOne({ orderNsu: normalized.orderNsu });
    if (!payment) throw httpError('Pedido não encontrado.', 400, 'INFINITEPAY_ORDER_NOT_FOUND');
    if (payment.amountCents !== normalized.amount) {
        throw httpError('O valor recebido não corresponde ao pedido.', 400, 'INFINITEPAY_AMOUNT_MISMATCH');
    }
    const duplicateTransaction = await BillingPayment.findOne({
        transactionNsu: normalized.transactionNsu, _id: { $ne: payment._id }
    }).select('_id');
    if (duplicateTransaction) throw httpError('Transação já vinculada a outro pedido.', 409, 'INFINITEPAY_TRANSACTION_REUSED');

    if (payment.status === 'PAID') {
        if (payment.transactionNsu !== normalized.transactionNsu) {
            throw httpError('Este pedido já foi pago por outra transação.', 409, 'INFINITEPAY_ORDER_ALREADY_PAID');
        }
        return { payment, billing: await activatePaidSubscription(payment), idempotent: true };
    }

    const eventKey = paymentEventKey(provider, normalized.transactionNsu, normalized.orderNsu);
    const { event } = await claimEvent(eventKey, skipProviderCheck ? 'PAYMENT_SIMULATED' : 'PAYMENT_WEBHOOK', payload, payment._id, provider);
    if (event?.status === 'PROCESSED' && payment.status === 'PAID') {
        return { payment, billing: await activatePaidSubscription(payment), idempotent: true };
    }

    let verification = payload;
    if (!skipProviderCheck) {
        const settings = await getBillingSettings();
        if (!isIntegrationReady(settings)) throw httpError('Integração InfinitePay indisponível.', 503, 'BILLING_NOT_CONFIGURED');
        try {
            const response = await axios.post(INFINITEPAY_CHECK_URL, {
                handle: normalizeHandle(settings.handle), order_nsu: normalized.orderNsu,
                transaction_nsu: normalized.transactionNsu, slug: normalized.invoiceSlug
            }, { timeout: 10000 });
            verification = response.data;
        } catch (error) {
            event.status = 'FAILED';
            event.result = { message: error.response?.data?.message || error.message };
            await event.save();
            throw httpError('Não foi possível confirmar o pagamento com a InfinitePay.', 400, 'INFINITEPAY_VERIFICATION_FAILED');
        }
        if (verification?.success !== true || verification?.paid !== true || Number(verification.amount) !== payment.amountCents) {
            event.status = 'REJECTED';
            event.result = verification;
            event.processedAt = new Date();
            await event.save();
            throw httpError('Pagamento ainda não confirmado pela InfinitePay.', 400, 'INFINITEPAY_PAYMENT_NOT_CONFIRMED');
        }
    }

    payment.status = 'PAID';
    payment.invoiceSlug = normalized.invoiceSlug;
    payment.transactionNsu = normalized.transactionNsu;
    payment.receiptUrl = String(payload.receipt_url || verification.receipt_url || '');
    payment.captureMethod = String(payload.capture_method || verification.capture_method || '');
    payment.paidAmountCents = Number(verification.paid_amount ?? payload.paid_amount ?? normalized.amount);
    payment.paidAt = payment.paidAt || new Date();
    payment.failureReason = '';
    payment.providerPayload = { webhook: payload, verification };
    try { await payment.save(); } catch (error) {
        if (error.code !== 11000) throw error;
        throw httpError('Transação já processada.', 409, 'INFINITEPAY_TRANSACTION_REUSED');
    }
    const billing = await activatePaidSubscription(payment);
    event.status = 'PROCESSED';
    event.result = { paid: true, paymentId: String(payment._id), periodEnd: billing.periodEnd };
    event.processedAt = new Date();
    await event.save();
    return { payment, billing, idempotent: false };
}

async function verifyPaymentReturn({ profileId, payload }) {
    const payment = await BillingPayment.findOne({ orderNsu: payload.order_nsu || payload.orderNsu, profile: profileId });
    if (!payment) throw httpError('Pagamento não encontrado.', 404, 'BILLING_PAYMENT_NOT_FOUND');
    return confirmPayment({
        order_nsu: payment.orderNsu,
        transaction_nsu: payload.transaction_nsu || payload.transactionNsu,
        invoice_slug: payload.invoice_slug || payload.slug,
        amount: payment.amountCents,
        receipt_url: payload.receipt_url,
        capture_method: payload.capture_method
    });
}

async function adjustSubscription(subscriptionId, payload, adminId) {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) throw httpError('Assinatura não encontrada.', 404);
    if (payload.planId) {
        const plan = await BillingPlan.findById(payload.planId);
        if (!plan) throw httpError('Plano não encontrado.', 404);
        subscription.plan = plan._id;
        if (plan.isFree) {
            subscription.status = 'FREE'; subscription.periodStart = null; subscription.periodEnd = null;
        }
    }
    if (payload.status !== undefined) {
        const statuses = ['FREE', 'PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'];
        if (!statuses.includes(payload.status)) throw httpError('Status de assinatura inválido.');
        subscription.status = payload.status;
    }
    if (payload.periodStart !== undefined) subscription.periodStart = payload.periodStart ? new Date(payload.periodStart) : null;
    if (payload.periodEnd !== undefined) subscription.periodEnd = payload.periodEnd ? new Date(payload.periodEnd) : null;
    if (subscription.status === 'ACTIVE' && (!subscription.periodEnd || Number.isNaN(subscription.periodEnd.getTime()))) {
        throw httpError('Uma assinatura ativa precisa de uma data final válida.');
    }
    subscription.note = payload.note !== undefined ? String(payload.note).slice(0, 500) : subscription.note;
    subscription.manuallyAdjustedBy = adminId;
    await subscription.save();
    const summary = await getSubscriptionSummary(subscription.profile);
    await notifyBillingChanged(subscription.profile, 'admin_adjusted', summary);
    return summary;
}

async function sweepExpiredSubscriptions() {
    const now = new Date();
    const expired = await Subscription.find({
        status: { $in: ['ACTIVE', 'PENDING_PAYMENT'] }, periodEnd: { $ne: null, $lte: now }
    }).select('_id profile');
    if (!expired.length) return 0;
    await Subscription.updateMany({ _id: { $in: expired.map((item) => item._id) } }, { $set: { status: 'EXPIRED' } });
    await Promise.all(expired.map((item) => notifyBillingChanged(item.profile, 'expired')));
    return expired.length;
}

function startBillingSweep(intervalMs = 15 * 60 * 1000) {
    const timer = setInterval(() => sweepExpiredSubscriptions().catch((error) => {
        console.warn(`Billing sweep: ${error.message}`);
    }), intervalMs);
    timer.unref?.();
    return timer;
}

module.exports = {
    INFINITEPAY_LINKS_URL, INFINITEPAY_CHECK_URL, BILLING_WEBHOOK_PATH,
    normalizeHandle, isValidHandle, completeWebhookUrl, isIntegrationReady, settingsView,
    planView, normalizePlanPayload, calculateSubscriptionState, getBillingSettings,
    updateBillingSettings, listPublicPlans, ensureFreePlan, ensureBillingSeed, ensureSubscription,
    getSubscriptionSummary, notifyBillingChanged, invalidateProfileCache,
    assertOnlineBookingAllowed, lockedBotPayload, createCheckout, confirmPayment,
    verifyPaymentReturn, adjustSubscription, sweepExpiredSubscriptions, startBillingSweep,
    normalizeProviderEvent, paymentEventKey
};
