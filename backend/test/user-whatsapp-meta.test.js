const test = require('node:test');
const assert = require('node:assert/strict');

const { encryptText, decryptText } = require('../src/services/security.service');
const {
    normalizeWhatsappMetaPhone,
    updateUser,
    userView
} = require('../src/services/user.service');

test('override Meta aceita E.164 brasileiro com 8 ou 9 dígitos sem reescrever o número', () => {
    assert.equal(normalizeWhatsappMetaPhone('+556181748795'), '+556181748795');
    assert.equal(normalizeWhatsappMetaPhone('+5561981748795'), '+5561981748795');
    assert.equal(normalizeWhatsappMetaPhone(''), '');

    for (const invalid of ['556181748795', '+551748795', '+14155552671', '+550081748795', '+556101234567']) {
        assert.throws(
            () => normalizeWhatsappMetaPhone(invalid),
            (error) => error.statusCode === 400 && error.code === 'WHATSAPP_META_PHONE_INVALID'
        );
    }
});

test('atualizar override Meta mantém o telefone principal intacto e expõe campos separados no DTO', async () => {
    const originalPhone = encryptText('61981748795');
    const user = {
        _id: 'user-a',
        name: 'Cliente A',
        emailEncrypted: encryptText('cliente@example.com'),
        phoneEncrypted: originalPhone,
        whatsappMetaPhoneEncrypted: '',
        role: 'USER', provider: 'local', active: true,
        authVersion: 0,
        isModified: () => false,
        async save() { return this; }
    };

    await updateUser(user, { whatsappMetaPhone: '+556181748795' });

    assert.equal(user.phoneEncrypted, originalPhone);
    assert.equal(decryptText(user.phoneEncrypted), '61981748795');
    assert.equal(decryptText(user.whatsappMetaPhoneEncrypted), '+556181748795');
    const dto = userView(user);
    assert.equal(dto.phone, '61981748795');
    assert.equal(dto.whatsappMetaPhone, '+556181748795');
});
