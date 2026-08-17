const test = require('node:test');
const assert = require('node:assert/strict');
const {
    isPublicIp, normalizeIpAddress, parseWebhookUrl, resolveWebhook
} = require('../src/services/webhook.service');

test('webhook bloqueia redes locais e reservadas', () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.2', '169.254.169.254', '::1', 'fd00::1']) {
        assert.equal(isPublicIp(address), false, address);
    }
    assert.equal(isPublicIp('8.8.8.8'), true);
    assert.equal(isPublicIp('2606:4700:4700::1111'), true);
    assert.throws(() => parseWebhookUrl('http://example.com/hook'), /HTTPS/);
    assert.throws(() => parseWebhookUrl('https://localhost/hook'), /host público/);
});

test('webhook rejeita host público que resolve parcialmente para IP privado', async () => {
    await assert.rejects(
        () => resolveWebhook('https://hooks.example.com/events', {
            lookup: async () => [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.8', family: 4 }]
        }),
        /rede privada/
    );
    const resolved = await resolveWebhook('https://hooks.example.com/events#fragment', {
        lookup: async () => [{ address: '8.8.8.8', family: 4 }]
    });
    assert.equal(resolved.url, 'https://hooks.example.com/events');
    assert.equal(resolved.address, '8.8.8.8');
});

test('webhook normaliza IPv4-mapped IPv6 hexadecimal antes de validar e pinar', async () => {
    for (const address of [
        '::ffff:7f00:1',
        '0:0:0:0:0:ffff:a00:1',
        '::ffff:ac10:1',
        '::ffff:c0a8:101'
    ]) {
        assert.equal(isPublicIp(address), false, address);
    }

    await assert.rejects(
        () => resolveWebhook('https://[::ffff:7f00:1]/events'),
        /rede privada/
    );

    const publicMapped = await resolveWebhook('https://[::ffff:808:808]/events');
    assert.deepEqual(normalizeIpAddress('::ffff:808:808'), { address: '8.8.8.8', family: 4 });
    assert.equal(publicMapped.address, '8.8.8.8');
    assert.equal(publicMapped.family, 4);
});
