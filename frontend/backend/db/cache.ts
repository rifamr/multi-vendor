/**
 * Simple LRU Cache implementation for high-performance caching
 * TTL-based expiration for frequently accessed data
 */

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttlMs: number;
  private name: string;

  // Performance tracking
  private _hits = 0;
  private _misses = 0;
  private _evictions = 0;
  private _sets = 0;

  constructor(maxSize: number = 100, ttlSeconds: number = 60, name: string = "unnamed") {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlSeconds * 1000;
    this.name = name;
  }

  get hits() { return this._hits; }
  get misses() { return this._misses; }
  get sets() { return this._sets; }
  get evictions() { return this._evictions; }
  get hitRate() { 
    const total = this._hits + this._misses;
    return total === 0 ? 0 : Math.round((this._hits / total) * 10000) / 100;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this._misses++;
      return null;
    }

    // Check expiry
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this._misses++;
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this._hits++;
    return entry.value;
  }

  set(key: string, value: T): void {
    this._sets++;

    // Remove if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
        this._evictions++;
      }
    }

    // Add new entry
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttlMs,
    });
  }

  /** Get stats snapshot for this cache */
  stats() {
    return {
      name: this.name,
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlSeconds: this.ttlMs / 1000,
      hits: this._hits,
      misses: this._misses,
      sets: this._sets,
      evictions: this._evictions,
      hitRate: `${this.hitRate}%`,
    };
  }

  /** Reset stats counters */
  resetStats() {
    this._hits = 0;
    this._misses = 0;
    this._sets = 0;
    this._evictions = 0;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Clean up expired entries
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        pruned++;
      }
    }

    return pruned;
  }
}

// Global cache instances
export const servicesCache = new LRUCache<any>(200, 45, "services"); // 200 entries, 45s TTL
export const categoriesCache = new LRUCache<any>(50, 300, "categories"); // 50 entries, 5min TTL
export const vendorCache = new LRUCache<any>(100, 120, "vendors"); // 100 entries, 2min TTL

/** Get combined stats for all caches */
export function getCacheStats() {
  return {
    services: servicesCache.stats(),
    categories: categoriesCache.stats(),
    vendors: vendorCache.stats(),
  };
}

/** Log cache stats to console (useful during load testing) */
export function logCacheStats() {
  const stats = getCacheStats();
  console.log("\n📊 Cache Performance Report:");
  console.table([stats.services, stats.categories, stats.vendors]);
}

/** Reset all cache stats counters */
export function resetAllCacheStats() {
  servicesCache.resetStats();
  categoriesCache.resetStats();
  vendorCache.resetStats();
}

// Periodic cache cleanup (every 60 seconds)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const pruned = servicesCache.prune() + categoriesCache.prune() + vendorCache.prune();
    if (process.env.NODE_ENV === "development" && pruned > 0) {
      console.log(`[cache] Pruned ${pruned} expired entries`);
    }
  }, 60000);
}
