const Redis = require('ioredis');

let redis;

async function connectRedis() {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 2,
        lazyConnect: true
    });
    redis.on('error', (error) => console.warn(`Redis: ${error.message}`));
    await redis.connect();
    await redis.set('cortsme:boot', new Date().toISOString(), 'EX', 3600);
    return redis;
}

function getRedis() {
    return redis;
}

module.exports = { connectRedis, getRedis };
