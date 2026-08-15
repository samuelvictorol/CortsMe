const ProductManager = require('../managers/product.manager');
const ProductEnums = require('../enums/product.enums');
const { handleControllerError } = require('./controller.helper');

const ProductController = {
    create: async (req, res) => {
        try {
            const product = await ProductManager.create(req.body);
            return res.status(201).json({ message: ProductEnums.PRODUCT_CREATED, product });
        } catch (error) {
            return handleControllerError(res, error);
        }
    },

    search: async (req, res) => {
        try {
            const products = await ProductManager.search(req.query);
            return res.status(200).json(products);
        } catch (error) {
            return handleControllerError(res, error);
        }
    },

    update: async (req, res) => {
        try {
            const product = await ProductManager.update(req.params.id, req.body);
            return res.status(200).json({ message: ProductEnums.PRODUCT_UPDATED, product });
        } catch (error) {
            return handleControllerError(res, error);
        }
    },

    delete: async (req, res) => {
        try {
            await ProductManager.delete(req.params.id);
            return res.status(200).json({ message: ProductEnums.PRODUCT_DELETED });
        } catch (error) {
            return handleControllerError(res, error);
        }
    }
};

module.exports = ProductController;
