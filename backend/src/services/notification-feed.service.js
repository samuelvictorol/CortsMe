const { NotificationDispatch } = require('../collections/CortsmeModels');
const { getActivity } = require('./notifyflow.service');
const {
    dispatchFilter,
    unforwardedDispatchFilter,
    dispatchView
} = require('./notification-admin.service');

const REMOTE_PAGE_LIMIT = 100;
const REMOTE_WINDOW_LIMIT = 1000;

function activityPayload(payload) {
    const value = payload?.data && !Array.isArray(payload.data) && payload.data.items
        ? payload.data
        : payload || {};
    const items = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(value.items)
            ? value.items
            : Array.isArray(value.activity)
                ? value.activity
                : [];
    return {
        items,
        pagination: payload?.pagination || value.pagination || payload?.meta || value.meta || {}
    };
}

function remoteQuery(query = {}) {
    const status = String(query.status || '').trim().toLowerCase();
    const normalizedStatus = status === 'canceled' ? 'cancelled' : status;
    return {
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
        ...(query.channel ? { channel: String(query.channel).trim().toLowerCase() } : {}),
        ...(query.search ? { search: String(query.search).trim().slice(0, 120) } : {})
    };
}

function activityKey(item) {
    return `${String(item?.type || item?.kind || 'notification')}:${String(item?.id || item?._id || '')}`;
}

async function fetchRemotePrefix(query, target, fetchActivity = getActivity) {
    if (target < 1) return { items: [], total: 0 };
    const items = [];
    const seen = new Set();
    let total = 0;
    let firstWindow = true;
    let to;

    while (items.length < target) {
        const remaining = target - items.length;
        const windowTarget = Math.min(REMOTE_WINDOW_LIMIT, remaining);
        const pageLimit = Math.min(REMOTE_PAGE_LIMIT, windowTarget);
        const params = { ...query, ...(to ? { to } : {}), page: 1, limit: pageLimit };
        const first = activityPayload(await fetchActivity(params));
        if (firstWindow) total = Number(first.pagination.total ?? first.items.length);
        firstWindow = false;

        const windowItems = [...first.items];
        const availablePages = Math.max(1, Number(first.pagination.pages || 1));
        const wantedPages = Math.min(
            availablePages,
            Math.ceil(windowTarget / pageLimit),
            Math.ceil(REMOTE_WINDOW_LIMIT / pageLimit)
        );
        for (let page = 2; page <= wantedPages; page += 1) {
            const payload = activityPayload(await fetchActivity({ ...params, page }));
            windowItems.push(...payload.items);
            if (!payload.items.length) break;
        }

        for (const item of windowItems) {
            const key = activityKey(item);
            if (!key.endsWith(':') && !seen.has(key)) {
                seen.add(key);
                items.push(item);
                if (items.length >= target) break;
            }
        }
        if (items.length >= target || windowItems.length < windowTarget) break;

        const dated = windowItems.filter((item) => item?.createdAt && !Number.isNaN(new Date(item.createdAt).getTime()));
        if (!dated.length) break;
        const lastTimestamp = Math.min(...dated.map((item) => new Date(item.createdAt).getTime()));
        const nextTo = new Date(lastTimestamp - 1).toISOString();
        if (nextTo === to) break;
        to = nextTo;
    }

    return { items: items.slice(0, target), total };
}

async function fetchLocalPrefix(model, filter, target) {
    const [records, total] = await Promise.all([
        model.find(filter)
            .populate('profile', 'businessName slug')
            .sort({ createdAt: -1, _id: -1 })
            .limit(target)
            .lean(),
        model.countDocuments(filter)
    ]);
    return { records, total };
}

function remoteActivityView(item, linkedDispatch = null) {
    const local = linkedDispatch ? dispatchView(linkedDispatch) : null;
    const metadata = item.metadata || local?.metadata || {};
    const type = item.type === 'schedule' || item.kind === 'schedule' ? 'schedule' : 'notification';
    const id = String(item.id || item._id || '');
    const channels = Array.isArray(item.channels) && item.channels.length
        ? item.channels
        : local?.channels || (item.channel ? [item.channel] : []);
    return {
        ...(local || {}),
        id,
        localId: local?.id || '',
        source: local ? 'combined' : 'remote',
        kind: type,
        templateName: item.templateName || local?.templateName || 'Template CortsMe',
        channels,
        channel: item.channel || local?.channel || (channels.length > 1 ? 'global' : channels[0]) || '',
        recipientMasked: item.recipientMasked || local?.recipientMasked || 'Destino protegido',
        status: item.status || local?.status || 'queued',
        displayStatus: item.status || local?.displayStatus || local?.status || 'queued',
        scheduledAt: item.scheduledAt || local?.scheduledAt || null,
        relevantDate: item.scheduledAt || item.deliveredAt || item.processedAt || item.createdAt || local?.relevantDate,
        createdAt: item.createdAt || local?.createdAt,
        updatedAt: item.updatedAt || item.processedAt || item.deliveredAt || item.createdAt || local?.updatedAt,
        sentAt: item.deliveredAt || local?.sentAt || null,
        notifyFlowId: id,
        error: typeof item.error === 'string' ? item.error : item.error?.message || local?.error || '',
        entityType: local?.entityType || metadata.entityType || '',
        entityId: local?.entityId || metadata.entityId || '',
        profileId: local?.profileId || metadata.profileId || metadata.tenantId || '',
        profile: local?.profile || null,
        metadata,
        remoteQueue: item.queue || null
    };
}

function newestFirst(left, right) {
    const dateDelta = new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    return dateDelta || String(right.id || '').localeCompare(String(left.id || ''));
}

function createNotificationFeedService(dependencies = {}) {
    const deps = {
        NotificationDispatch,
        getActivity,
        ...dependencies
    };

    return async function listCombinedActivity(query = {}, pageOptions = {}) {
        const page = Math.max(1, Number(pageOptions.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(pageOptions.limit) || 20));
        const target = page * limit;
        const offset = (page - 1) * limit;
        const now = dependencies.now instanceof Date ? dependencies.now : new Date(dependencies.now || Date.now());
        let remote;

        try {
            remote = await fetchRemotePrefix(remoteQuery(query), target, deps.getActivity);
        } catch (_error) {
            const fallback = await fetchLocalPrefix(
                deps.NotificationDispatch,
                dispatchFilter(query, { now }),
                target
            );
            const data = fallback.records.map((record) => ({
                ...dispatchView(record),
                source: 'local',
                localId: String(record._id || record.id)
            })).slice(offset, offset + limit);
            return {
                data,
                pagination: {
                    page,
                    limit,
                    total: fallback.total,
                    pages: Math.max(1, Math.ceil(fallback.total / limit))
                },
                integration: {
                    remoteAvailable: false,
                    warning: 'O NotifyFlow está indisponível; exibindo somente registros locais do CortsMe.'
                }
            };
        }

        const localFilter = unforwardedDispatchFilter(query, { now });
        const local = await fetchLocalPrefix(deps.NotificationDispatch, localFilter, target);
        const remoteIds = remote.items.map((item) => String(item.id || item._id || '')).filter(Boolean);
        const linkedRecords = remoteIds.length
            ? await deps.NotificationDispatch.find({ notifyFlowId: { $in: remoteIds } })
                .populate('profile', 'businessName slug')
                .lean()
            : [];
        const linkedByRemoteId = new Map(linkedRecords.map((record) => [String(record.notifyFlowId), record]));
        const localRows = local.records.map((record) => ({
            ...dispatchView(record),
            source: 'local',
            localId: String(record._id || record.id)
        }));
        const remoteRows = remote.items.map((item) => remoteActivityView(
            item,
            linkedByRemoteId.get(String(item.id || item._id || '')) || null
        ));
        const combined = [...localRows, ...remoteRows].sort(newestFirst);
        const total = Number(local.total || 0) + Number(remote.total || 0);

        return {
            data: combined.slice(offset, offset + limit),
            pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
            integration: { remoteAvailable: true, warning: '' }
        };
    };
}

module.exports = {
    activityPayload,
    remoteQuery,
    fetchRemotePrefix,
    remoteActivityView,
    createNotificationFeedService,
    listCombinedActivity: createNotificationFeedService()
};
