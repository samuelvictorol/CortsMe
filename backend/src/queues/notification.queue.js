const crypto = require('crypto');
const Redis = require('ioredis');
const { Queue } = require('bullmq');

const QUEUE_NAME = process.env.CORTSME_NOTIFICATION_QUEUE || 'cortsme-notifications';
let connection;
let queue;

function createQueueConnection() {
    return new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: null,
        enableReadyCheck: false
    });
}

function getQueueConnection() {
    if (!connection) connection = createQueueConnection();
    return connection;
}

function getNotificationQueue() {
    if (!queue) queue = new Queue(QUEUE_NAME, { connection: getQueueConnection() });
    return queue;
}

function jobIdFor(key) {
    return crypto.createHash('sha256').update(String(key)).digest('hex');
}

async function enqueueNotificationJob(name, data, options = {}) {
    const delay = Math.max(0, Number(options.delay) || 0);
    return getNotificationQueue().add(name, data, {
        jobId: options.jobId || jobIdFor(options.key || `${name}:${Date.now()}:${crypto.randomUUID()}`),
        delay,
        attempts: options.attempts || 6,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 24 * 3600, count: 2000 },
        removeOnFail: { age: 7 * 24 * 3600, count: 5000 }
    });
}

async function registerReminderSchedulers() {
    const notifications = getNotificationQueue();
    await notifications.upsertJobScheduler('reconcile-reminders', { pattern: '*/5 * * * *' }, {
        name: 'reconcile-reminders', data: {}, opts: {
            removeOnComplete: { age: 3600, count: 100 },
            removeOnFail: { age: 24 * 3600, count: 100 }
        }
    });
    await notifications.add('reconcile-reminders', { startup: true }, {
        jobId: `reconcile-startup-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: { age: 24 * 3600, count: 20 }
    });
    await notifications.upsertJobScheduler('billing-sweep', { pattern: '*/15 * * * *' }, {
        name: 'billing-sweep', data: {}, opts: {
            removeOnComplete: { age: 3600, count: 100 },
            removeOnFail: { age: 24 * 3600, count: 100 }
        }
    });
    await notifications.add('billing-sweep', { startup: true }, {
        jobId: `billing-sweep-startup-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: { age: 24 * 3600, count: 20 }
    });
}

async function closeNotificationQueue() {
    const currentQueue = queue;
    const currentConnection = connection;
    queue = undefined;
    connection = undefined;
    if (currentQueue) await currentQueue.close();
    if (currentConnection && currentConnection.status !== 'end') await currentConnection.quit();
}

module.exports = {
    QUEUE_NAME,
    createQueueConnection,
    getNotificationQueue,
    enqueueNotificationJob,
    registerReminderSchedulers,
    closeNotificationQueue,
    jobIdFor
};
