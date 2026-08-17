const { NotificationDispatch } = require('../collections/CortsmeModels');
const { notificationQueueSnapshot, notificationJobSnapshot } = require('../queues/notification.queue');

const DISPATCH_STATUSES = new Set(['QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED']);
const ACTIVITY_STATUSES = new Set([
    'QUEUED', 'SCHEDULED', 'PROCESSING', 'PAUSED', 'SENT', 'PARTIAL',
    'COMPLETED', 'FAILED', 'SKIPPED', 'CANCELLED', 'CANCELED'
]);
const DISPATCH_CHANNELS = new Set(['email', 'whatsapp_cloud']);

function escapedRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function appendAnd(filter, clause) {
    filter.$and = [...(filter.$and || []), clause];
}

function dispatchFilter(query = {}, options = {}) {
    const filter = {};
    const status = String(query.status || '').trim().toUpperCase();
    const channel = String(query.channel || '').trim().toLowerCase();
    const search = String(query.search || '').trim().slice(0, 120);
    const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    if (status === 'SCHEDULED') {
        filter.status = 'QUEUED';
        filter.scheduledFor = { $gt: now };
    } else if (status === 'QUEUED') {
        filter.status = 'QUEUED';
        appendAnd(filter, {
            $or: [
                { scheduledFor: null },
                { scheduledFor: { $exists: false } },
                { scheduledFor: { $lte: now } }
            ]
        });
    } else if (DISPATCH_STATUSES.has(status)) {
        filter.status = status;
    } else if (ACTIVITY_STATUSES.has(status)) {
        // Status válidos no NotifyFlow que não possuem equivalente local.
        filter._id = { $exists: false };
    }
    if (DISPATCH_CHANNELS.has(channel)) filter.channels = channel;
    if (search) {
        const pattern = new RegExp(escapedRegex(search), 'i');
        appendAnd(filter, { $or: [
            { templateName: pattern }, { kind: pattern }, { entityType: pattern },
            { entityId: pattern }, { notifyFlowId: pattern }, { jobId: pattern },
            { recipientSummary: pattern }
        ] });
    }
    return filter;
}

function unforwardedDispatchFilter(query = {}, options = {}) {
    const filter = dispatchFilter(query, options);
    appendAnd(filter, {
        $or: [
            { notifyFlowId: '' },
            { notifyFlowId: null },
            { notifyFlowId: { $exists: false } }
        ]
    });
    return filter;
}

function dispatchView(record) {
    const value = record?.toObject ? record.toObject() : { ...record };
    const channels = Array.isArray(value.channels) ? value.channels : [];
    const scheduledAt = value.scheduledFor || null;
    const scheduled = value.status === 'QUEUED' && scheduledAt && new Date(scheduledAt) > new Date();
    const profile = value.profile && typeof value.profile === 'object'
        ? {
            id: String(value.profile._id || value.profile.id),
            businessName: value.profile.businessName || '',
            slug: value.profile.slug || ''
        }
        : value.profile ? { id: String(value.profile) } : null;
    return {
        id: String(value._id || value.id),
        kind: scheduled ? 'schedule' : 'notification',
        dispatchKind: value.kind,
        templateName: value.templateName,
        channels,
        channel: channels.length === 1 ? channels[0] : 'global',
        recipientMasked: value.recipientSummary || 'Destino protegido',
        status: value.status,
        displayStatus: scheduled ? 'SCHEDULED' : value.status,
        scheduledAt,
        relevantDate: scheduledAt || value.updatedAt || value.createdAt,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
        sentAt: value.sentAt || null,
        attempts: Number(value.attempts || 0),
        notifyFlowId: value.notifyFlowId || '',
        responseStatus: value.responseStatus || '',
        error: value.lastError || '',
        entityType: value.entityType,
        entityId: value.entityId,
        profileId: profile?.id || null,
        profile,
        jobId: value.jobId || '',
        metadata: value.metadata || null
    };
}

async function listDispatches(query, pageOptions) {
    const filter = dispatchFilter(query);
    const { page, limit, skip } = pageOptions;
    const [records, total] = await Promise.all([
        NotificationDispatch.find(filter)
            .populate('profile', 'businessName slug')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        NotificationDispatch.countDocuments(filter)
    ]);
    return {
        data: records.map(dispatchView),
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
    };
}

async function getDispatch(id) {
    const record = await NotificationDispatch.findById(id).populate('profile', 'businessName slug').lean();
    if (!record) return null;
    let queue = null;
    let queueError = '';
    try {
        queue = await notificationJobSnapshot(record.jobId);
    } catch (_error) {
        queueError = 'Não foi possível consultar o estado da fila neste momento.';
    }
    return { dispatch: dispatchView(record), queue, queueError };
}

async function getQueueStatus() {
    try {
        return { ...(await notificationQueueSnapshot()), connected: true };
    } catch (_error) {
        return {
            name: process.env.CORTSME_NOTIFICATION_QUEUE || 'cortsme-notifications',
            connected: false,
            error: 'Não foi possível consultar a fila local neste momento.'
        };
    }
}

module.exports = {
    dispatchFilter,
    unforwardedDispatchFilter,
    dispatchView,
    listDispatches,
    getDispatch,
    getQueueStatus
};
