// Mongodb Model Product
const mongoose = require('mongoose');
const ProductEnums = require('../enums/product.enums');

const { Schema } = mongoose;

const productSchema = new Schema({
    name: {
        type: String,
        required: [true, ProductEnums.NAME_REQUIRED],
        trim: true
    },
    price: {
        type: Number,
        required: [true, ProductEnums.PRICE_REQUIRED],
        min: [0.01, ProductEnums.INVALID_PRICE]
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, ProductEnums.DESCRIPTION_MAX_LENGTH],
    }
},
    { timestamps: true }
);

const Product = mongoose.model('Product', productSchema);

module.exports = {
    Product,
    productSchema
};
