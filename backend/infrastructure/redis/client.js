// QR tokens aur short-lived sessions yahan (TTL ke saath, auto-expire)
const Redis = require('ioredis');
module.exports = new Redis(process.env.REDIS_URL);
