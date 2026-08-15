const { Product: ProductModel } = require('../collections/Product');
const ProductPricingManager = require('./product-pricing.manager');
const ManagerError = require('../errors/manager.error');
const ProductEnums = require('../enums/product.enums');

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class ProductManager {
    constructor({ productModel = ProductModel, pricingManager = ProductPricingManager } = {}) {
        this.productModel = productModel;
        this.pricingManager = pricingManager;
    }

    async create(payload) {
        const data = this.#prepareProductData(payload, { partial: false });
        const product = new this.productModel(data);

        return product.save();
    }

    async search({ name } = {}) {
        const normalizedName = name?.trim();
        const filter = normalizedName
            ? { name: { $regex: escapeRegExp(normalizedName), $options: 'i' } }
            : {};

        return this.productModel.find(filter);
    }

    async update(id, payload) {
        const data = this.#prepareProductData(payload, { partial: true });

        if (Object.keys(data).length === 0) {
            throw new ManagerError(ProductEnums.NO_FIELDS_TO_UPDATE, {
                code: 'NO_PRODUCT_FIELDS_TO_UPDATE'
            });
        }

        const product = await this.productModel.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true
        });

        if (!product) {
            throw this.#productNotFoundError();
        }

        return product;
    }

    async delete(id) {
        const product = await this.productModel.findByIdAndDelete(id);

        if (!product) {
            throw this.#productNotFoundError();
        }

        return product;
    }

    #prepareProductData(payload, { partial }) {
        const data = {};

        if (!partial || payload.name !== undefined) {
            const name = payload.name?.trim();

            if (!name) {
                throw new ManagerError(ProductEnums.NAME_REQUIRED, {
                    code: 'PRODUCT_NAME_REQUIRED'
                });
            }

            data.name = name;
        }

        if (!partial || payload.price !== undefined) {
            // Um manager pode delegar regras especializadas a outros managers.
            data.price = this.pricingManager.normalize(payload.price);
        }

        if (payload.description !== undefined) {
            const description = payload.description?.trim();

            if (description && description.length > 500) {
                throw new ManagerError(ProductEnums.DESCRIPTION_MAX_LENGTH, {
                    code: 'PRODUCT_DESCRIPTION_TOO_LONG'
                });
            }

            data.description = description || '';
        }

        return data;
    }

    #productNotFoundError() {
        return new ManagerError(ProductEnums.PRODUCT_NOT_FOUND, {
            statusCode: 404,
            code: 'PRODUCT_NOT_FOUND'
        });
    }
}

module.exports = new ProductManager();
module.exports.ProductManager = ProductManager;
