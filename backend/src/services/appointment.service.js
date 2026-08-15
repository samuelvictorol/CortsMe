const axios = require('axios');
const { Appointment } = require('../collections/CortsmeModels');

function minutes(value) {
    const [hour, minute] = String(value).split(':').map(Number);
    return (hour * 60) + minute;
}

function onDate(date, minuteOfDay) {
    const result = new Date(`${date}T00:00:00`);
    result.setMinutes(minuteOfDay);
    return result;
}

async function assertAvailable(profile, start, duration, ignoreId) {
    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime()) || startDate <= new Date()) throw Object.assign(new Error('Escolha um horário futuro válido.'), { statusCode: 400 });
    const endDate = new Date(startDate.getTime() + duration * 60000);
    const hours = profile.businessHours.find((item) => item.weekday === startDate.getDay());
    if (!hours?.enabled) throw Object.assign(new Error('O estabelecimento não funciona neste dia.'), { statusCode: 409 });
    const startMinute = startDate.getHours() * 60 + startDate.getMinutes();
    const endMinute = endDate.getHours() * 60 + endDate.getMinutes();
    const outside = startMinute < minutes(hours.start) || endMinute > minutes(hours.end);
    const hitsBreak = hours.breakStart && startMinute < minutes(hours.breakEnd) && endMinute > minutes(hours.breakStart);
    if (outside || hitsBreak) throw Object.assign(new Error('Horário fora do funcionamento ou intervalo.'), { statusCode: 409 });
    const conflict = await Appointment.exists({
        profile: profile._id, status: { $nin: ['CANCELLED'] },
        ...(ignoreId ? { _id: { $ne: ignoreId } } : {}),
        start: { $lt: endDate }, end: { $gt: startDate }
    });
    if (conflict) throw Object.assign(new Error('Este horário acabou de ser ocupado. Escolha outro.'), { statusCode: 409 });
    return { startDate, endDate };
}

async function availableSlots(profile, date, duration = 30) {
    const day = new Date(`${date}T12:00:00`);
    const hours = profile.businessHours.find((item) => item.weekday === day.getDay());
    if (!hours?.enabled) return [];
    const appointments = await Appointment.find({
        profile: profile._id, status: { $nin: ['CANCELLED'] },
        start: { $lt: onDate(date, minutes(hours.end)) }, end: { $gt: onDate(date, minutes(hours.start)) }
    }).lean();
    const result = [];
    for (let cursor = minutes(hours.start); cursor + duration <= minutes(hours.end); cursor += 30) {
        const start = onDate(date, cursor);
        const end = new Date(start.getTime() + duration * 60000);
        const inBreak = hours.breakStart && cursor < minutes(hours.breakEnd) && cursor + duration > minutes(hours.breakStart);
        const busy = appointments.some((item) => item.start < end && item.end > start);
        if (!inBreak && !busy && start > new Date()) result.push({ start: start.toISOString(), label: start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) });
    }
    return result;
}

async function notifyAppointment(profile, appointment, event) {
    const io = global.cortsmeIo;
    if (io) {
        io.to(`barber:${profile.owner}`).emit('appointment:changed', { event, appointment });
        if (appointment.user) io.to(`user:${appointment.user}`).emit('appointment:changed', { event, appointment });
        io.to('admin').emit('appointment:changed', { event, appointment });
    }
    if (profile.webhookUrl) axios.post(profile.webhookUrl, { event: `appointment.${event}`, data: appointment }, { timeout: 3500 }).catch(() => undefined);
}

module.exports = { assertAvailable, availableSlots, notifyAppointment };
