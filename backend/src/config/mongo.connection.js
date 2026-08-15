const mongoose = require('mongoose');

async function connectMongo() {
    mongoose.set('strictQuery', true);
    await mongoose.connect(process.env.CONNECTION_STRING);
    console.log('🎲 Conectado no MongoDB');
}

module.exports = connectMongo;
