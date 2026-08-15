const test = require('node:test');
const assert = require('node:assert/strict');

const { ProductManager } = require('../src/managers/product.manager');
const ManagerError = require('../src/errors/manager.error');

test('criação delega a regra de preço ao manager de precificação', async () => {
    const calls = [];
    const pricingManager = {
        normalize(price) {
            calls.push(price);
            return 25.9;
        }
    };

    class ProductModel {
        constructor(data) {
            this.data = data;
        }

        async save() {
            return this.data;
        }
    }

    const manager = new ProductManager({ productModel: ProductModel, pricingManager });
    const product = await manager.create({
        name: '  Teclado  ',
        price: '25.899',
        description: '  Mecânico  '
    });

    assert.deepEqual(calls, ['25.899']);
    assert.deepEqual(product, {
        name: 'Teclado',
        price: 25.9,
        description: 'Mecânico'
    });
});

test('atualização retorna erro negocial quando o produto não existe', async () => {
    const productModel = {
        findByIdAndUpdate: async () => null
    };
    const manager = new ProductManager({
        productModel,
        pricingManager: { normalize: (price) => price }
    });

    await assert.rejects(
        () => manager.update('507f1f77bcf86cd799439011', { name: 'Produto' }),
        (error) => error instanceof ManagerError
            && error.statusCode === 404
            && error.code === 'PRODUCT_NOT_FOUND'
    );
});

test('busca escapa caracteres de expressão regular', async () => {
    let receivedFilter;
    const productModel = {
        find: async (filter) => {
            receivedFilter = filter;
            return [];
        }
    };
    const manager = new ProductManager({ productModel });

    await manager.search({ name: 'Produto.*' });

    assert.deepEqual(receivedFilter, {
        name: { $regex: 'Produto\\.\\*', $options: 'i' }
    });
});
