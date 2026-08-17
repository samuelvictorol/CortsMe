const {
    User, BarberProfile, Appointment, Subscription, BillingPayment, NotificationDispatch, SecureLink
} = require('../collections/CortsmeModels');
const { userView } = require('./user.service');
const { createSecureLink } = require('./secure-link.service');
const { createNotification } = require('./notifyflow.service');
const { enqueueNotificationJob, jobIdFor } = require('../queues/notification.queue');
const { encryptText, decryptText } = require('./security.service');

const TEMPLATES = {
    PASSWORD_RESET: 'CortsMeSystemEsqueciSenha',
    BARBER_DAILY: 'CortsMeBarberReminder',
    BARBER_BILLING: 'CortsMeBarberFinanceiro',
    CUSTOMER_APPOINTMENT: 'CortsMeUserReminder',
    BARBER_APPOINTMENT_CREATED: 'CortsMeBarberAppointmentCreated',
    BARBER_APPOINTMENT_CANCELLED: 'CortsMeBarberAppointmentCancelled'
};
const ALLOWED_CHANNELS = ['email', 'whatsapp_cloud'];
const DAY_MS = 24 * 60 * 60 * 1000;

function publicBaseUrl() {
    return String(process.env.CORTSME_PUBLIC_URL || process.env.CHECKOUT_REDIRECT_URL
        || String(process.env.CORS_ORIGIN || 'http://localhost:9000').split(',')[0]).replace(/\/+$/, '').replace(/\/barber\/financeiro$/, '');
}

function publicLink(path) {
    return `${publicBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

function normalizePhone(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) digits = `55${digits}`;
    if (digits.length < 12 || digits.length > 15) return '';
    return `+${digits}`;
}

function validTimezone(value) {
    const timezone = String(value || 'America/Sao_Paulo');
    try {
        new Intl.DateTimeFormat('pt-BR', { timeZone: timezone }).format(new Date());
        return timezone;
    } catch {
        return 'America/Sao_Paulo';
    }
}

function reminderSettings(profile) {
    const raw = profile?.reminderSettings || {};
    const channels = [...new Set((raw.channels || ALLOWED_CHANNELS).filter((item) => ALLOWED_CHANNELS.includes(item)))];
    return {
        enabled: raw.enabled !== false,
        channels: channels.length ? channels : ALLOWED_CHANNELS,
        morningEnabled: raw.morningEnabled !== false,
        morningTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(raw.morningTime || '')) ? raw.morningTime : '07:00',
        timezone: validTimezone(raw.timezone),
        customerRemindersEnabled: raw.customerRemindersEnabled !== false,
        billingRemindersEnabled: raw.billingRemindersEnabled !== false
    };
}

function localParts(date, timezone) {
    const entries = new Intl.DateTimeFormat('en-CA', {
        timeZone: validTimezone(timezone), year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]);
    return Object.fromEntries(entries);
}

function dateKey(parts) {
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function zonedDateToUtc(parts, timezone) {
    const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0);
    let guess = desired;
    for (let iteration = 0; iteration < 3; iteration += 1) {
        const actual = localParts(new Date(guess), timezone);
        const actualComparable = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
        const delta = desired - actualComparable;
        guess += delta;
        if (delta === 0) break;
    }
    return new Date(guess);
}

function localDayBounds(key, timezone) {
    const [year, month, day] = String(key).split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    return {
        start: zonedDateToUtc({ year, month, day, hour: 0, minute: 0, second: 0 }, timezone),
        end: zonedDateToUtc({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate(), hour: 0, minute: 0, second: 0 }, timezone)
    };
}

function formatDateTime(value, timezone) {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: validTimezone(timezone), dateStyle: 'short', timeStyle: 'short'
    }).format(new Date(value));
}

function formatTime(value, timezone) {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: validTimezone(timezone), hour: '2-digit', minute: '2-digit'
    }).format(new Date(value));
}

function maskRecipient(recipient) {
    if (recipient.email) {
        const [name, domain] = recipient.email.split('@');
        return `${String(name || '').slice(0, 2)}***@${domain || '***'}`;
    }
    if (recipient.phone) return `***${recipient.phone.slice(-4)}`;
    return recipient.externalId || 'destinatário';
}

function recipientFromUser(user, { externalId, displayName, phone } = {}) {
    if (!user && !phone) return null;
    const contact = user ? userView(user) : {};
    const whatsappPhone = normalizePhone(contact.whatsappMetaPhone || phone || contact.phone);
    return {
        externalId,
        displayName: displayName || contact.name || 'Cliente CortsMe',
        ...(contact.email ? { email: contact.email } : {}),
        ...(whatsappPhone ? { phone: whatsappPhone } : {})
    };
}

function availableChannels(requested, recipients) {
    const hasEmail = recipients.some((item) => item.email);
    const hasPhone = recipients.some((item) => item.phone);
    return [...new Set((requested || ALLOWED_CHANNELS).filter((channel) => (
        channel === 'email' ? hasEmail : channel === 'whatsapp_cloud' ? hasPhone : false
    )))];
}

async function registerDispatch({
    kind, profileId = null, userId = null, entityType, entityId, idempotencyKey,
    scheduledFor = new Date(), jobName, jobData = {}, channels = ALLOWED_CHANNELS, metadata = null
}) {
    if (kind !== 'PASSWORD_RESET' && !profileId) {
        throw Object.assign(new Error('Toda notificação de negócio deve informar o tenant.'), { code: 'NOTIFICATION_TENANT_REQUIRED' });
    }
    const scheduledDate = new Date(scheduledFor);
    let dispatch = await NotificationDispatch.findOneAndUpdate(
        { idempotencyKey },
        { $setOnInsert: {
            profile: profileId, user: userId, kind, entityType, entityId: String(entityId),
            templateName: TEMPLATES[kind], channels, idempotencyKey,
            scheduledFor: scheduledDate, metadata, status: 'QUEUED'
        } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    if (dispatch.status === 'SENT') return dispatch;
    if (['SKIPPED', 'FAILED'].includes(dispatch.status) && scheduledDate > new Date()) {
        dispatch.status = 'QUEUED';
        dispatch.lastError = '';
        dispatch.scheduledFor = scheduledDate;
        await dispatch.save();
    }
    if (dispatch.status !== 'QUEUED') return dispatch;
    const jobId = jobIdFor(idempotencyKey);
    try {
        await enqueueNotificationJob(jobName, { ...jobData, dispatchId: String(dispatch._id) }, {
            jobId,
            key: idempotencyKey,
            delay: Math.max(0, scheduledDate.getTime() - Date.now())
        });
    } catch (error) {
        dispatch.lastError = `Fila indisponível: ${String(error.message || error).slice(0, 430)}`;
        await dispatch.save();
        console.warn(`Notification job could not be queued (${jobName}/${jobId}): ${error.message}`);
        return dispatch;
    }
    if (dispatch.jobId !== jobId || dispatch.lastError) {
        dispatch.jobId = jobId;
        dispatch.lastError = '';
        await dispatch.save();
    }
    return dispatch;
}

async function skipDispatch(dispatch, reason) {
    if (!dispatch || dispatch.status === 'SENT') return;
    dispatch.status = 'SKIPPED';
    dispatch.lastError = String(reason || 'Condição de envio não atendida.').slice(0, 500);
    await dispatch.save();
}

async function deliver(dispatch, { recipients, title, body, channels, metadata = {} }) {
    if (!dispatch || ['SENT', 'SKIPPED'].includes(dispatch.status)) return { skipped: true };
    const validRecipients = (recipients || []).filter((item) => item && item.externalId && (item.email || item.phone));
    const validChannels = availableChannels(channels || dispatch.channels, validRecipients);
    if (!validRecipients.length || !validChannels.length) {
        await skipDispatch(dispatch, 'Destinatário sem e-mail ou WhatsApp válido.');
        return { skipped: true };
    }
    dispatch.status = 'PROCESSING';
    dispatch.channels = validChannels;
    dispatch.attempts += 1;
    dispatch.recipientSummary = validRecipients.map(maskRecipient).join(', ').slice(0, 240);
    await dispatch.save();
    try {
        const profileId = dispatch.profile ? String(dispatch.profile) : 'system';
        const result = await createNotification({
            templateName: dispatch.templateName,
            channels: validChannels,
            recipients: validRecipients,
            variables: { title_description: String(title || ''), body_description: String(body || '') },
            idempotencyKey: dispatch.idempotencyKey,
            metadata: {
                source: 'CORTSME', tenantId: profileId, profileId,
                entityType: dispatch.entityType, entityId: dispatch.entityId,
                ...metadata
            }
        });
        const notifyFlowResult = result?.data || result?.notification || result || {};
        dispatch.status = 'SENT';
        dispatch.notifyFlowId = String(notifyFlowResult.id || notifyFlowResult._id || '');
        dispatch.responseStatus = String(notifyFlowResult.status || 'accepted');
        dispatch.sentAt = new Date();
        dispatch.lastError = '';
        await dispatch.save();
        return result;
    } catch (error) {
        dispatch.status = 'FAILED';
        dispatch.lastError = String(error.code || error.message || 'Falha no NotifyFlow').slice(0, 500);
        await dispatch.save();
        throw error;
    }
}

async function enqueuePasswordReset({ user, token, accountType }) {
    const entityId = String(user._id);
    return registerDispatch({
        kind: 'PASSWORD_RESET', userId: user._id,
        entityType: 'user', entityId,
        idempotencyKey: `cortsme:password-reset:${entityId}:${Date.now()}`,
        jobName: 'password-reset', jobData: { userId: entityId, tokenEncrypted: encryptText(token), accountType },
        scheduledFor: new Date()
    });
}

async function processPasswordReset(job, dispatch) {
    const user = await User.findOne({ _id: job.data.userId, active: true });
    if (!user || user.provider === 'google') return skipDispatch(dispatch, 'Conta indisponível para redefinição local.');
    const recipient = recipientFromUser(user, { externalId: `user:${user._id}` });
    const label = user.role === 'BARBER' ? 'profissional' : 'cliente';
    const token = decryptText(job.data.tokenEncrypted);
    if (!token) return skipDispatch(dispatch, 'Token de redefinição indisponível.');
    const link = publicLink(`/redefinir-senha/${encodeURIComponent(token)}`);
    return deliver(dispatch, {
        recipients: [recipient], channels: ALLOWED_CHANNELS,
        title: 'Redefina sua senha do CortsMe',
        body: `Olá, ${user.name}. Recebemos um pedido para redefinir a senha da sua conta de ${label}. Use este link em até 60 minutos: ${link}. Se não foi você, ignore esta mensagem.`,
        metadata: { role: user.role }
    });
}

function appointmentIdempotency(profileId, appointmentId, expectedStart, offsetMinutes) {
    return `cortsme:appointment:${profileId}:${appointmentId}:${new Date(expectedStart).getTime()}:${offsetMinutes}`;
}

function recipientFromBarberProfile(profile) {
    if (!profile?.owner) return null;
    const profileId = String(profile._id);
    return recipientFromUser(profile.owner, {
        externalId: `barber:${profileId}:${profile.owner._id}`
    });
}

function appointmentEventTransitionId(appointment, event) {
    const history = Array.from(appointment?.history || []);
    if (event === 'created' && history.some((entry) => entry?.action === 'CREATED')) return 'created-1';
    if (event === 'cancelled') {
        let currentStatus = null;
        let generation = 0;
        for (const entry of history) {
            const statusChange = Array.from(entry?.changes || []).find((change) => change.field === 'status');
            if (!statusChange) continue;
            if (currentStatus === null) currentStatus = statusChange.from || null;
            if (statusChange.to === 'CANCELLED' && currentStatus !== 'CANCELLED') generation += 1;
            currentStatus = statusChange.to || currentStatus;
        }
        // O ordinal colapsa duas requisições concorrentes que observaram a
        // mesma origem CONFIRMED, mas avança após uma reabertura real.
        if (generation > 0) return `cancel-${generation}`;
    }
    // Compatibilidade defensiva para registros legados sem histórico. Todos
    // os fluxos atuais gravam a transição antes de enfileirar o evento.
    return event === 'created' ? 'initial' : `legacy-${new Date(appointment?.updatedAt || appointment?.start || 0).getTime()}`;
}

function barberAppointmentEventIdempotency(event, profileId, appointmentId, transitionId) {
    return `cortsme:barber-appointment-${event}:${profileId}:${appointmentId}:${transitionId}`;
}

async function enqueueBarberAppointmentEvent(appointment, event, options = {}) {
    if (!['created', 'cancelled'].includes(event)) {
        throw Object.assign(new Error('Evento de agendamento inválido.'), { code: 'APPOINTMENT_EVENT_INVALID' });
    }
    const profileId = String(appointment.profile?._id || appointment.profile || '');
    const appointmentId = String(appointment._id || '');
    if (!profileId || !appointmentId) {
        throw Object.assign(new Error('Evento de agendamento sem tenant ou agendamento.'), { code: 'APPOINTMENT_EVENT_TENANT_REQUIRED' });
    }
    const kind = event === 'created' ? 'BARBER_APPOINTMENT_CREATED' : 'BARBER_APPOINTMENT_CANCELLED';
    const jobName = event === 'created' ? 'barber-appointment-created' : 'barber-appointment-cancelled';
    const transitionId = appointmentEventTransitionId(appointment, event);
    return registerDispatch({
        kind,
        profileId,
        entityType: 'appointment',
        entityId: appointmentId,
        idempotencyKey: barberAppointmentEventIdempotency(event, profileId, appointmentId, transitionId),
        scheduledFor: new Date(),
        jobName,
        jobData: {
            profileId,
            appointmentId,
            expectedStart: new Date(appointment.start).toISOString(),
            transitionId,
            ...(options.changedBy ? { changedBy: String(options.changedBy) } : {})
        },
        channels: ALLOWED_CHANNELS,
        metadata: { event, transitionId, appointmentStart: new Date(appointment.start).toISOString() }
    });
}

async function enqueueBarberAppointmentCreated(appointment, options) {
    return enqueueBarberAppointmentEvent(appointment, 'created', options);
}

async function enqueueBarberAppointmentCancelled(appointment, options) {
    return enqueueBarberAppointmentEvent(appointment, 'cancelled', options);
}

async function scheduleAppointmentReminders(appointment) {
    const profileId = String(appointment.profile?._id || appointment.profile);
    const appointmentId = String(appointment._id);
    const expectedStart = new Date(appointment.start);
    if (!profileId || !appointmentId || Number.isNaN(expectedStart.getTime())) return [];
    const offsets = [1440, 60];
    const keys = offsets.map((offset) => appointmentIdempotency(profileId, appointmentId, expectedStart, offset));
    await NotificationDispatch.updateMany(
        { kind: 'CUSTOMER_APPOINTMENT', profile: profileId, entityId: appointmentId, status: 'QUEUED', idempotencyKey: { $nin: keys } },
        { $set: { status: 'SKIPPED', lastError: 'Agendamento alterado; lembrete antigo invalidado.' } }
    );
    if (appointment.status === 'CANCELLED') {
        await cancelAppointmentReminders(profileId, appointmentId);
        return [];
    }
    const created = [];
    for (const offsetMinutes of offsets) {
        const scheduledFor = new Date(expectedStart.getTime() - offsetMinutes * 60000);
        if (scheduledFor <= new Date()) continue;
        created.push(await registerDispatch({
            kind: 'CUSTOMER_APPOINTMENT', profileId, userId: appointment.user || null,
            entityType: 'appointment', entityId: appointmentId,
            idempotencyKey: appointmentIdempotency(profileId, appointmentId, expectedStart, offsetMinutes),
            scheduledFor, jobName: 'appointment-reminder',
            jobData: { profileId, appointmentId, expectedStart: expectedStart.toISOString(), offsetMinutes }
        }));
    }
    return created;
}

async function cancelAppointmentReminders(profileId, appointmentId) {
    const now = new Date();
    const [dispatches] = await Promise.all([
        NotificationDispatch.updateMany(
            { kind: 'CUSTOMER_APPOINTMENT', profile: profileId, entityId: String(appointmentId), status: { $in: ['QUEUED', 'FAILED'] } },
            { $set: { status: 'SKIPPED', lastError: 'Agendamento cancelado ou removido.' } }
        ),
        SecureLink.updateMany(
            { purpose: 'APPOINTMENT_ACTION', profile: profileId, appointment: appointmentId, consumedAt: null, revokedAt: null },
            { $set: { revokedAt: now } }
        )
    ]);
    return dispatches;
}

async function revokeAppointmentLinks(profileId, appointmentId) {
    return SecureLink.updateMany(
        { purpose: 'APPOINTMENT_ACTION', profile: profileId, appointment: appointmentId, consumedAt: null, revokedAt: null },
        { $set: { revokedAt: new Date() } }
    );
}

async function processAppointmentReminder(job, dispatch) {
    const { profileId, appointmentId, expectedStart, offsetMinutes } = job.data;
    const [appointment, profile] = await Promise.all([
        Appointment.findOne({ _id: appointmentId, profile: profileId }).populate('user'),
        BarberProfile.findById(profileId)
    ]);
    if (!appointment || !profile?.active || appointment.status === 'CANCELLED') return skipDispatch(dispatch, 'Agendamento indisponível ou cancelado.');
    if (appointment.user && !appointment.user.active) return skipDispatch(dispatch, 'Conta do cliente está inativa.');
    if (new Date(appointment.start).getTime() !== new Date(expectedStart).getTime()) return skipDispatch(dispatch, 'Horário do agendamento foi alterado.');
    if (appointment.start <= new Date()) return skipDispatch(dispatch, 'O horário do agendamento já passou.');
    const settings = reminderSettings(profile);
    if (!settings.enabled || !settings.customerRemindersEnabled) return skipDispatch(dispatch, 'Lembretes de clientes desativados pelo profissional.');
    const recipient = appointment.user
        ? recipientFromUser(appointment.user, { externalId: `customer:${profileId}:${appointment.user._id}` })
        : recipientFromUser(null, {
            externalId: `manual-customer:${profileId}:${appointment._id}`,
            displayName: appointment.customerName || 'Cliente', phone: appointment.customerPhone
        });
    const secure = await createSecureLink({
        purpose: 'APPOINTMENT_ACTION', userId: appointment.user?._id || null,
        profileId, appointmentId, expiresInSeconds: Math.max(3600, Math.ceil((appointment.start.getTime() - Date.now()) / 1000) + 86400),
        metadata: { expectedStart: appointment.start.toISOString() }
    });
    const link = publicLink(`/agendamento/${encodeURIComponent(secure.token)}`);
    const lead = Number(offsetMinutes) === 60 ? '1 hora' : '24 horas';
    return deliver(dispatch, {
        recipients: [recipient], channels: settings.channels,
        title: `Seu agendamento é em ${lead}`,
        body: `${appointment.customerName || appointment.user?.name || 'Olá'}: ${appointment.serviceName} na ${profile.businessName}, em ${formatDateTime(appointment.start, settings.timezone)}. Confirme ou cancele com segurança: ${link}`,
        metadata: { appointmentStart: appointment.start.toISOString(), reminderOffsetMinutes: Number(offsetMinutes) }
    });
}

async function processBarberAppointmentEvent(job, dispatch, event) {
    const { profileId, appointmentId, expectedStart } = job.data;
    const [appointment, profile] = await Promise.all([
        Appointment.findOne({ _id: appointmentId, profile: profileId }).populate('user'),
        BarberProfile.findOne({ _id: profileId }).populate('owner')
    ]);
    if (!appointment || !profile?.active || !profile.owner?.active) {
        return skipDispatch(dispatch, 'Agendamento ou perfil profissional indisponível neste tenant.');
    }
    if (new Date(appointment.start).getTime() !== new Date(expectedStart).getTime()) {
        return skipDispatch(dispatch, 'Horário do agendamento foi alterado antes do aviso.');
    }
    if (event === 'created' && appointment.status === 'CANCELLED') {
        return skipDispatch(dispatch, 'Agendamento cancelado antes do aviso de criação.');
    }
    if (event === 'cancelled' && appointment.status !== 'CANCELLED') {
        return skipDispatch(dispatch, 'O agendamento não está cancelado.');
    }
    if (job.data.transitionId && appointmentEventTransitionId(appointment, event) !== String(job.data.transitionId)) {
        return skipDispatch(dispatch, 'A transição do agendamento foi substituída antes do aviso.');
    }
    const recipient = recipientFromBarberProfile(profile);
    const settings = reminderSettings(profile);
    const customer = appointment.user ? userView(appointment.user) : null;
    const customerName = appointment.customerName || customer?.name || 'Cliente';
    const localDate = dateKey(localParts(appointment.start, settings.timezone));
    const link = publicLink(`/barber/calendario?date=${encodeURIComponent(localDate)}`);
    const cancelled = event === 'cancelled';
    return deliver(dispatch, {
        recipients: [recipient],
        channels: ALLOWED_CHANNELS,
        title: cancelled ? 'Agendamento cancelado pelo cliente' : 'Novo agendamento recebido',
        body: `${customerName} ${cancelled ? 'cancelou' : 'agendou'} ${appointment.serviceName} para ${formatDateTime(appointment.start, settings.timezone)} em ${profile.businessName}. Consulte sua agenda: ${link}`,
        metadata: {
            appointmentStart: appointment.start.toISOString(),
            appointmentEvent: event,
            transitionId: job.data.transitionId || appointmentEventTransitionId(appointment, event),
            customerId: appointment.user ? String(appointment.user._id) : null
        }
    });
}

function billingIdempotency(profileId, expectedPeriodEnd, daysBefore) {
    return `cortsme:billing:${profileId}:${new Date(expectedPeriodEnd).getTime()}:${daysBefore}`;
}

async function scheduleBillingReminders(profileId, periodEnd) {
    const expectedEnd = new Date(periodEnd);
    if (!profileId || Number.isNaN(expectedEnd.getTime())) return [];
    const offsets = [7, 1];
    const keys = offsets.map((days) => billingIdempotency(profileId, expectedEnd, days));
    await NotificationDispatch.updateMany(
        { kind: 'BARBER_BILLING', profile: profileId, status: 'QUEUED', idempotencyKey: { $nin: keys } },
        { $set: { status: 'SKIPPED', lastError: 'Vencimento da assinatura alterado.' } }
    );
    const created = [];
    for (const daysBefore of offsets) {
        const scheduledFor = new Date(expectedEnd.getTime() - daysBefore * DAY_MS);
        if (scheduledFor <= new Date()) continue;
        created.push(await registerDispatch({
            kind: 'BARBER_BILLING', profileId, entityType: 'subscription', entityId: String(profileId),
            idempotencyKey: billingIdempotency(profileId, expectedEnd, daysBefore),
            scheduledFor, jobName: 'billing-reminder',
            jobData: { profileId: String(profileId), expectedPeriodEnd: expectedEnd.toISOString(), daysBefore }
        }));
    }
    return created;
}

async function processBillingReminder(job, dispatch) {
    const { profileId, expectedPeriodEnd, daysBefore } = job.data;
    const [profile, subscription, lastPayment] = await Promise.all([
        BarberProfile.findById(profileId).populate('owner'),
        Subscription.findOne({ profile: profileId }).populate('plan'),
        BillingPayment.findOne({ profile: profileId, status: 'PAID' }).sort({ paidAt: -1 }).populate('plan')
    ]);
    if (!profile?.active || !subscription || !profile.owner?.active) return skipDispatch(dispatch, 'Assinatura ou perfil não encontrado ou inativo.');
    if (subscription.status !== 'ACTIVE' || !subscription.periodEnd
        || new Date(subscription.periodEnd).getTime() !== new Date(expectedPeriodEnd).getTime()) {
        return skipDispatch(dispatch, 'Assinatura renovada, expirada ou alterada.');
    }
    const settings = reminderSettings(profile);
    if (!settings.enabled || !settings.billingRemindersEnabled) return skipDispatch(dispatch, 'Lembretes financeiros desativados.');
    const recipient = recipientFromBarberProfile(profile);
    const secure = await createSecureLink({
        purpose: 'FINANCE_ACCESS', userId: profile.owner._id, profileId,
        expiresInSeconds: Math.max(2 * DAY_MS / 1000, Number(daysBefore) * DAY_MS / 1000 + 2 * DAY_MS / 1000),
        metadata: { expectedPeriodEnd: subscription.periodEnd.toISOString() }
    });
    const link = publicLink(`/financeiro/${encodeURIComponent(secure.token)}`);
    const lastPaymentText = lastPayment
        ? `Último pagamento: R$ ${(lastPayment.amountCents / 100).toFixed(2).replace('.', ',')} em ${formatDateTime(lastPayment.paidAt || lastPayment.createdAt, settings.timezone)}.`
        : 'Ainda não há pagamento confirmado neste ciclo.';
    return deliver(dispatch, {
        recipients: [recipient], channels: settings.channels,
        title: `Seu plano CortsMe vence em ${daysBefore} ${Number(daysBefore) === 1 ? 'dia' : 'dias'}`,
        body: `${profile.businessName}: plano ${subscription.plan?.name || 'atual'} válido até ${formatDateTime(subscription.periodEnd, settings.timezone)}. ${lastPaymentText} Confira os dados e gere seu link de renovação ou upgrade: ${link}`,
        metadata: { periodEnd: subscription.periodEnd.toISOString(), reminderDaysBefore: Number(daysBefore) }
    });
}

async function enqueueBarberDaily(profile, localDate) {
    const profileId = String(profile._id);
    const settings = reminderSettings(profile);
    return registerDispatch({
        kind: 'BARBER_DAILY', profileId, userId: profile.owner,
        entityType: 'barber_daily_agenda', entityId: `${profileId}:${localDate}`,
        idempotencyKey: `cortsme:barber-daily:${profileId}:${localDate}`,
        scheduledFor: new Date(), jobName: 'barber-daily-reminder',
        jobData: { profileId, localDate }, channels: settings.channels
    });
}

async function processBarberDaily(job, dispatch) {
    const { profileId, localDate } = job.data;
    const profile = await BarberProfile.findById(profileId).populate('owner');
    if (!profile?.active || !profile.owner?.active) return skipDispatch(dispatch, 'Perfil profissional não encontrado ou inativo.');
    const settings = reminderSettings(profile);
    if (!settings.enabled || !settings.morningEnabled) return skipDispatch(dispatch, 'Resumo diário desativado.');
    if (dateKey(localParts(new Date(), settings.timezone)) !== localDate) return skipDispatch(dispatch, 'A data local deste resumo já passou.');
    const bounds = localDayBounds(localDate, settings.timezone);
    const appointments = await Appointment.find({
        profile: profile._id,
        start: { $gte: bounds.start, $lt: bounds.end },
        status: { $nin: ['CANCELLED'] }
    }).populate('user').sort({ start: 1 }).lean();
    if (!appointments.length) return skipDispatch(dispatch, 'Nenhum agendamento para o dia.');
    const recipient = recipientFromBarberProfile(profile);
    const visible = appointments.slice(0, 20).map((item) => {
        const customer = item.user ? userView(item.user).name : item.customerName || 'Cliente';
        return `${formatTime(item.start, settings.timezone)} — ${customer} — ${item.serviceName}`;
    });
    if (appointments.length > visible.length) visible.push(`+ ${appointments.length - visible.length} agendamentos no calendário.`);
    const link = publicLink(`/barber/calendario?date=${encodeURIComponent(localDate)}`);
    return deliver(dispatch, {
        recipients: [recipient], channels: settings.channels,
        title: `${appointments.length} ${appointments.length === 1 ? 'agendamento' : 'agendamentos'} hoje`,
        body: `${profile.businessName}, sua agenda de hoje:\n${visible.join('\n')}\nAbra o calendário: ${link}`,
        metadata: { localDate, appointmentCount: appointments.length }
    });
}

async function reconcileReminders() {
    const now = new Date();
    const appointmentHorizon = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const billingHorizon = new Date(now.getTime() + 8 * DAY_MS);
    const [appointments, subscriptions, profiles] = await Promise.all([
        Appointment.find({ start: { $gt: now, $lte: appointmentHorizon }, status: { $ne: 'CANCELLED' } }).select('_id profile user start status').lean(),
        Subscription.find({ status: 'ACTIVE', periodEnd: { $gt: now, $lte: billingHorizon } }).select('profile periodEnd').lean(),
        BarberProfile.find({ active: true, 'reminderSettings.enabled': { $ne: false }, 'reminderSettings.morningEnabled': { $ne: false } })
            .select('_id owner reminderSettings').lean()
    ]);
    for (const appointment of appointments) await scheduleAppointmentReminders(appointment);
    for (const subscription of subscriptions) await scheduleBillingReminders(subscription.profile, subscription.periodEnd);
    for (const profile of profiles) {
        const settings = reminderSettings(profile);
        const parts = localParts(now, settings.timezone);
        const currentMinutes = parts.hour * 60 + parts.minute;
        const [hour, minute] = settings.morningTime.split(':').map(Number);
        const targetMinutes = hour * 60 + minute;
        if (currentMinutes >= targetMinutes && currentMinutes < targetMinutes + 60) {
            await enqueueBarberDaily(profile, dateKey(parts));
        }
    }
    return { appointments: appointments.length, subscriptions: subscriptions.length, profiles: profiles.length };
}

async function processNotificationJob(job) {
    if (job.name === 'reconcile-reminders') return reconcileReminders();
    if (job.name === 'billing-sweep') return require('./billing.service').sweepExpiredSubscriptions();
    const dispatch = await NotificationDispatch.findById(job.data.dispatchId);
    if (!dispatch || ['SENT', 'SKIPPED'].includes(dispatch.status)) return { skipped: true };
    const dispatchProfile = dispatch.profile ? String(dispatch.profile) : null;
    if (job.data.profileId && dispatchProfile !== String(job.data.profileId)) {
        return skipDispatch(dispatch, 'Job rejeitado por divergência de tenant.');
    }
    if (job.name === 'password-reset' && String(dispatch.user || '') !== String(job.data.userId || '')) {
        return skipDispatch(dispatch, 'Job rejeitado por divergência de usuário.');
    }
    if (job.name === 'appointment-reminder' && dispatch.entityId !== String(job.data.appointmentId || '')) {
        return skipDispatch(dispatch, 'Job rejeitado por divergência de agendamento.');
    }
    if (job.name === 'billing-reminder' && dispatch.entityId !== String(job.data.profileId || '')) {
        return skipDispatch(dispatch, 'Job rejeitado por divergência de assinatura.');
    }
    if (job.name === 'barber-daily-reminder' && dispatch.entityId !== `${job.data.profileId}:${job.data.localDate}`) {
        return skipDispatch(dispatch, 'Job rejeitado por divergência de agenda diária.');
    }
    if (['barber-appointment-created', 'barber-appointment-cancelled'].includes(job.name)
        && dispatch.entityId !== String(job.data.appointmentId || '')) {
        return skipDispatch(dispatch, 'Job rejeitado por divergência de agendamento do profissional.');
    }
    if (job.name === 'password-reset') return processPasswordReset(job, dispatch);
    if (job.name === 'appointment-reminder') return processAppointmentReminder(job, dispatch);
    if (job.name === 'billing-reminder') return processBillingReminder(job, dispatch);
    if (job.name === 'barber-daily-reminder') return processBarberDaily(job, dispatch);
    if (job.name === 'barber-appointment-created') return processBarberAppointmentEvent(job, dispatch, 'created');
    if (job.name === 'barber-appointment-cancelled') return processBarberAppointmentEvent(job, dispatch, 'cancelled');
    return skipDispatch(dispatch, `Job desconhecido: ${job.name}`);
}

module.exports = {
    TEMPLATES,
    publicBaseUrl,
    publicLink,
    normalizePhone,
    recipientFromUser,
    recipientFromBarberProfile,
    appointmentEventTransitionId,
    barberAppointmentEventIdempotency,
    reminderSettings,
    localParts,
    localDayBounds,
    enqueuePasswordReset,
    enqueueBarberAppointmentCreated,
    enqueueBarberAppointmentCancelled,
    scheduleAppointmentReminders,
    cancelAppointmentReminders,
    revokeAppointmentLinks,
    scheduleBillingReminders,
    enqueueBarberDaily,
    reconcileReminders,
    processNotificationJob,
    registerDispatch,
    deliver
};
