const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const { createNotification } = require('../src/services/notifyflow.service');

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
