// Chat session state for the AI chatbot. Redis keeps it shared across API instances
// and expires it automatically (30 min), so a user picks up where they left off.
const KEY = (id) => 'chat:sess:' + id;

class RedisSessionStore {
  constructor(redis, ttlMs = 30 * 60 * 1000) {
    this.redis = redis;
    this.ttl = Math.max(1, Math.ceil(ttlMs / 1000));
  }
  async get(id) {
    const raw = await this.redis.get(KEY(id));
    if (!raw) return undefined;
    try { return JSON.parse(raw); } catch { return undefined; }
  }
  async set(id, state) {
    await this.redis.set(KEY(id), JSON.stringify(state), 'EX', this.ttl);
  }
}

module.exports = { RedisSessionStore };
