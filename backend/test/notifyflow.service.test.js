const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const { createNotification, getActivity, getActivityDetail } = require('../src/services/notifyflow.service');

test('envia contrato canônico do CortsMe ao NotifyFlow sem canais sem contato', async (context) => {
    const previous = {
        baseUrl: process.env.NOTIFYFLOW_BASE_URL,
        token: process.env.NOTIFYFLOW_APP_TOKEN,
        adapter: axios.defaults.adapter
    };
    process.env.NOTIFYFLOW_BASE_URL = 'https://notifyflow.test';
    process.env.NOTIFYFLOW_APP_TOKEN = 'test-token-not-a-secret';
    let captured;
    axios.defaults.adapter = async (config) => {
        captured = config;
        return { data: { id: 'notification-1', status: 'queued' }, status: 202, statusText: 'Accepted', headers: {}, config };
    };
    context.after(() => {
        if (previous.baseUrl === undefined) delete process.env.NOTIFYFLOW_BASE_URL;
        else process.env.NOTIFYFLOW_BASE_URL = previous.baseUrl;
        if (previous.token === undefined) delete process.env.NOTIFYFLOW_APP_TOKEN;
        else process.env.NOTIFYFLOW_APP_TOKEN = previous.token;
        axios.defaults.adapter = previous.adapter;
    });

    const response = await createNotification({
        templateName: 'CortsMeUserReminder',
        channels: ['email', 'whatsapp_cloud'],
        recipients: [{ externalId: 'customer:tenant:user', displayName: 'Cliente', email: 'cliente@example.com' }],
        variables: { title_description: 'Título', body_description: 'Descrição' },
        idempotencyKey: 'cortsme:test:1',
        metadata: { tenantId: 'tenant', profileId: 'tenant', entityType: 'appointment', entityId: '1' }
    });

    const body = typeof captured.data === 'string' ? JSON.parse(captured.data) : captured.data;
    assert.equal(captured.url, 'https://notifyflow.test/api/integrations/v1/notifications');
    assert.equal(captured.headers.Authorization, 'Bearer test-token-not-a-secret');
    assert.deepEqual(body.channels, ['email']);
    assert.equal(body.recipients.length, 1);
    assert.equal(body.variables.body_description, 'Descrição');
    assert.equal(body.metadata.tenantId, body.metadata.profileId);
    assert.equal(response.id, 'notification-1');
});

test('consulta detalhe app-scoped sem expor token ao navegador', async (context) => {
    const previous = {
        baseUrl: process.env.NOTIFYFLOW_BASE_URL,
        token: process.env.NOTIFYFLOW_APP_TOKEN,
        adapter: axios.defaults.adapter
    };
    process.env.NOTIFYFLOW_BASE_URL = 'https://notifyflow.test';
    process.env.NOTIFYFLOW_APP_TOKEN = 'server-only-token';
    let captured;
    axios.defaults.adapter = async (config) => {
        captured = config;
        return { data: { data: { id: '507f1f77bcf86cd799439011', deliveries: [], timeline: [] } }, status: 200, statusText: 'OK', headers: {}, config };
    };
    context.after(() => {
        if (previous.baseUrl === undefined) delete process.env.NOTIFYFLOW_BASE_URL;
        else process.env.NOTIFYFLOW_BASE_URL = previous.baseUrl;
        if (previous.token === undefined) delete process.env.NOTIFYFLOW_APP_TOKEN;
        else process.env.NOTIFYFLOW_APP_TOKEN = previous.token;
        axios.defaults.adapter = previous.adapter;
    });

    await getActivityDetail('notification', '507f1f77bcf86cd799439011');
    assert.equal(captured.url, 'https://notifyflow.test/api/integrations/v1/activity/notification/507f1f77bcf86cd799439011');
    assert.equal(captured.headers.Authorization, 'Bearer server-only-token');
    await getActivity({ page: 1, limit: 100, to: '2026-08-16T12:00:00.000Z', ignored: 'secret' });
    assert.equal(captured.url, 'https://notifyflow.test/api/integrations/v1/activity');
    assert.equal(captured.params.to, '2026-08-16T12:00:00.000Z');
    assert.equal(captured.params.ignored, undefined);
    await assert.rejects(() => getActivityDetail('../tokens', 'not-an-id'), (error) => error.code === 'NOTIFYFLOW_ACTIVITY_INVALID');
});
