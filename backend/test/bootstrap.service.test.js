const test = require('node:test');
const assert = require('node:assert/strict');
const { demoSlugFor } = require('../src/services/bootstrap.service');

test('perfil demo nunca toma o slug que ja pertence a outro barbeiro', async () => {
    const profile = { _id: 'demo-profile', slug: 'barbearia-premium-2' };
    const queries = [];
    const slug = await demoSlugFor(profile, {
        async exists(filter) {
            queries.push(filter);
            return true;
        }
    });

    assert.equal(slug, 'barbearia-premium-2');
    assert.deepEqual(queries, [{
        _id: { $ne: 'demo-profile' },
        slug: 'barbearia-premium'
    }]);
});

test('perfil demo usa o slug preferencial quando ele esta livre', async () => {
    const slug = await demoSlugFor(
        { _id: 'demo-profile', slug: 'rascunho' },
        { exists: async () => false }
    );

    assert.equal(slug, 'barbearia-premium');
});
