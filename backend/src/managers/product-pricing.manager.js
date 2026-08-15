const ManagerError = require('../errors/manager.error');
const ProductEnums = require('../enums/product.enums');

class ProductPricingManager {
    normalize(price) {
        const normalizedPrice = Number(price);

        if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
            throw new ManagerError(ProductEnums.INVALID_PRICE, {
                code: 'INVALID_PRODUCT_PRICE'
            });
        }

        return Math.round((normalizedPrice + Number.EPSILON) * 100) / 100;
    }
}

module.exports = new ProductPricingManager();
module.exports.ProductPricingManager = ProductPricingManager;
