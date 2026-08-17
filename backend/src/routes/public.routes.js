const router = require('express').Router();
const { BarberProfile, BotLog, Appointment, BillingPayment, User } = require('../collections/CortsmeModels');
const { getRedis } = require('../config/redis.connection');
const { optionalAuth } = require('../middlewares/corts-auth.middleware');
const { availableSlots } = require('../services/appointment.service');
const { asyncRoute } = require('./route.helpers');
const {
    getSubscriptionSummary, lockedBotPayload, listPublicPlans, createCheckout
} = require('../services/billing.service');
const { verifySecureLink, consumeSecureLink } = require('../services/secure-link.service');
const { appendAppointmentHistory } = require('../services/appointment-history.service');
const { notifyAppointment } = require('../services/appointment.service');
const { cancelAppointmentReminders } = require('../services/notification.service');

function publicPayment(payment) {
    if (!payment) return null;
    return {
        id: String(payment._id), orderNsu: payment.orderNsu,
        amountCents: payment.amountCents, status: payment.status,
        paidAt: payment.paidAt, receiptUrl: payment.receiptUrl,
        plan: payment.plan && typeof payment.plan === 'object'
            ? { id: String(payment.plan._id), name: payment.plan.name, slug: payment.plan.slug }
            : payment.plan
    };
}

function publicBarberProfile(profile) {
    return {
        _id: String(profile._id), id: String(profile._id),
        businessName: profile.businessName, slug: profile.slug,
        description: profile.description || '', address: profile.address || '',
        whatsapp: profile.whatsapp || '', showcaseVersion: Number(profile.showcaseVersion || 0),
        services: profile.services || [], businessHours: profile.businessHours || [],
        site: profile.site || {}, bot: profile.bot || {}
    };
}

router.get('/appointment-actions/:token', asyncRoute(async (req, res) => {
    const { record } = await verifySecureLink(req.params.token, 'APPOINTMENT_ACTION');
    const appointment = await Appointment.findOne({ _id: record.appointment, profile: record.profile })
        .populate('profile', 'businessName slug address').lean();
    if (!appointment) return res.status(410).json({ message: 'Este agendamento não está mais disponível.' });
    res.json({
        appointment: {
            id: String(appointment._id), serviceName: appointment.serviceName,
            start: appointment.start, end: appointment.end, status: appointment.status,
            business: appointment.profile
        },
        actions: {
            canConfirm: ['PENDING', 'CONFIRMED'].includes(appointment.status) && new Date(appointment.start) > new Date(),
            canCancel: !['CANCELLED', 'COMPLETED'].includes(appointment.status) && new Date(appointment.start) > new Date()
        },
        expiresAt: record.expiresAt
    });
}));

router.post('/appointment-actions/:token', asyncRoute(async (req, res) => {
    const action = String(req.body?.action || '').toLowerCase();
    if (!['confirm', 'cancel'].includes(action)) return res.status(400).json({ message: 'Ação inválida.' });
    const { record } = await verifySecureLink(req.params.token, 'APPOINTMENT_ACTION');
    const appointment = await Appointment.findOne({ _id: record.appointment, profile: record.profile });
    if (!appointment || appointment.start <= new Date() || appointment.status === 'COMPLETED') {
        return res.status(409).json({ message: 'Este agendamento não pode mais ser alterado.' });
    }
    if (appointment.status === 'CANCELLED') return res.status(409).json({ message: 'Este agendamento já foi cancelado.' });
    await consumeSecureLink(record);
    const before = appointment.toObject();
    appointment.status = action === 'cancel' ? 'CANCELLED' : 'CONFIRMED';
    appendAppointmentHistory(appointment, before, record.user || null);
    await appointment.save();
    if (appointment.status === 'CANCELLED') await cancelAppointmentReminders(appointment.profile, appointment._id);
    const profile = await BarberProfile.findById(appointment.profile);
    await notifyAppointment(profile, appointment.toObject(), 'updated');
    res.json({ success: true, status: appointment.status, message: action === 'cancel' ? 'Agendamento cancelado.' : 'Agendamento confirmado.' });
}));

router.get('/finance/:token', asyncRoute(async (req, res) => {
    const { record } = await verifySecureLink(req.params.token, 'FINANCE_ACCESS');
    const profile = await BarberProfile.findOne({ _id: record.profile, owner: record.user }).select('businessName slug owner').lean();
    if (!profile) return res.status(410).json({ message: 'Este acesso financeiro não está mais disponível.' });
    const [billing, lastPayment, plans] = await Promise.all([
        getSubscriptionSummary(profile._id, { notify: false }),
        BillingPayment.findOne({ profile: profile._id, status: 'PAID' }).populate('plan', 'name slug').sort({ paidAt: -1 }).lean(),
        listPublicPlans()
    ]);
    res.json({
        profile: { id: String(profile._id), businessName: profile.businessName, slug: profile.slug },
        billing, subscription: billing,
        lastPayment: publicPayment(lastPayment),
        plans: plans.filter((plan) => !plan.isFree && plan.active),
        expiresAt: record.expiresAt
    });
}));

router.post('/finance/:token/checkout', asyncRoute(async (req, res) => {
    const { record } = await verifySecureLink(req.params.token, 'FINANCE_ACCESS');
    const profile = await BarberProfile.findOne({ _id: record.profile, owner: record.user });
    if (!profile) return res.status(410).json({ message: 'Este acesso financeiro não está mais disponível.' });
    const owner = await User.findOne({ _id: record.user, role: 'BARBER', active: true });
    if (!owner) return res.status(410).json({ message: 'Conta profissional indisponível.' });
    const result = await createCheckout({ profile, user: owner, planId: req.body?.planId });
    res.status(result.reused ? 200 : 201).json({
        checkoutUrl: result.checkoutUrl, reused: result.reused,
        payment: publicPayment(result.payment)
    });
}));

router.get('/barbers/:slug', asyncRoute(async (req, res) => {
    const cacheKey = `cortsme:public:v2:${req.params.slug}`;
    const cached = await getRedis()?.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));
    const profile = await BarberProfile.findOne({ slug: req.params.slug, active: true, published: true }).lean();
    if (!profile) return res.status(404).json({ message: 'Este site não está publicado.' });
    const billing = await getSubscriptionSummary(profile._id, { notify: true });
    const result = { profile: publicBarberProfile(profile), billing, plan: billing.plan, entitlements: billing.entitlements };
    await getRedis()?.set(cacheKey, JSON.stringify(result), 'EX', 120);
    res.json(result);
}));

router.get('/barbers/:slug/availability', asyncRoute(async (req, res) => {
    const profile = await BarberProfile.findOne({ slug: req.params.slug, active: true, published: true });
    if (!profile) return res.status(404).json({ message: 'Barbearia não encontrada.' });
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const slots = await availableSlots(profile, date, Math.max(10, Number(req.query.duration) || 30));
    res.json({ date, slots });
}));

router.post('/barbers/:slug/bot', optionalAuth, asyncRoute(async (req, res) => {
    const profile = await BarberProfile.findOne({ slug: req.params.slug, active: true, published: true });
    if (!profile || !profile.bot.enabled) return res.status(404).json({ message: 'Assistente indisponível.' });
    const message = String(req.body.message || '').trim().slice(0, 600);
    if (!message) return res.status(400).json({ message: 'Escreva uma mensagem.' });
    const billing = await getSubscriptionSummary(profile._id, { notify: true });
    if (!billing.entitlements.chatbot) {
        const locked = lockedBotPayload(billing);
        await BotLog.create({
            profile: profile._id, user: req.auth?.userId || null, sessionId: req.body.sessionId,
            message, response: locked.answer, intent: 'billing_locked'
        });
        return res.status(402).json(locked);
    }
    const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    let intent = 'question';
    let answer = `Eu sou o assistente exclusivo da ${profile.businessName}. ${profile.bot.relevantInfo || 'Posso ajudar com serviços, horários, localização e agendamento.'}`;
    let action = null;
    if (/agend|marcar|horario|dispon/.test(normalized)) {
        intent = 'booking';
        answer = req.auth
            ? 'Perfeito. Vou levar você à agenda com os horários livres em tempo real. Escolha o serviço e o melhor horário.'
            : 'Para reservar um horário com segurança, entre na sua conta. Depois você volta direto para a agenda.';
        action = { type: req.auth ? 'OPEN_BOOKING' : 'LOGIN', url: req.auth ? `/${profile.slug}/agendar` : `/login?redirect=/${profile.slug}/agendar` };
    } else if (/servic|corte|barba|preco|valor/.test(normalized)) {
        intent = 'services';
        answer = profile.services.filter((service) => service.active).map((service) => `${service.name} — R$ ${service.price.toFixed(2).replace('.', ',')} · ${service.duration} min`).join('\n') || 'Os serviços estão sendo atualizados.';
    } else if (/onde|endereco|local|chegar/.test(normalized)) {
        intent = 'location';
        answer = profile.address ? `Estamos em ${profile.address}. Quer agendar antes de vir?` : 'Nosso endereço será atualizado em breve.';
        const map = profile.site?.locationMap;
        if (map?.botEnabled && map.embedUrl) action = { type: 'SHOW_MAP', url: map.embedUrl, title: map.title || 'Como chegar' };
    } else {
        const faq = profile.bot.faqs.find((item) => normalized.includes(String(item.question).toLowerCase()));
        if (faq) { intent = 'faq'; answer = faq.answer; }
    }
    await BotLog.create({ profile: profile._id, user: req.auth?.userId || null, sessionId: req.body.sessionId, message, response: answer, intent });
    res.json({ answer, intent, action, suggestions: profile.bot.menuOptions.slice(0, 4) });
}));

module.exports = router;
