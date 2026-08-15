const { Appointment } = require('../collections/CortsmeModels');
const { userView } = require('./user.service');

function manualIdentity(item) {
    const phone = String(item.customerPhone || '').replace(/\D/g, '');
    return phone ? `phone:${phone}` : `name:${String(item.customerName || 'cliente').trim().toLowerCase()}`;
}

function publicAppointment(item) {
    return {
        _id: String(item._id), serviceId: item.serviceId ? String(item.serviceId) : '',
        serviceName: item.serviceName, duration: item.duration, price: item.price,
        start: item.start, end: item.end, status: item.status, source: item.source,
        note: item.note || '', updatedAt: item.updatedAt, createdAt: item.createdAt,
        history: item.history || []
    };
}

async function customersForProfile(profileId) {
    const appointments = await Appointment.find({ profile: profileId }).populate('user').sort({ start: -1 }).lean();
    const groups = new Map();

    for (const item of appointments) {
        const registered = Boolean(item.user);
        const contact = registered ? userView(item.user) : null;
        const identity = registered ? `user:${contact.id}` : manualIdentity(item);
        if (!groups.has(identity)) {
            groups.set(identity, {
                key: registered ? identity : `manual:${item._id}`,
                registered,
                userId: contact?.id || null,
                name: contact?.name || item.customerName || 'Cliente de balcão',
                email: contact?.email || '',
                phone: contact?.phone || item.customerPhone || '',
                avatar: contact?.avatar || '',
                provider: contact?.provider || 'manual',
                appointments: []
            });
        }
        const customer = groups.get(identity);
        if (!customer.phone && item.customerPhone) customer.phone = item.customerPhone;
        if (!customer.name && item.customerName) customer.name = item.customerName;
        customer.appointments.push(publicAppointment(item));
    }

    const now = Date.now();
    return [...groups.values()].map((customer) => {
        const completedCuts = customer.appointments.filter((item) => item.status === 'COMPLETED').length;
        const attendedCuts = customer.appointments.filter((item) => item.status !== 'CANCELLED' && new Date(item.start).getTime() <= now).length;
        const cancelledCount = customer.appointments.filter((item) => item.status === 'CANCELLED').length;
        const editedCount = customer.appointments.filter((item) => item.history.some((entry) => ['EDITED', 'STATUS_CHANGED', 'CANCELLED', 'ADJUSTMENT_REQUESTED'].includes(entry.action))).length;
        const lastVisit = customer.appointments.find((item) => item.status !== 'CANCELLED' && new Date(item.start).getTime() <= now)?.start || null;
        const nextAppointment = [...customer.appointments].reverse().find((item) => item.status !== 'CANCELLED' && new Date(item.start).getTime() > now)?.start || null;
        const totalSpent = customer.appointments.filter((item) => item.status === 'COMPLETED').reduce((sum, item) => sum + Number(item.price || 0), 0);
        return {
            ...customer,
            totalAppointments: customer.appointments.length,
            completedCuts,
            attendedCuts,
            cancelledCount,
            editedCount,
            lastVisit,
            nextAppointment,
            totalSpent,
            latestService: customer.appointments[0]?.serviceName || '',
            customerSince: customer.appointments.at(-1)?.start || null
        };
    }).sort((a, b) => new Date(b.appointments[0]?.start || 0) - new Date(a.appointments[0]?.start || 0));
}

function customerSummary(customer) {
    const { appointments, ...summary } = customer;
    return summary;
}

module.exports = { customersForProfile, customerSummary };
