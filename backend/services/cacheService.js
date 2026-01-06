// ===========================
// In-Memory Cache Service with TTL
// ===========================

/**
 * Simple in-memory cache with TTL (Time-To-Live) support
 * Thread-safe operations (Node.js is single-threaded)
 * Automatic expiration using timestamps
 */
class CacheService {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      clears: 0
    };
    
    // Cleanup expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.stats.misses++;
        return null;
      }

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return entry.value;
    } catch (err) {
      console.error('Cache get error:', err);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (default: 60)
   * @returns {boolean} Success status
   */
  set(key, value, ttl = 60) {
    try {
      // Enforce max size - remove oldest entry if at limit
      if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      const expiresAt = Date.now() + (ttl * 1000);
      this.cache.set(key, { value, expiresAt });
      this.stats.sets++;
      return true;
    } catch (err) {
      console.error('Cache set error:', err);
      return false;
    }
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {boolean} Success status
   */
  del(key) {
    try {
      const deleted = this.cache.delete(key);
      if (deleted) {
        this.stats.deletes++;
      }
      return deleted;
    } catch (err) {
      console.error('Cache delete error:', err);
      return false;
    }
  }

  /**
   * Delete all entries matching a pattern (for invalidation)
   * @param {string} pattern - Pattern to match (e.g., 'vehicles:*')
   * @returns {number} Number of entries deleted
   */
  delPattern(pattern) {
    try {
      let deleted = 0;
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.cache.delete(key);
          deleted++;
        }
      }
      
      this.stats.deletes += deleted;
      return deleted;
    } catch (err) {
      console.error('Cache delete pattern error:', err);
      return 0;
    }
  }

  /**
   * Clear all cache entries
   * @returns {number} Number of entries cleared
   */
  clear() {
    try {
      const size = this.cache.size;
      this.cache.clear();
      this.stats.clears++;
      return size;
    } catch (err) {
      console.error('Cache clear error:', err);
      return 0;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;
    
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: `${hitRate}%`,
      totalRequests: total
    };
  }

  /**
   * Cleanup expired entries
   * @private
   */
  cleanup() {
    try {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        console.log(`Cache cleanup: Removed ${cleaned} expired entries`);
      }
    } catch (err) {
      console.error('Cache cleanup error:', err);
    }
  }

  /**
   * Stop cleanup interval (call on application shutdown)
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Export singleton instance
const cache = new CacheService(1000);

export default cache;

