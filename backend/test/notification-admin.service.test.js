const test = require('node:test');
const assert = require('node:assert/strict');

const { dispatchFilter, unforwardedDispatchFilter, dispatchView } = require('../src/services/notification-admin.service');

test('filtros locais aceitam apenas status e canais conhecidos e escapam a busca', () => {
    const filter = dispatchFilter({ status: 'queued', channel: 'whatsapp_cloud', search: 'CortsMe.*' });
    assert.equal(filter.status, 'QUEUED');
    assert.equal(filter.channels, 'whatsapp_cloud');
    assert.equal(filter.$and[1].$or[0].templateName.source, 'CortsMe\\.\\*');

    assert.deepEqual(dispatchFilter({ status: 'injetado', channel: 'sms' }), {});
});

test('mapeia agendado para QUEUED futuro, separa fila vencida e exclui encaminhados', () => {
    const now = new Date('2026-08-16T12:00:00.000Z');
    const scheduled = dispatchFilter({ status: 'scheduled' }, { now });
    assert.equal(scheduled.status, 'QUEUED');
    assert.deepEqual(scheduled.scheduledFor, { $gt: now });

    const queued = dispatchFilter({ status: 'queued' }, { now });
    assert.equal(queued.status, 'QUEUED');
    assert.deepEqual(queued.$and[0].$or[2].scheduledFor, { $lte: now });

    const remoteOnly = dispatchFilter({ status: 'partial' }, { now });
    assert.deepEqual(remoteOnly._id, { $exists: false });

    const unforwarded = unforwardedDispatchFilter({}, { now });
    assert.deepEqual(unforwarded.$and[0].$or[0], { notifyFlowId: '' });
});

test('detalhe administrativo mascara destino e expõe dados úteis da fila sem PII bruto', () => {
    const view = dispatchView({
        _id: 'dispatch-a', kind: 'BARBER_APPOINTMENT_CREATED',
        templateName: 'CortsMeBarberAppointmentCreated', channels: ['email', 'whatsapp_cloud'],
        recipientSummary: 'sa***@example.com', status: 'QUEUED',
        scheduledFor: new Date(Date.now() + 60000), attempts: 0,
        entityType: 'appointment', entityId: 'appointment-a', profile: 'profile-a',
        jobId: 'job-a', metadata: { appointmentEvent: 'created' }
    });

    assert.equal(view.kind, 'schedule');
    assert.equal(view.displayStatus, 'SCHEDULED');
    assert.equal(view.dispatchKind, 'BARBER_APPOINTMENT_CREATED');
    assert.equal(view.channel, 'global');
    assert.equal(view.recipientMasked, 'sa***@example.com');
    assert.equal(view.recipientSummary, undefined);
    assert.equal(view.phone, undefined);
    assert.equal(view.email, undefined);
    assert.equal(view.jobId, 'job-a');
});
