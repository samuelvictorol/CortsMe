const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizePhone, reminderSettings, localParts, localDayBounds
} = require('../src/services/notification.service');
const { normalizePhone: normalizeStoredPhone } = require('../src/services/security.service');

test('normaliza WhatsApp brasileiro e rejeita destinatário inválido', () => {
    assert.equal(normalizePhone('(11) 99999-9999'), '+5511999999999');
    assert.equal(normalizePhone('+55 11 98888-7777'), '+5511988887777');
    assert.equal(normalizePhone('(61) 98174-8795'), '+5561981748795');
    assert.equal(normalizePhone('+556181748795'), '+556181748795');
    assert.equal(normalizePhone('123'), '');
});

test('preserva o nono dígito no cadastro e só acrescenta o país no payload', () => {
    assert.equal(normalizeStoredPhone('(61) 98174-8795'), '61981748795');
    assert.equal(normalizePhone(normalizeStoredPhone('(61) 98174-8795')), '+5561981748795');
});

test('normaliza preferências do barbeiro sem aceitar canais fora do contrato', () => {
    const settings = reminderSettings({
        reminderSettings: {
            enabled: true,
            channels: ['email', 'sms', 'whatsapp_cloud', 'email'],
            morningTime: '06:45',
            timezone: 'America/Sao_Paulo'
        }
    });
    assert.deepEqual(settings.channels, ['email', 'whatsapp_cloud']);
    assert.equal(settings.morningTime, '06:45');
    assert.equal(settings.timezone, 'America/Sao_Paulo');
});

test('calcula limites UTC do dia local para consultas isoladas de agenda', () => {
    const bounds = localDayBounds('2026-08-16', 'America/Sao_Paulo');
    assert.equal(bounds.start.toISOString(), '2026-08-16T03:00:00.000Z');
    assert.equal(bounds.end.toISOString(), '2026-08-17T03:00:00.000Z');
    assert.equal(localParts(new Date('2026-08-16T10:00:00.000Z'), 'America/Sao_Paulo').hour, 7);
});
