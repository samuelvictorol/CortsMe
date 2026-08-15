const ALLOWED_MAP_HOSTS = new Set([
    'www.google.com',
    'google.com',
    'maps.google.com',
    'www.openstreetmap.org',
    'openstreetmap.org'
]);

function normalizeMapEmbed(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const iframeMatch = raw.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    const candidate = iframeMatch?.[1] || raw;

    let url;
    try { url = new URL(candidate); } catch {
        throw Object.assign(new Error('Cole uma URL ou iframe válido do Google Maps/OpenStreetMap.'), { statusCode: 400 });
    }

    if (url.protocol !== 'https:' || !ALLOWED_MAP_HOSTS.has(url.hostname.toLowerCase())) {
        throw Object.assign(new Error('Por segurança, use um mapa incorporável do Google Maps ou OpenStreetMap.'), { statusCode: 400 });
    }

    const googlePath = url.hostname.includes('google.com') && (url.pathname.startsWith('/maps') || url.searchParams.get('output') === 'embed');
    const osmPath = url.hostname.includes('openstreetmap.org') && url.pathname.startsWith('/export/embed');
    if (!googlePath && !osmPath) {
        throw Object.assign(new Error('Use o link de incorporação do mapa, não o link comum de navegação.'), { statusCode: 400 });
    }

    return url.toString();
}

module.exports = { normalizeMapEmbed };
