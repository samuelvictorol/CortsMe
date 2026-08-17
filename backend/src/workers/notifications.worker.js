require('dotenv').config();

const { Worker } = require('bullmq');
const mongoConn = require('../config/mongo.connection');
const { connectRedis } = require('../config/redis.connection');
const {
    QUEUE_NAME, createQueueConnection, registerReminderSchedulers, closeNotificationQueue
} = require('../queues/notification.queue');
const { processNotificationJob } = require('../services/notification.service');

async function startWorker() {
    await mongoConn();
    await connectRedis();
    await registerReminderSchedulers();
    const worker = new Worker(QUEUE_NAME, processNotificationJob, {
        connection: createQueueConnection(),
        concurrency: Math.max(1, Number(process.env.NOTIFICATION_WORKER_CONCURRENCY) || 5),
        limiter: { max: Math.max(1, Number(process.env.NOTIFICATION_RATE_LIMIT) || 30), duration: 1000 }
    });
    worker.on('completed', (job) => console.log(`Notification job completed: ${job.name}/${job.id}`));
    worker.on('failed', (job, error) => console.warn(`Notification job failed: ${job?.name}/${job?.id}: ${error.message}`));
    worker.on('error', (error) => console.error(`Notification worker error: ${error.message}`));

    async function shutdown(signal) {
        console.log(`Notification worker stopping (${signal})`);
        await Promise.allSettled([worker.close(), closeNotificationQueue()]);
        process.exit(0);
    }
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
    return worker;
}

if (require.main === module) {
    startWorker().catch((error) => {
        console.error(`Não foi possível iniciar o worker: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = { startWorker };
