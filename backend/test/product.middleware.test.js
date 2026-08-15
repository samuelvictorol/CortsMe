const test = require('node:test');
const assert = require('node:assert/strict');

const ProductMiddleware = require('../src/middlewares/product.middleware');

function createResponse() {
    return {
        statusCode: null,
        body: null,
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

test('middleware impede criação com contrato HTTP inválido', () => {
    const req = { body: { name: 123 } };
    const res = createResponse();
    let calledNext = false;

    ProductMiddleware.validateCreate(req, res, () => {
        calledNext = true;
    });

    assert.equal(calledNext, false);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body.errors.map(({ field }) => field), ['name', 'price']);
});

test('middleware encaminha uma criação com contrato válido', () => {
    const req = { body: { name: 'Mouse', price: 50 } };
    const res = createResponse();
    let calledNext = false;

    ProductMiddleware.validateCreate(req, res, () => {
        calledNext = true;
    });

    assert.equal(calledNext, true);
    assert.equal(res.statusCode, null);
});
