const router = require('express').Router();
const { User, BarberProfile, Appointment, BotLog, Media } = require('../collections/CortsmeModels');
const { requireAuth, allowRoles } = require('../middlewares/corts-auth.middleware');
const { createUser, updateUser, userView, findByIdentity } = require('../services/user.service');
const { createDefaultProfile, uniqueSlug } = require('../services/profile.service');
const { notifyAppointment } = require('../services/appointment.service');
const { appendAppointmentHistory } = require('../services/appointment-history.service');
const { asyncRoute, pageOptions, paged } = require('./route.helpers');

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

router.post('/users', asyncRoute(async (req, res) => {
    const role = req.body.role === 'BARBER' ? 'BARBER' : 'USER';
    const user = await createUser(req.body, role);
    let profile = null;
    if (role === 'BARBER') profile = await createDefaultProfile(user._id, req.body.businessName || user.name, req.body.slug);
    res.status(201).json({ user: userView(user), profile });
}));

router.patch('/users/:id', asyncRoute(async (req, res) => {
    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
    if (user.role === 'ADMIN' && req.body.role && req.body.role !== 'ADMIN') return res.status(400).json({ message: 'O administrador do sistema é fixo.' });
    const oldRole = user.role;
    if (['USER', 'BARBER'].includes(req.body.role)) user.role = req.body.role;
    await updateUser(user, req.body);
    if (oldRole !== 'BARBER' && user.role === 'BARBER' && !await BarberProfile.exists({ owner: user._id })) await createDefaultProfile(user._id, req.body.businessName || user.name, req.body.slug);
    res.json({ user: userView(user) });
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
    res.status(204).end();
}));

router.get('/profiles', asyncRoute(async (req, res) => {
    const { page, limit, skip } = pageOptions(req.query);
    const filter = req.query.search ? { $or: [{ businessName: { $regex: req.query.search, $options: 'i' } }, { slug: { $regex: req.query.search, $options: 'i' } }] } : {};
    const [data, total] = await Promise.all([
        BarberProfile.find(filter).populate('owner').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        BarberProfile.countDocuments(filter)
    ]);
    res.json(paged(data.map((item) => ({ ...item, owner: userView(item.owner) })), total, page, limit));
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
    const profile = await BarberProfile.findById(appointment.profile);
    await notifyAppointment(profile, appointment.toObject(), 'updated');
    res.json({ appointment });
}));

router.delete('/appointments/:id', asyncRoute(async (req, res) => {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Agendamento não encontrado.' });
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
