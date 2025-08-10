// Cache Manager Module
// Handles memory caching for trending repository data

class CacheManager {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 10 * 60 * 1000; // 10 minutes
    }

    // Generate cache key
    generateKey(language, timeRange) {
        return `${language || 'all'}-${timeRange}`;
    }

    // Get cached data
    get(language, timeRange) {
        const key = this.generateKey(language, timeRange);
        return this.cache.get(key);
    }

    // Set cached data with timestamp
    set(language, timeRange, data, ttl = this.defaultTTL) {
        const key = this.generateKey(language, timeRange);
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }

    // Check if cached data is valid
    isValid(cacheEntry, customTTL = null) {
        if (!cacheEntry) return false;
        const ttl = customTTL || cacheEntry.ttl || this.defaultTTL;
        return (Date.now() - cacheEntry.timestamp) < ttl;
    }

    // Get valid cached data or return null
    getValid(language, timeRange, customTTL = null) {
        const cacheEntry = this.get(language, timeRange);
        return this.isValid(cacheEntry, customTTL) ? cacheEntry.data : null;
    }

    // Clear all cache
    clear() {
        this.cache.clear();
    }

    // Clear expired entries
    clearExpired() {
        for (const [key, entry] of this.cache.entries()) {
            if (!this.isValid(entry)) {
                this.cache.delete(key);
            }
        }
    }

    // Get cache statistics
    getStats() {
        const total = this.cache.size;
        let valid = 0;
        let expired = 0;

        for (const entry of this.cache.values()) {
            if (this.isValid(entry)) {
                valid++;
            } else {
                expired++;
            }
        }

        return { total, valid, expired };
    }
}

// Export for global use
if (typeof window !== 'undefined') {
    window.CacheManager = CacheManager;
}