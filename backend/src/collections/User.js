const mongoose = require('mongoose');
const AuthEnums = require('../enums/auth.enums');

const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: [true, AuthEnums.NAME_REQUIRED],
        trim: true
    },
    email: {
        type: String,
        required: [true, AuthEnums.EMAIL_REQUIRED],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, AuthEnums.PASSWORD_REQUIRED],
        select: false
    }
}, { timestamps: true });

userSchema.set('toJSON', {
    transform(document, returnedObject) {
        delete returnedObject.password;
        return returnedObject;
    }
});

const User = mongoose.model('User', userSchema);

module.exports = { User, userSchema };
