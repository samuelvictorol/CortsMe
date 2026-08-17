const router = require('express').Router();
const { Appointment, BarberProfile } = require('../collections/CortsmeModels');
const { requireAuth, allowRoles } = require('../middlewares/corts-auth.middleware');
const { assertAvailable, notifyAppointment } = require('../services/appointment.service');
const { appendAppointmentHistory, markAppointmentCreated } = require('../services/appointment-history.service');
const { asyncRoute, pageOptions, paged } = require('./route.helpers');
const { assertOnlineBookingAllowed } = require('../services/billing.service');
const {
    scheduleAppointmentReminders, cancelAppointmentReminders,
    enqueueBarberAppointmentCreated, enqueueBarberAppointmentCancelled
} = require('../services/notification.service');

// Profissionais e administradores possuem rotas próprias. Manter este router
// exclusivo do cliente impede que um BARBER consulte ou altere outro tenant.
router.use(requireAuth, allowRoles('USER'));

router.get('/', asyncRoute(async (req, res) => {
    const { page, limit, skip } = pageOptions(req.query);
    const filter = req.auth.role === 'USER' ? { user: req.auth.userId } : {};
    if (req.query.status) filter.status = req.query.status;
    const [data, total] = await Promise.all([
        Appointment.find(filter).populate('profile', 'businessName slug address').sort({ start: -1 }).skip(skip).limit(limit).lean(),
        Appointment.countDocuments(filter)
    ]);
    res.json(paged(data, total, page, limit));
}));

router.post('/', asyncRoute(async (req, res) => {
    const profile = await BarberProfile.findOne({ slug: req.body.slug, active: true, published: true });
    if (!profile) return res.status(404).json({ message: 'Barbearia não encontrada.' });
    await assertOnlineBookingAllowed(profile._id);
    const service = profile.services.id(req.body.serviceId);
    if (!service?.active) return res.status(400).json({ message: 'Serviço indisponível.' });
    const { startDate, endDate } = await assertAvailable(profile, req.body.start, service.duration);
    const appointment = new Appointment({
        profile: profile._id, user: req.auth.userId, createdBy: req.auth.userId,
        serviceId: service._id, serviceName: service.name, duration: service.duration, price: service.price,
        start: startDate, end: endDate, note: req.body.note, source: req.body.source === 'bot' ? 'bot' : 'web'
    });
    markAppointmentCreated(appointment, req.auth.userId);
    await appointment.save();
    await scheduleAppointmentReminders(appointment);
    await enqueueBarberAppointmentCreated(appointment, { changedBy: req.auth.userId });
    await notifyAppointment(profile, appointment.toObject(), 'created');
    res.status(201).json({ appointment });
}));

router.patch('/:id', asyncRoute(async (req, res) => {
    const appointment = await Appointment.findOne({ _id: req.params.id, ...(req.auth.role === 'USER' ? { user: req.auth.userId } : {}) });
    if (!appointment) return res.status(404).json({ message: 'Agendamento não encontrado.' });
    const before = appointment.toObject();
    if (req.auth.role === 'USER') {
        if (req.body.status === 'CANCELLED') appointment.status = 'CANCELLED';
        if (req.body.adjustmentNote || req.body.proposedStart) {
            appointment.adjustmentRequested = true;
            appointment.adjustmentNote = req.body.adjustmentNote || '';
            appointment.proposedStart = req.body.proposedStart || null;
        }
    }
    appendAppointmentHistory(appointment, before, req.auth.userId, appointment.adjustmentRequested && !before.adjustmentRequested ? 'ADJUSTMENT_REQUESTED' : undefined);
    await appointment.save();
    if (appointment.status === 'CANCELLED') {
        await cancelAppointmentReminders(appointment.profile, appointment._id);
        if (before.status !== 'CANCELLED') {
            await enqueueBarberAppointmentCancelled(appointment, { changedBy: req.auth.userId });
        }
    }
    else await scheduleAppointmentReminders(appointment);
    const profile = await BarberProfile.findById(appointment.profile);
    await notifyAppointment(profile, appointment.toObject(), 'updated');
    res.json({ appointment });
}));

module.exports = router;
