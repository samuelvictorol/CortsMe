const router = require('express').Router();
const multer = require('multer');
const { BarberProfile, Appointment, BotLog, Media, User, BillingPayment } = require('../collections/CortsmeModels');
const { requireAuth, allowRoles } = require('../middlewares/corts-auth.middleware');
const { uniqueSlug } = require('../services/profile.service');
const { assertAvailable, notifyAppointment } = require('../services/appointment.service');
const { userView } = require('../services/user.service');
const { getRedis } = require('../config/redis.connection');
const { normalizeMapEmbed } = require('../services/embed.service');
const { appendAppointmentHistory, markAppointmentCreated } = require('../services/appointment-history.service');
const { customersForProfile, customerSummary } = require('../services/customer.service');
const { asyncRoute, pageOptions, paged } = require('./route.helpers');
const {
    getBillingSettings, settingsView, listPublicPlans, getSubscriptionSummary,
    createCheckout, verifyPaymentReturn
} = require('../services/billing.service');
const {
    reminderSettings, scheduleAppointmentReminders, cancelAppointmentReminders, revokeAppointmentLinks,
    enqueueBarberAppointmentCreated
} = require('../services/notification.service');
const { normalizeWebhookUrl } = require('../services/webhook.service');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 6 * 1024 * 1024 },
    fileFilter: (req, file, callback) => callback(file.mimetype.startsWith('image/') ? null : new Error('Envie apenas imagens.'), file.mimetype.startsWith('image/'))
});

router.use(requireAuth, allowRoles('BARBER'));

async function ownProfile(userId) {
    const profile = await BarberProfile.findOne({ owner: userId });
    if (!profile) throw Object.assign(new Error('Perfil profissional não encontrado.'), { statusCode: 404 });
    return profile;
}

function paymentView(payment) {
    const raw = typeof payment.toObject === 'function' ? payment.toObject() : payment;
    return {
        id: String(raw._id), orderNsu: raw.orderNsu, amountCents: raw.amountCents, durationDays: raw.durationDays,
        status: raw.status, checkoutUrl: raw.checkoutUrl, invoiceSlug: raw.invoiceSlug,
        transactionNsu: raw.transactionNsu, receiptUrl: raw.receiptUrl,
        captureMethod: raw.captureMethod, paidAt: raw.paidAt, expiresAt: raw.expiresAt,
        createdAt: raw.createdAt,
        plan: raw.plan && typeof raw.plan === 'object'
            ? { id: String(raw.plan._id), name: raw.plan.name, slug: raw.plan.slug }
            : raw.plan
    };
}

router.get('/dashboard', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const month = new Date(today.getFullYear(), today.getMonth(), 1);
    const [todayCount, nextAppointments, monthItems, botInteractions] = await Promise.all([
        Appointment.countDocuments({ profile: profile._id, start: { $gte: today, $lt: new Date(today.getTime() + 86400000) }, status: { $ne: 'CANCELLED' } }),
        Appointment.find({ profile: profile._id, start: { $gte: new Date() }, status: { $nin: ['CANCELLED', 'COMPLETED'] } }).sort({ start: 1 }).limit(5).populate('user').lean(),
        Appointment.find({ profile: profile._id, start: { $gte: month }, status: { $ne: 'CANCELLED' } }).select('price').lean(),
        BotLog.countDocuments({ profile: profile._id, createdAt: { $gte: month } })
    ]);
    const revenue = monthItems.reduce((sum, item) => sum + item.price, 0);
    const billing = await getSubscriptionSummary(profile._id, { notify: true });
    res.json({
        stats: { todayCount, monthCount: monthItems.length, revenue, botInteractions },
        nextAppointments: nextAppointments.map((item) => ({ ...item, user: item.user ? userView(item.user) : null })),
        billing
    });
}));

router.get('/billing', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    const [settings, billing, payments] = await Promise.all([
        getBillingSettings(), getSubscriptionSummary(profile._id, { notify: true }),
        BillingPayment.find({ profile: profile._id }).populate('plan', 'name slug').sort({ createdAt: -1 }).limit(10).lean()
    ]);
    const config = settingsView(settings);
    res.json({
        provider: 'INFINITEPAY', providerConfigured: config.ready, config,
        billing, subscription: billing, currentPlan: billing.plan,
        plans: config.ready ? await listPublicPlans() : [], payments: payments.map(paymentView)
    });
}));

router.get('/billing/plans', asyncRoute(async (req, res) => {
    await ownProfile(req.auth.userId);
    const config = settingsView(await getBillingSettings());
    res.json({ providerConfigured: config.ready, config, plans: config.ready ? await listPublicPlans() : [] });
}));

router.get('/billing/payments', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    const { page, limit, skip } = pageOptions(req.query);
    const [items, total] = await Promise.all([
        BillingPayment.find({ profile: profile._id }).populate('plan', 'name slug').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        BillingPayment.countDocuments({ profile: profile._id })
    ]);
    res.json(paged(items.map(paymentView), total, page, limit));
}));

router.post('/billing/checkout', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    const result = await createCheckout({ profile, user: req.user, planId: req.body.planId || req.body.plan_id });
    res.status(result.reused ? 200 : 201).json({
        checkoutUrl: result.checkoutUrl, url: result.checkoutUrl,
        payment: paymentView(result.payment), reused: result.reused
    });
}));

router.post('/billing/verify', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    const result = await verifyPaymentReturn({ profileId: profile._id, payload: req.body });
    res.json({ success: true, idempotent: result.idempotent, billing: result.billing, payment: paymentView(result.payment) });
}));

router.get('/profile', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    res.json({ profile, billing: await getSubscriptionSummary(profile._id, { notify: true }) });
}));

router.get('/reminder-settings', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    res.json({ reminderSettings: reminderSettings(profile) });
}));

router.put('/reminder-settings', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    const current = reminderSettings(profile);
    const proposed = reminderSettings({ reminderSettings: { ...current, ...(req.body || {}) } });
    profile.reminderSettings = proposed;
    await profile.save();
    res.json({ reminderSettings: reminderSettings(profile) });
}));

router.put('/profile', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    const oldSlug = profile.slug;
    const simpleFields = ['businessName', 'active', 'published', 'description', 'address', 'whatsapp'];
    simpleFields.forEach((field) => { if (req.body[field] !== undefined) profile[field] = req.body[field]; });
    if (req.body.webhookUrl !== undefined) profile.webhookUrl = await normalizeWebhookUrl(req.body.webhookUrl);
    if (req.body.slug && req.body.slug !== profile.slug) profile.slug = await uniqueSlug(req.body.slug, profile._id);
    if (req.body.site?.locationMap) {
        req.body.site.locationMap.embedUrl = normalizeMapEmbed(req.body.site.locationMap.embedUrl);
    }
    ['services', 'businessHours', 'site', 'bot'].forEach((field) => { if (req.body[field] !== undefined) profile[field] = req.body[field]; });
    if (req.body.reminderSettings !== undefined) {
        profile.reminderSettings = reminderSettings({ reminderSettings: { ...reminderSettings(profile), ...req.body.reminderSettings } });
    }
    await profile.save();
    await Promise.all([
        getRedis()?.del(`cortsme:public:${oldSlug}`),
        getRedis()?.del(`cortsme:public:${profile.slug}`),
        getRedis()?.del(`cortsme:public:v2:${oldSlug}`),
        getRedis()?.del(`cortsme:public:v2:${profile.slug}`)
    ]);
    res.json({ profile });
}));

router.post('/media', upload.single('image'), asyncRoute(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Selecione uma imagem.' });
    const profile = await ownProfile(req.auth.userId);
    const media = await Media.create({ owner: req.auth.userId, profile: profile._id, filename: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size, data: req.file.buffer });
    res.status(201).json({ id: media._id, url: `${process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`}/api/media/${media._id}` });
}));

router.get('/customers', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    const { page, limit } = pageOptions(req.query);
    const search = String(req.query.search || '').trim().toLowerCase();
    let customers = await customersForProfile(profile._id);
    if (search) customers = customers.filter((customer) => [customer.name, customer.email, customer.phone, customer.latestService].some((value) => String(value || '').toLowerCase().includes(search)));
    const total = customers.length;
    const data = customers.slice((page - 1) * limit, page * limit).map(customerSummary);
    res.json(paged(data, total, page, limit));
}));

router.get('/customers/appointment/:appointmentId', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    const customers = await customersForProfile(profile._id);
    const customer = customers.find((item) => item.appointments.some((appointment) => appointment._id === req.params.appointmentId));
    if (!customer) return res.status(404).json({ message: 'Cliente não encontrado para este agendamento.' });
    res.json({ customer });
}));

router.get('/customers/:key', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    const customers = await customersForProfile(profile._id);
    const customer = customers.find((item) => item.key === req.params.key);
    if (!customer) return res.status(404).json({ message: 'Cliente não encontrado.' });
    res.json({ customer });
}));

router.get('/appointments', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    const { page, limit, skip } = pageOptions(req.query);
    const filter = { profile: profile._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) filter.start = { ...(req.query.from ? { $gte: new Date(req.query.from) } : {}), ...(req.query.to ? { $lte: new Date(req.query.to) } : {}) };
    const [items, total] = await Promise.all([
        Appointment.find(filter).populate('user').sort({ start: 1 }).skip(skip).limit(limit).lean(),
        Appointment.countDocuments(filter)
    ]);
    const data = items.map((item) => ({ ...item, user: item.user ? userView(item.user) : null }));
    res.json(paged(data, total, page, limit));
}));

router.get('/appointments/:id', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    const appointment = await Appointment.findOne({ _id: req.params.id, profile: profile._id }).populate('user').lean();
    if (!appointment) return res.status(404).json({ message: 'Agendamento não encontrado.' });
    res.json({ appointment: { ...appointment, user: appointment.user ? userView(appointment.user) : null } });
}));

router.post('/appointments', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    const service = profile.services.id(req.body.serviceId);
    if (!service) return res.status(400).json({ message: 'Selecione um serviço.' });
    const { startDate, endDate } = await assertAvailable(profile, req.body.start, service.duration);
    let customer = null;
    if (req.body.userId) {
        customer = await User.findOne({ _id: req.body.userId, role: 'USER', active: true });
        const knownCustomer = customer && await Appointment.exists({ profile: profile._id, user: customer._id });
        if (!knownCustomer) {
            return res.status(403).json({ message: 'Este cliente não pertence à carteira deste estabelecimento.' });
        }
    }
    const appointment = new Appointment({
        profile: profile._id, user: customer?._id || null, createdBy: req.auth.userId,
        customerName: req.body.customerName || customer?.name || 'Cliente balcão', customerPhone: req.body.customerPhone || '',
        serviceId: service._id, serviceName: service.name, duration: service.duration, price: service.price,
        start: startDate, end: endDate, note: req.body.note, source: 'manual'
    });
    markAppointmentCreated(appointment, req.auth.userId);
    await appointment.save();
    await scheduleAppointmentReminders(appointment);
    await enqueueBarberAppointmentCreated(appointment, { changedBy: req.auth.userId });
    await notifyAppointment(profile, appointment.toObject(), 'created');
    res.status(201).json({ appointment });
}));

router.patch('/appointments/:id', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    const appointment = await Appointment.findOne({ _id: req.params.id, profile: profile._id });
    if (!appointment) return res.status(404).json({ message: 'Agendamento não encontrado.' });
    const before = appointment.toObject();
    const selectedService = req.body.serviceId ? profile.services.id(req.body.serviceId) : null;
    if (req.body.serviceId && !selectedService) return res.status(400).json({ message: 'Serviço não encontrado.' });
    const nextDuration = selectedService?.duration || appointment.duration;
    if (req.body.start || selectedService) {
        const { startDate, endDate } = await assertAvailable(profile, req.body.start || appointment.start, nextDuration, appointment._id);
        appointment.start = startDate; appointment.end = endDate;
    }
    if (selectedService) {
        appointment.serviceId = selectedService._id;
        appointment.serviceName = selectedService.name;
        appointment.duration = selectedService.duration;
        appointment.price = selectedService.price;
    }
    ['status', 'note', 'customerName', 'customerPhone'].forEach((field) => { if (req.body[field] !== undefined) appointment[field] = req.body[field]; });
    if (req.body.resolveAdjustment) appointment.adjustmentRequested = false;
    appendAppointmentHistory(appointment, before, req.auth.userId);
    await appointment.save();
    if (appointment.status === 'CANCELLED') await cancelAppointmentReminders(profile._id, appointment._id);
    else {
        if (new Date(before.start).getTime() !== new Date(appointment.start).getTime()) await revokeAppointmentLinks(profile._id, appointment._id);
        await scheduleAppointmentReminders(appointment);
    }
    await notifyAppointment(profile, appointment.toObject(), 'updated');
    res.json({ appointment });
}));

router.delete('/appointments/:id', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    const appointment = await Appointment.findOneAndDelete({ _id: req.params.id, profile: profile._id });
    if (!appointment) return res.status(404).json({ message: 'Agendamento não encontrado.' });
    await cancelAppointmentReminders(profile._id, appointment._id);
    await notifyAppointment(profile, appointment.toObject(), 'deleted');
    res.status(204).end();
}));

router.get('/bot/logs', asyncRoute(async (req, res) => {
    const profile = await ownProfile(req.auth.userId);
    const { page, limit, skip } = pageOptions(req.query);
    const [data, total] = await Promise.all([BotLog.find({ profile: profile._id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), BotLog.countDocuments({ profile: profile._id })]);
    res.json(paged(data, total, page, limit));
}));

module.exports = router;
