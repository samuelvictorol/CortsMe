const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const {
    Appointment, BarberProfile, NotificationDispatch
} = require('../src/collections/CortsmeModels');
const { encryptText, decryptText } = require('../src/services/security.service');
const {
    processNotificationJob, recipientFromBarberProfile, appointmentEventTransitionId,
    barberAppointmentEventIdempotency, TEMPLATES
} = require('../src/services/notification.service');

function owner(overrides = {}) {
    return {
        _id: 'owner-a',
        name: 'Samuel Barbeiro',
        emailEncrypted: encryptText('samuel.softdev@outlook.com'),
        phoneEncrypted: encryptText('61981748795'),
        role: 'BARBER', provider: 'local', active: true,
        ...overrides
    };
}

function dispatch(kind, status = 'QUEUED') {
    return {
        _id: 'dispatch-a', profile: 'profile-a', entityId: 'appointment-a',
        kind, templateName: TEMPLATES[kind], channels: ['email', 'whatsapp_cloud'],
        idempotencyKey: `cortsme:test:${kind.toLowerCase()}`, status,
        attempts: 0, recipientSummary: '', notifyFlowId: '', responseStatus: '', lastError: '',
        async save() { return this; }
    };
}

test('cancelamento é entregue somente ao dono atual do tenant por e-mail e WhatsApp', async (context) => {
    const originals = {
        dispatchFind: NotificationDispatch.findById,
        appointmentFind: Appointment.findOne,
        profileFind: BarberProfile.findOne,
        adapter: axios.defaults.adapter,
        baseUrl: process.env.NOTIFYFLOW_BASE_URL,
        token: process.env.NOTIFYFLOW_APP_TOKEN
    };
    context.after(() => {
        NotificationDispatch.findById = originals.dispatchFind;
        Appointment.findOne = originals.appointmentFind;
        BarberProfile.findOne = originals.profileFind;
        axios.defaults.adapter = originals.adapter;
        if (originals.baseUrl === undefined) delete process.env.NOTIFYFLOW_BASE_URL;
        else process.env.NOTIFYFLOW_BASE_URL = originals.baseUrl;
        if (originals.token === undefined) delete process.env.NOTIFYFLOW_APP_TOKEN;
        else process.env.NOTIFYFLOW_APP_TOKEN = originals.token;
    });

    process.env.NOTIFYFLOW_BASE_URL = 'https://notifyflow.test';
    process.env.NOTIFYFLOW_APP_TOKEN = 'test-token-not-a-secret';
    const expectedStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const localDispatch = dispatch('BARBER_APPOINTMENT_CANCELLED');
    let appointmentQuery;
    let profileQuery;
    let requestBody;
    NotificationDispatch.findById = async () => localDispatch;
    Appointment.findOne = (query) => {
        appointmentQuery = query;
        return { populate: async () => ({
            _id: 'appointment-a', profile: 'profile-a', user: null,
            customerName: 'Cliente Teste', serviceName: 'Corte',
            start: expectedStart, status: 'CANCELLED'
        }) };
    };
    BarberProfile.findOne = (query) => {
        profileQuery = query;
        return { populate: async () => ({
            _id: 'profile-a', owner: owner(), active: true,
            businessName: 'Barbearia A',
            // Número antigo do perfil jamais deve prevalecer sobre o dono.
            whatsapp: '5511999990000', reminderSettings: { timezone: 'America/Sao_Paulo' }
        }) };
    };
    axios.defaults.adapter = async (config) => {
        requestBody = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        return { data: { id: 'notify-1', status: 'queued' }, status: 202, statusText: 'Accepted', headers: {}, config };
    };

    await processNotificationJob({
        name: 'barber-appointment-cancelled',
        data: { dispatchId: 'dispatch-a', profileId: 'profile-a', appointmentId: 'appointment-a', expectedStart: expectedStart.toISOString() }
    });

    assert.deepEqual(appointmentQuery, { _id: 'appointment-a', profile: 'profile-a' });
    assert.deepEqual(profileQuery, { _id: 'profile-a' });
    assert.equal(requestBody.templateName, 'CortsMeBarberAppointmentCancelled');
    assert.deepEqual(requestBody.channels, ['email', 'whatsapp_cloud']);
    assert.equal(requestBody.recipients.length, 1);
    assert.equal(requestBody.recipients[0].externalId, 'barber:profile-a:owner-a');
    assert.equal(requestBody.recipients[0].email, 'samuel.softdev@outlook.com');
    assert.equal(requestBody.recipients[0].phone, '+5561981748795');
    assert.notEqual(requestBody.recipients[0].phone, '+5511999990000');
    assert.equal(requestBody.metadata.tenantId, 'profile-a');
    assert.equal(requestBody.metadata.profileId, 'profile-a');
    assert.equal(localDispatch.status, 'SENT');
});

test('worker rejeita evento de agendamento cujo tenant diverge do dispatch', async (context) => {
    const originalDispatchFind = NotificationDispatch.findById;
    const originalAppointmentFind = Appointment.findOne;
    const localDispatch = dispatch('BARBER_APPOINTMENT_CREATED');
    let queriedAppointment = false;
    NotificationDispatch.findById = async () => localDispatch;
    Appointment.findOne = () => { queriedAppointment = true; };
    context.after(() => {
        NotificationDispatch.findById = originalDispatchFind;
        Appointment.findOne = originalAppointmentFind;
    });

    await processNotificationJob({
        name: 'barber-appointment-created',
        data: {
            dispatchId: 'dispatch-a', profileId: 'profile-b', appointmentId: 'appointment-a',
            expectedStart: new Date(Date.now() + 3600000).toISOString()
        }
    });

    assert.equal(queriedAppointment, false);
    assert.equal(localDispatch.status, 'SKIPPED');
    assert.match(localDispatch.lastError, /tenant/i);
});

test('templates de criação e cancelamento são distintos e explícitos', () => {
    assert.equal(TEMPLATES.BARBER_APPOINTMENT_CREATED, 'CortsMeBarberAppointmentCreated');
    assert.equal(TEMPLATES.BARBER_APPOINTMENT_CANCELLED, 'CortsMeBarberAppointmentCancelled');
});

test('todos os avisos do profissional priorizam o telefone atualizado do dono', () => {
    const recipient = recipientFromBarberProfile({
        _id: 'profile-a', owner: owner(), whatsapp: '5511999990000'
    });
    assert.equal(recipient.externalId, 'barber:profile-a:owner-a');
    assert.equal(recipient.phone, '+5561981748795');
    assert.notEqual(recipient.phone, '+5511999990000');
});

test('override Meta altera somente o destino WhatsApp e preserva e-mail e telefone principal', () => {
    const profileOwner = owner({ whatsappMetaPhoneEncrypted: encryptText('+556181748795') });
    const recipient = recipientFromBarberProfile({
        _id: 'profile-a', owner: profileOwner, whatsapp: '5511999990000'
    });

    assert.equal(recipient.email, 'samuel.softdev@outlook.com');
    assert.equal(recipient.phone, '+556181748795');
    assert.equal(decryptText(profileOwner.phoneEncrypted), '61981748795');
});

test('idempotência usa a transição de cancelamento e muda somente após reabertura', () => {
    const firstCancellation = {
        _id: 'appointment-a', profile: 'profile-a', updatedAt: new Date('2026-08-16T10:00:00Z'),
        history: [{
            _id: 'transition-cancel-1', action: 'CANCELLED',
            changes: [{ field: 'status', from: 'CONFIRMED', to: 'CANCELLED' }]
        }]
    };
    const firstTransition = appointmentEventTransitionId(firstCancellation, 'cancelled');
    const firstKey = barberAppointmentEventIdempotency('cancelled', 'profile-a', 'appointment-a', firstTransition);
    assert.equal(firstTransition, 'cancel-1');
    assert.equal(
        firstKey,
        barberAppointmentEventIdempotency('cancelled', 'profile-a', 'appointment-a', appointmentEventTransitionId(firstCancellation, 'cancelled'))
    );

    const reopenedAndCancelledAgain = {
        ...firstCancellation,
        history: [
            ...firstCancellation.history,
            { _id: 'transition-reopen', action: 'STATUS_CHANGED', changes: [{ field: 'status', from: 'CANCELLED', to: 'CONFIRMED' }] },
            { _id: 'transition-cancel-2', action: 'CANCELLED', changes: [{ field: 'status', from: 'CONFIRMED', to: 'CANCELLED' }] }
        ]
    };
    const secondTransition = appointmentEventTransitionId(reopenedAndCancelledAgain, 'cancelled');
    const secondKey = barberAppointmentEventIdempotency('cancelled', 'profile-a', 'appointment-a', secondTransition);
    assert.equal(secondTransition, 'cancel-2');
    assert.notEqual(secondKey, firstKey);

    const duplicatedSameTransition = {
        ...firstCancellation,
        history: [
            ...firstCancellation.history,
            { _id: 'transition-concurrent', action: 'CANCELLED', changes: [{ field: 'status', from: 'CONFIRMED', to: 'CANCELLED' }] }
        ]
    };
    assert.equal(appointmentEventTransitionId(duplicatedSameTransition, 'cancelled'), 'cancel-1');
});
