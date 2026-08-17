const axios = require('axios');

const NOTIFICATIONS_PATH = process.env.NOTIFYFLOW_NOTIFICATIONS_PATH || '/api/integrations/v1/notifications';
const ACTIVITY_PATH = process.env.NOTIFYFLOW_ACTIVITY_PATH || '/api/integrations/v1/activity';
const STATUS_PATH = process.env.NOTIFYFLOW_STATUS_PATH || '/api/integrations/v1/status';

function integrationConfig() {
    return {
        baseUrl: String(process.env.NOTIFYFLOW_BASE_URL || 'https://notify-flow.onrender.com').replace(/\/+$/, ''),
        token: String(process.env.NOTIFYFLOW_APP_TOKEN || '').trim()
    };
}

function integrationReady() {
    const config = integrationConfig();
    return Boolean(/^https?:\/\//i.test(config.baseUrl) && config.token);
}

function integrationError(error) {
    const status = Number(error.response?.status || 0);
    const message = status === 401 || status === 403
        ? 'O NotifyFlow recusou as credenciais do CortsMe.'
        : 'O NotifyFlow está temporariamente indisponível.';
    return Object.assign(new Error(message), {
        statusCode: 502,
        code: 'NOTIFYFLOW_REQUEST_FAILED',
        providerStatus: status || null
    });
}

async function request(method, path, options = {}) {
    const config = integrationConfig();
    if (!integrationReady()) {
        throw Object.assign(new Error('Integração NotifyFlow não configurada.'), { statusCode: 503, code: 'NOTIFYFLOW_NOT_CONFIGURED' });
    }
    try {
        const response = await axios({
            method,
            url: `${config.baseUrl}${path}`,
            headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
            data: options.data,
            params: options.params,
            timeout: Number(process.env.NOTIFYFLOW_TIMEOUT_MS) || 12000
        });
        return response.data;
    } catch (error) {
        throw integrationError(error);
    }
}

function sanitizeChannels(channels, recipients) {
    const allowed = new Set(['email', 'whatsapp_cloud']);
    const requested = [...new Set((channels || []).filter((item) => allowed.has(item)))];
    const hasEmail = recipients.some((recipient) => Boolean(recipient.email));
    const hasPhone = recipients.some((recipient) => Boolean(recipient.phone));
    return requested.filter((channel) => channel === 'email' ? hasEmail : hasPhone);
}

async function createNotification(payload) {
    const recipients = Array.isArray(payload.recipients) ? payload.recipients.filter(Boolean) : [];
    const channels = sanitizeChannels(payload.channels, recipients);
    if (!recipients.length || !channels.length) {
        throw Object.assign(new Error('Nenhum destinatário ou canal válido para esta notificação.'), { statusCode: 422, code: 'NOTIFICATION_RECIPIENT_UNAVAILABLE' });
    }
    return request('post', NOTIFICATIONS_PATH, {
        data: {
            templateName: payload.templateName,
            channels,
            recipients,
            variables: payload.variables,
            idempotencyKey: payload.idempotencyKey,
            metadata: payload.metadata,
            ...(payload.schedule ? { schedule: payload.schedule } : {})
        }
    });
}

async function getActivity(params = {}) {
    const allowed = ['page', 'limit', 'status', 'channel', 'search'];
    const safeParams = Object.fromEntries(allowed.filter((key) => params[key] !== undefined && params[key] !== '').map((key) => [key, params[key]]));
    return request('get', ACTIVITY_PATH, { params: safeParams });
}

async function getStatus() {
    return request('get', STATUS_PATH);
}

module.exports = { createNotification, getActivity, getStatus, integrationReady, integrationConfig };
