// Lightweight Redis client wrapper with in-memory fallback for high availability
class InMemoryCache {
  constructor() {
    this.store = new Map();
  }
  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }
  async set(key, value, mode, ttlSeconds) {
    const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }
  async del(key) {
    return this.store.delete(key) ? 1 : 0;
  }
}

const fallbackCache = new InMemoryCache();

module.exports = {
  cache: fallbackCache,
  isFallback: true
};
