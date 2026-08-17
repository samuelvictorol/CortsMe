const test = require('node:test');
const assert = require('node:assert/strict');

const {
    fetchRemotePrefix,
    createNotificationFeedService
} = require('../src/services/notification-feed.service');

function queryResult(records) {
    let limit = records.length;
    return {
        populate() { return this; },
        sort() { return this; },
        limit(value) { limit = value; return this; },
        lean: async () => records.slice(0, limit)
    };
}

function dispatch(id, createdAt, overrides = {}) {
    return {
        _id: id,
        kind: 'CUSTOMER_APPOINTMENT',
        templateName: 'CortsMeUserReminder',
        channels: ['email'],
        status: 'QUEUED',
        scheduledFor: createdAt,
        createdAt,
        updatedAt: createdAt,
        notifyFlowId: '',
        entityType: 'appointment',
        entityId: id,
        ...overrides
    };
}

function remote(id, createdAt, overrides = {}) {
    return {
        id,
        type: 'notification',
        templateName: 'CortsMeUserReminder',
        channel: 'email',
        status: 'sent',
        createdAt,
        ...overrides
    };
}

function remoteLister(records, captured = []) {
    return async (params) => {
        captured.push(params);
        const start = (params.page - 1) * params.limit;
        return {
            success: true,
            data: records.slice(start, start + params.limit),
            pagination: {
                page: params.page,
                limit: params.limit,
                total: records.length,
                pages: Math.max(1, Math.ceil(records.length / params.limit))
            }
        };
    };
}

test('overfetch remoto busca o prefixo global necessário antes de paginar', async () => {
    const records = Array.from({ length: 130 }, (_, index) => remote(
        String(index + 1).padStart(24, '0'),
        new Date(Date.UTC(2026, 7, 16, 12, 0, 0) - index * 1000).toISOString()
    ));
    const calls = [];
    const result = await fetchRemotePrefix({}, 120, remoteLister(records, calls));
    assert.equal(result.items.length, 120);
    assert.equal(result.total, 130);
    assert.deepEqual(calls.map((call) => call.page), [1, 2]);
    assert.equal(calls[0].limit, 100);
});

test('feed combinado pagina depois do merge e não perde itens entre as fontes', async () => {
    const localRecords = [
        dispatch('local-a', '2026-08-16T10:00:00.000Z'),
        dispatch('local-b', '2026-08-16T08:00:00.000Z')
    ];
    const remoteRecords = [
        remote('507f1f77bcf86cd799439011', '2026-08-16T09:00:00.000Z'),
        remote('507f1f77bcf86cd799439012', '2026-08-16T07:00:00.000Z')
    ];
    const filters = [];
    const model = {
        find(filter) {
            filters.push(filter);
            return queryResult(filter.notifyFlowId?.$in ? [] : localRecords);
        },
        countDocuments: async () => localRecords.length
    };
    const list = createNotificationFeedService({
        NotificationDispatch: model,
        getActivity: remoteLister(remoteRecords),
        now: new Date('2026-08-16T06:00:00.000Z')
    });

    const first = await list({}, { page: 1, limit: 2 });
    const second = await list({}, { page: 2, limit: 2 });
    assert.deepEqual(first.data.map((item) => item.id), ['local-a', '507f1f77bcf86cd799439011']);
    assert.deepEqual(second.data.map((item) => item.id), ['local-b', '507f1f77bcf86cd799439012']);
    assert.equal(second.pagination.total, 4);
    assert.equal(second.pagination.pages, 2);
    assert.ok(filters[0].$and.some((clause) => clause.$or?.some((entry) => entry.notifyFlowId === '')));
});

test('feed torna a atividade remota canônica e anexa o registro local sem duplicá-lo', async () => {
    const remoteId = '507f1f77bcf86cd799439011';
    const linked = dispatch('local-linked', '2026-08-16T09:00:00.000Z', {
        status: 'SENT',
        notifyFlowId: remoteId,
        jobId: 'job-local'
    });
    const model = {
        find: (filter) => queryResult(filter.notifyFlowId?.$in ? [linked] : []),
        countDocuments: async () => 0
    };
    const list = createNotificationFeedService({
        NotificationDispatch: model,
        getActivity: remoteLister([remote(remoteId, '2026-08-16T10:00:00.000Z')])
    });
    const result = await list({}, { page: 1, limit: 20 });
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].source, 'combined');
    assert.equal(result.data[0].id, remoteId);
    assert.equal(result.data[0].localId, 'local-linked');
    assert.equal(result.data[0].jobId, 'job-local');
    assert.equal(result.pagination.total, 1);
});

test('filtro agendado é mapeado para o remoto e para QUEUED futuro local', async () => {
    const seen = { remote: null, local: null };
    const model = {
        find(filter) { if (!filter.notifyFlowId?.$in) seen.local = filter; return queryResult([]); },
        countDocuments: async () => 0
    };
    const list = createNotificationFeedService({
        NotificationDispatch: model,
        getActivity: async (params) => {
            seen.remote = params;
            return { data: [], pagination: { total: 0, pages: 1 } };
        },
        now: new Date('2026-08-16T12:00:00.000Z')
    });
    await list({ status: 'scheduled' }, { page: 1, limit: 20 });
    assert.equal(seen.remote.status, 'scheduled');
    assert.equal(seen.local.status, 'QUEUED');
    assert.deepEqual(seen.local.scheduledFor, { $gt: new Date('2026-08-16T12:00:00.000Z') });
});
