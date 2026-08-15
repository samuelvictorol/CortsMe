const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ProductPricingManager
} = require('../src/managers/product-pricing.manager');
const ManagerError = require('../src/errors/manager.error');

test('normaliza o preço para duas casas decimais', () => {
    const manager = new ProductPricingManager();

    assert.equal(manager.normalize('19.999'), 20);
});

test('rejeita preços que violam a regra de negócio', () => {
    const manager = new ProductPricingManager();

    assert.throws(
        () => manager.normalize(0),
        (error) => error instanceof ManagerError && error.code === 'INVALID_PRODUCT_PRICE'
    );
});
