// Separate process: npm run worker. Currently only logs; add FCM/SMS push here.
require('dotenv').config();
const { Worker } = require('bullmq'), { connection } = require('./index');
new Worker('notifications', async (job) => console.log('[notify]', job.name, JSON.stringify(job.data)), { connection });
console.log('Notification worker running');
