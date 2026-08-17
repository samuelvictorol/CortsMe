const dns = require('node:dns').promises;
const https = require('node:https');
const net = require('node:net');
const axios = require('axios');

function requestError(message) {
    return Object.assign(new Error(message), { statusCode: 400, code: 'WEBHOOK_URL_UNSAFE' });
}

function publicIpv4(address) {
    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    const [a, b, c] = parts;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2))) return false;
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
}

function mappedIpv4(address) {
    const value = String(address || '').toLowerCase().split('%')[0];
    if (!net.isIPv6(value)) return null;
    let canonical;
    try {
        canonical = new URL(`https://[${value}]/`).hostname.replace(/^\[|\]$/g, '');
    } catch {
        return null;
    }
    const match = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(canonical);
    if (!match) return null;
    const high = Number.parseInt(match[1], 16);
    const low = Number.parseInt(match[2], 16);
    return `${high >>> 8}.${high & 0xff}.${low >>> 8}.${low & 0xff}`;
}

function normalizeIpAddress(address) {
    const value = String(address || '').toLowerCase().split('%')[0];
    const mapped = mappedIpv4(value);
    if (mapped) return { address: mapped, family: 4 };
    return { address: value, family: net.isIP(value) };
}

function isPublicIp(address) {
    const normalized = normalizeIpAddress(address);
    const value = normalized.address;
    if (normalized.family === 4) return publicIpv4(value);
    if (normalized.family !== 6) return false;
    if (value === '::' || value === '::1') return false;
    if (/^f[cd]/.test(value) || /^fe[89ab]/.test(value)) return false;
    if (/^2001:db8(?:\:|$)/.test(value)) return false;
    return true;
}

function parseWebhookUrl(raw) {
    const value = String(raw || '').trim();
    if (!value) return null;
    let url;
    try { url = new URL(value); } catch { throw requestError('Informe uma URL HTTPS válida para o webhook.'); }
    if (url.protocol !== 'https:' || url.username || url.password) {
        throw requestError('O webhook deve usar HTTPS e não pode conter credenciais na URL.');
    }
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
        throw requestError('O webhook deve apontar para um host público.');
    }
    url.hash = '';
    return url;
}

async function resolveWebhook(raw, options = {}) {
    const url = parseWebhookUrl(raw);
    if (!url) return null;
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const lookup = options.lookup || dns.lookup;
    let addresses;
    try {
        addresses = net.isIP(hostname)
            ? [{ address: hostname, family: net.isIPv6(hostname) ? 6 : 4 }]
            : await lookup(hostname, { all: true, verbatim: true });
    } catch {
        throw requestError('Não foi possível resolver o host público do webhook.');
    }
    if (!addresses.length || addresses.some((entry) => !isPublicIp(entry.address))) {
        throw requestError('O webhook resolveu para uma rede privada ou reservada.');
    }
    const pinned = normalizeIpAddress(addresses[0].address);
    return { url: url.toString(), address: pinned.address, family: pinned.family };
}

function pinnedAgent(resolved) {
    return new https.Agent({
        keepAlive: false,
        lookup(_hostname, options, callback) {
            const done = typeof options === 'function' ? options : callback;
            const requestOptions = typeof options === 'object' ? options : {};
            if (requestOptions.all) return done(null, [{ address: resolved.address, family: resolved.family }]);
            return done(null, resolved.address, resolved.family);
        }
    });
}

async function normalizeWebhookUrl(raw, options = {}) {
    const resolved = await resolveWebhook(raw, options);
    return resolved?.url || '';
}

async function postWebhook(raw, payload, options = {}) {
    const resolved = await resolveWebhook(raw, options);
    if (!resolved) return null;
    return axios.post(resolved.url, payload, {
        timeout: 3500,
        maxRedirects: 0,
        maxContentLength: 256 * 1024,
        maxBodyLength: 512 * 1024,
        proxy: false,
        httpsAgent: pinnedAgent(resolved),
        validateStatus: (status) => status >= 200 && status < 300
    });
}

module.exports = {
    isPublicIp, mappedIpv4, normalizeIpAddress,
    parseWebhookUrl, resolveWebhook, normalizeWebhookUrl, postWebhook, pinnedAgent
};
