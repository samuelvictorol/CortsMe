const TRACKED_FIELDS = [
    'start', 'end', 'status', 'serviceId', 'serviceName', 'duration', 'price',
    'note', 'customerName', 'customerPhone', 'adjustmentRequested',
    'adjustmentNote', 'proposedStart'
];

function printable(value) {
    if (value === undefined || value === null) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object' && value.toISOString) return value.toISOString();
    return String(value);
}

function appendAppointmentHistory(appointment, before, changedBy, forcedAction) {
    const changes = TRACKED_FIELDS
        .map((field) => ({ field, from: printable(before[field]), to: printable(appointment[field]) }))
        .filter((change) => change.from !== change.to);
    if (!changes.length) return false;

    let action = forcedAction;
    if (!action) {
        const statusChange = changes.find((change) => change.field === 'status');
        action = statusChange?.to === 'CANCELLED' ? 'CANCELLED' : statusChange ? 'STATUS_CHANGED' : 'EDITED';
    }
    appointment.history.push({ action, changedBy: changedBy || null, changes });
    return true;
}

function markAppointmentCreated(appointment, changedBy) {
    appointment.history.push({ action: 'CREATED', changedBy: changedBy || null, changes: [] });
}

module.exports = { appendAppointmentHistory, markAppointmentCreated };
