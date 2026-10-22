// BullMQ queue: reminders, notifications, (baad mein) OCR jobs
const { Queue } = require('bullmq'), IORedis = require('ioredis');
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const notifications = new Queue('notifications', { connection });
module.exports = { connection, notifications };
