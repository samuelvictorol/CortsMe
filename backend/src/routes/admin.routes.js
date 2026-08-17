const router = require('express').Router();
const {
    User, BarberProfile, Appointment, BotLog, Media,
    BillingPlan, Subscription, BillingPayment, NotificationDispatch
} = require('../collections/CortsmeModels');
const { requireAuth, allowRoles } = require('../middlewares/corts-auth.middleware');
const { updateUser, userView, findByIdentity } = require('../services/user.service');
const { createDefaultProfile, uniqueSlug } = require('../services/profile.service');
const { notifyAppointment } = require('../services/appointment.service');
const { appendAppointmentHistory } = require('../services/appointment-history.service');
const { asyncRoute, pageOptions, paged } = require('./route.helpers');
const {
    getBillingSettings, updateBillingSettings, settingsView, planView, normalizePlanPayload,
    ensureSubscription, calculateSubscriptionState, adjustSubscription, confirmPayment, notifyBillingChanged
} = require('../services/billing.service');
const {
    getActivity: getNotifyFlowActivity,
    getActivityDetail: getNotifyFlowActivityDetail,
    getStatus: getNotifyFlowStatus
} = require('../services/notifyflow.service');
const { scheduleAppointmentReminders, cancelAppointmentReminders, revokeAppointmentLinks } = require('../services/notification.service');
const {
    listDispatches: listNotifyFlowDispatches,
    getDispatch: getNotifyFlowDispatch,
    getQueueStatus: getNotifyFlowQueueStatus
} = require('../services/notification-admin.service');
const { listCombinedActivity: listNotifyFlowCombinedActivity } = require('../services/notification-feed.service');
const { parseAdminUserPayload, createAdminUser } = require('../services/admin-user.service');
const {
    parseAvatarUpload,
    validateAvatarFile,
    normalizeAvatarUrl,
    avatarPublicUrl,
    saveAvatarUpload,
    setAvatarUrl
} = require('../services/avatar.service');

router.use(requireAuth, allowRoles('ADMIN'));

router.get('/dashboard', asyncRoute(async (req, res) => {
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    const [users, barbers, appointments, interactions, recent] = await Promise.all([
        User.countDocuments({ role: 'USER' }), BarberProfile.countDocuments(),
        Appointment.countDocuments({ createdAt: { $gte: month } }), BotLog.countDocuments({ createdAt: { $gte: month } }),
        BotLog.find().sort({ createdAt: -1 }).limit(6).populate('profile', 'businessName slug').lean()
    ]);
    res.json({ stats: { users, barbers, appointments, interactions }, recent });
}));

router.get('/notifyflow/activity', asyncRoute(async (req, res) => {
    const result = await getNotifyFlowActivity(req.query);
    res.json(result);
}));

router.get('/notifyflow/feed', asyncRoute(async (req, res) => {
    res.json(await listNotifyFlowCombinedActivity(req.query, pageOptions(req.query)));
}));

router.get('/notifyflow/activity/:type/:activityId', asyncRoute(async (req, res) => {
    res.json(await getNotifyFlowActivityDetail(req.params.type, req.params.activityId));
}));

router.get('/notifyflow/dispatches', asyncRoute(async (req, res) => {
    res.json(await listNotifyFlowDispatches(req.query, pageOptions(req.query)));
}));

router.get('/notifyflow/dispatches/:id', asyncRoute(async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(String(req.params.id || ''))) {
        return res.status(404).json({ message: 'Disparo não encontrado.' });
    }
    const result = await getNotifyFlowDispatch(req.params.id);
    if (!result) return res.status(404).json({ message: 'Disparo não encontrado.' });
    res.json(result);
}));

router.get('/notifyflow/status', asyncRoute(async (req, res) => {
    const [remote, localCounts, recentFailures, localQueue] = await Promise.all([
        getNotifyFlowStatus().catch((error) => ({
            success: false,
            connected: false,
            error: error.message,
            code: error.code || 'NOTIFYFLOW_UNAVAILABLE'
        })),
        NotificationDispatch.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        NotificationDispatch.find({ status: 'FAILED' }).sort({ updatedAt: -1 }).limit(5)
            .select('kind entityType entityId lastError updatedAt profile').lean(),
        getNotifyFlowQueueStatus()
    ]);
    res.json({
        notifyFlow: remote,
        local: {
            counts: Object.fromEntries(localCounts.map((item) => [item._id, item.count])),
            recentFailures,
            queue: localQueue
        }
    });
}));

function adminSubscriptionView(subscription) {
    const raw = typeof subscription.toObject === 'function' ? subscription.toObject() : subscription;
    const state = calculateSubscriptionState(raw, raw.plan);
    const owner = raw.profile?.owner ? userView(raw.profile.owner) : null;
    return {
        ...state, id: String(raw._id), status: state.status, note: raw.note || '',
        profile: raw.profile && typeof raw.profile === 'object' ? {
            id: String(raw.profile._id), businessName: raw.profile.businessName, slug: raw.profile.slug,
            email: owner?.email || '', phone: owner?.phone || '', owner, user: owner
        } : raw.profile,
        createdAt: raw.createdAt, updatedAt: raw.updatedAt
    };
}

function adminPaymentView(payment) {
    const raw = typeof payment.toObject === 'function' ? payment.toObject() : payment;
    return {
        id: String(raw._id), provider: raw.provider, orderNsu: raw.orderNsu,
        amountCents: raw.amountCents, paidAmountCents: raw.paidAmountCents, durationDays: raw.durationDays,
        status: raw.status, checkoutUrl: raw.checkoutUrl, invoiceSlug: raw.invoiceSlug,
        transactionNsu: raw.transactionNsu, receiptUrl: raw.receiptUrl,
        captureMethod: raw.captureMethod, paidAt: raw.paidAt, failureReason: raw.failureReason,
        profile: raw.profile && typeof raw.profile === 'object'
            ? { id: String(raw.profile._id), businessName: raw.profile.businessName, slug: raw.profile.slug }
            : raw.profile,
        plan: raw.plan && typeof raw.plan === 'object' ? planView(raw.plan) : raw.plan,
        createdAt: raw.createdAt, updatedAt: raw.updatedAt
    };
}

async function matchingBillingProfileIds(search) {
    const raw = String(search || '').trim();
    if (!raw) return [];
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const identity = await findByIdentity(raw);
    const users = await User.find({
        $or: [{ name: { $regex: escaped, $options: 'i' } }, ...(identity ? [{ _id: identity._id }] : [])]
    }).select('_id');
    const profiles = await BarberProfile.find({
        $or: [
            { businessName: { $regex: escaped, $options: 'i' } },
            { slug: { $regex: escaped, $options: 'i' } },
            ...(users.length ? [{ owner: { $in: users.map((item) => item._id) } }] : [])
        ]
    }).select('_id');
    return profiles.map((item) => item._id);
}

router.get('/billing/settings', asyncRoute(async (req, res) => {
    res.json({ settings: settingsView(await getBillingSettings()) });
}));

router.put('/billing/settings', asyncRoute(async (req, res) => {
    const settings = await updateBillingSettings(req.body, req.auth.userId);
    res.json({ settings: settingsView(settings) });
}));

router.get('/billing/plans', asyncRoute(async (req, res) => {
    const plans = await BillingPlan.find().sort({ displayOrder: 1, priceCents: 1 }).lean();
    res.json({ plans: plans.map(planView) });
}));

router.post('/billing/plans', asyncRoute(async (req, res) => {
    if (await BillingPlan.countDocuments() >= 5) return res.status(409).json({ message: 'O sistema permite no máximo 5 planos.', code: 'BILLING_PLAN_LIMIT' });
    const normalized = normalizePlanPayload(req.body);
    if (normalized.isFree && await BillingPlan.exists({ isFree: true })) {
        return res.status(409).json({ message: 'Já existe um plano gratuito.' });
    }
    const plan = await BillingPlan.create(normalized);
    res.status(201).json({ plan: planView(plan) });
}));

router.patch('/billing/plans/:id', asyncRoute(async (req, res) => {
    const plan = await BillingPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plano não encontrado.' });
    if (plan.isFree && req.body.isFree === false) return res.status(400).json({ message: 'O plano gratuito base não pode ser transformado em plano pago.' });
    if (!plan.isFree && req.body.isFree === true && await BillingPlan.exists({ isFree: true })) {
        return res.status(409).json({ message: 'Já existe um plano gratuito.' });
    }
    Object.assign(plan, normalizePlanPayload(req.body, plan.toObject()));
    await plan.save();
    const affected = await Subscription.find({ plan: plan._id }).select('profile');
    await Promise.all(affected.map((item) => notifyBillingChanged(item.profile, 'plan_updated')));
    res.json({ plan: planView(plan) });
}));

router.delete('/billing/plans/:id', asyncRoute(async (req, res) => {
    const plan = await BillingPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plano não encontrado.' });
    if (plan.isFree) return res.status(400).json({ message: 'O plano gratuito base não pode ser excluído.' });
    const inUse = await Promise.all([
        Subscription.exists({ plan: plan._id }), BillingPayment.exists({ plan: plan._id })
    ]);
    if (inUse.some(Boolean)) return res.status(409).json({ message: 'Este plano possui histórico. Inative-o para preservar os dados financeiros.' });
    await plan.deleteOne();
    res.status(204).end();
}));

router.get('/billing/subscriptions', asyncRoute(async (req, res) => {
    const { page, limit, skip } = pageOptions(req.query);
    const profilesWithoutSubscription = await BarberProfile.find({
        _id: { $nin: await Subscription.distinct('profile') }
    }).select('_id');
    await Promise.all(profilesWithoutSubscription.map((profile) => ensureSubscription(profile._id)));
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.planId) filter.plan = req.query.planId;
    if (req.query.search) filter.profile = { $in: await matchingBillingProfileIds(req.query.search) };
    const [items, total] = await Promise.all([
        Subscription.find(filter).populate({ path: 'profile', select: 'businessName slug owner', populate: { path: 'owner' } })
            .populate('plan').sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
        Subscription.countDocuments(filter)
    ]);
    res.json({ subscriptions: items.map(adminSubscriptionView), pagination: paged([], total, page, limit).pagination });
}));

router.patch('/billing/subscriptions/:id', asyncRoute(async (req, res) => {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) return res.status(404).json({ message: 'Assinatura não encontrada.' });
    const billing = await adjustSubscription(subscription._id, req.body, req.auth.userId);
    const updated = await Subscription.findById(subscription._id)
        .populate({ path: 'profile', select: 'businessName slug owner', populate: { path: 'owner' } }).populate('plan').lean();
    res.json({ subscription: adminSubscriptionView(updated), billing });
}));

router.get('/billing/payments', asyncRoute(async (req, res) => {
    const { page, limit, skip } = pageOptions(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.profileId) filter.profile = req.query.profileId;
    if (req.query.planId) filter.plan = req.query.planId;
    if (req.query.search) {
        const escaped = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const profileIds = await matchingBillingProfileIds(req.query.search);
        filter.$or = [
            { orderNsu: { $regex: escaped, $options: 'i' } },
            { transactionNsu: { $regex: escaped, $options: 'i' } },
            ...(profileIds.length ? [{ profile: { $in: profileIds } }] : [])
        ];
    }
    const [items, total] = await Promise.all([
        BillingPayment.find(filter).populate('profile', 'businessName slug').populate('plan')
            .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        BillingPayment.countDocuments(filter)
    ]);
    res.json({ payments: items.map(adminPaymentView), pagination: paged([], total, page, limit).pagination });
}));

router.post('/billing/payments/:id/simulate', asyncRoute(async (req, res) => {
    if (String(process.env.ALLOW_PAYMENT_SIMULATION).toLowerCase() !== 'true') {
        return res.status(403).json({ message: 'Simulação de pagamentos está desabilitada.', code: 'PAYMENT_SIMULATION_DISABLED' });
    }
    const payment = await BillingPayment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Pagamento não encontrado.' });
    const result = await confirmPayment({
        order_nsu: payment.orderNsu, amount: payment.amountCents,
        transaction_nsu: req.body.transactionNsu || `sim-${Date.now()}-${payment._id}`,
        invoice_slug: req.body.slug || `simulation-${payment._id}`,
        paid_amount: payment.amountCents, capture_method: req.body.captureMethod || 'pix',
        receipt_url: req.body.receiptUrl || ''
    }, { skipProviderCheck: true, provider: 'SYSTEM' });
    res.json({ success: true, billing: result.billing, payment: adminPaymentView(result.payment) });
}));

router.get('/users', asyncRoute(async (req, res) => {
    const { page, limit, skip } = pageOptions(req.query);
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.search) {
        const found = await findByIdentity(req.query.search);
        filter.$or = [{ name: { $regex: String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }, ...(found ? [{ _id: found._id }] : [])];
    }
    const [items, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), User.countDocuments(filter)]);
    res.json(paged(items.map(userView), total, page, limit));
}));

router.post('/users', parseAvatarUpload, asyncRoute(async (req, res) => {
    const payload = parseAdminUserPayload(req.body);
    const result = await createAdminUser(payload, req.file);
    res.status(201).json({
        user: userView(result.user),
        profile: result.profile,
        ...(result.avatarWarning ? { avatarWarning: result.avatarWarning } : {})
    });
}));

router.patch('/users/:id', parseAvatarUpload, asyncRoute(async (req, res) => {
    const payload = parseAdminUserPayload(req.body);
    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
    if (user.role === 'ADMIN' && payload.role && payload.role !== 'ADMIN') return res.status(400).json({ message: 'O administrador do sistema é fixo.' });
    if (req.file) validateAvatarFile(req.file);
    const hasAvatarValue = Object.prototype.hasOwnProperty.call(payload, 'avatar');
    const requestedAvatar = hasAvatarValue ? String(payload.avatar || '').trim() : undefined;
    const avatarChanged = !req.file && hasAvatarValue && requestedAvatar !== avatarPublicUrl(user);
    if (avatarChanged) normalizeAvatarUrl(requestedAvatar);
    delete payload.avatar;
    const oldRole = user.role;
    if (['USER', 'BARBER'].includes(payload.role)) user.role = payload.role;
    let savedUser = await updateUser(user, payload);
    if (oldRole !== 'BARBER' && savedUser.role === 'BARBER' && !await BarberProfile.exists({ owner: savedUser._id })) {
        await createDefaultProfile(savedUser._id, payload.businessName || savedUser.name, payload.slug);
    }
    let avatarWarning = '';
    try {
        if (req.file) savedUser = await saveAvatarUpload(savedUser._id, req.file);
        else if (avatarChanged) savedUser = await setAvatarUrl(savedUser._id, requestedAvatar);
    } catch (error) {
        avatarWarning = req.file
            ? 'Os dados foram salvos, mas a nova foto não pôde ser aplicada. O avatar anterior foi preservado.'
            : 'Os dados foram salvos, mas o avatar não pôde ser alterado. Tente novamente.';
        console.warn('Alteração administrativa concluída com aviso de avatar.', {
            userId: String(savedUser._id),
            code: error.code || 'AVATAR_UPDATE_FAILED'
        });
    }
    res.json({ user: userView(savedUser), ...(avatarWarning ? { avatarWarning } : {}) });
}));

router.delete('/users/:id', asyncRoute(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
    if (user.role === 'ADMIN') return res.status(400).json({ message: 'O administrador único não pode ser removido.' });
    const profiles = await BarberProfile.find({ owner: user._id }).select('_id');
    const profileIds = profiles.map((item) => item._id);
    await Promise.all([
        User.deleteOne({ _id: user._id }), BarberProfile.deleteMany({ owner: user._id }),
        Appointment.deleteMany({ $or: [{ user: user._id }, { profile: { $in: profileIds } }] }),
        BotLog.deleteMany({ $or: [{ user: user._id }, { profile: { $in: profileIds } }] }),
        Media.deleteMany({ owner: user._id })
    ]);
    global.cortsmeIo?.in(`user:${String(user._id)}`).disconnectSockets(true);
    res.status(204).end();
}));

router.get('/profiles', asyncRoute(async (req, res) => {
    const { page, limit, skip } = pageOptions(req.query);
    const filter = req.query.search ? { $or: [{ businessName: { $regex: req.query.search, $options: 'i' } }, { slug: { $regex: req.query.search, $options: 'i' } }] } : {};
    const [data, total] = await Promise.all([
        BarberProfile.find(filter).populate('owner').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        BarberProfile.countDocuments(filter)
    ]);
    const enriched = await Promise.all(data.map(async (item) => {
        const subscription = await ensureSubscription(item._id);
        return {
            ...item, owner: userView(item.owner),
            billing: calculateSubscriptionState(subscription, subscription.plan),
            currentPlan: planView(subscription.plan)
        };
    }));
    res.json(paged(enriched, total, page, limit));
}));

router.patch('/profiles/:id', asyncRoute(async (req, res) => {
    const profile = await BarberProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ message: 'Perfil não encontrado.' });
    if (req.body.slug && req.body.slug !== profile.slug) req.body.slug = await uniqueSlug(req.body.slug, profile._id);
    Object.assign(profile, req.body);
    await profile.save();
    res.json({ profile });
}));

router.delete('/profiles/:id', asyncRoute(async (req, res) => {
    const profile = await BarberProfile.findByIdAndDelete(req.params.id);
    if (!profile) return res.status(404).json({ message: 'Perfil não encontrado.' });
    await Promise.all([Appointment.deleteMany({ profile: profile._id }), BotLog.deleteMany({ profile: profile._id }), Media.deleteMany({ profile: profile._id })]);
    res.status(204).end();
}));

router.get('/appointments', asyncRoute(async (req, res) => {
    const { page, limit, skip } = pageOptions(req.query);
    const filter = req.query.status ? { status: req.query.status } : {};
    const [data, total] = await Promise.all([
        Appointment.find(filter).populate('profile', 'businessName slug').populate('user').sort({ start: -1 }).skip(skip).limit(limit).lean(),
        Appointment.countDocuments(filter)
    ]);
    res.json(paged(data.map((item) => ({ ...item, user: item.user ? userView(item.user) : null })), total, page, limit));
}));

router.patch('/appointments/:id', asyncRoute(async (req, res) => {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Agendamento não encontrado.' });
    const before = appointment.toObject();
    Object.assign(appointment, req.body);
    appendAppointmentHistory(appointment, before, req.auth.userId);
    await appointment.save();
    if (appointment.status === 'CANCELLED') await cancelAppointmentReminders(appointment.profile, appointment._id);
    else {
        if (new Date(before.start).getTime() !== new Date(appointment.start).getTime()) await revokeAppointmentLinks(appointment.profile, appointment._id);
        await scheduleAppointmentReminders(appointment);
    }
    const profile = await BarberProfile.findById(appointment.profile);
    await notifyAppointment(profile, appointment.toObject(), 'updated');
    res.json({ appointment });
}));

router.delete('/appointments/:id', asyncRoute(async (req, res) => {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Agendamento não encontrado.' });
    await cancelAppointmentReminders(appointment.profile, appointment._id);
    res.status(204).end();
}));

router.get('/bot-logs', asyncRoute(async (req, res) => {
    const { page, limit, skip } = pageOptions(req.query);
    const [data, total] = await Promise.all([BotLog.find().populate('profile', 'businessName slug').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), BotLog.countDocuments()]);
    res.json(paged(data, total, page, limit));
}));

router.delete('/bot-logs/:id', asyncRoute(async (req, res) => {
    await BotLog.findByIdAndDelete(req.params.id);
    res.status(204).end();
}));

module.exports = router;
