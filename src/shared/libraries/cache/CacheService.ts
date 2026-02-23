import { logger } from '../../config/logger';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTTL: number = 10 * 60 * 1000; // 10 minutes

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    logger.debug(`Cache HIT: ${key}`);
    return entry.value as T;
  }

  /**
   * Set value in cache with optional TTL
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs || this.defaultTTL;
    const expiresAt = Date.now() + ttl;

    this.cache.set(key, {
      value,
      expiresAt,
    });

    logger.debug(`Cache SET: ${key} (TTL: ${ttl}ms)`);
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Cleanup expired entries periodically
   */
  startCleanupInterval(intervalMs: number = 60000): NodeJS.Timeout {
    return setInterval(() => {
      let cleaned = 0;
      for (const [key, entry] of this.cache.entries()) {
        if (Date.now() > entry.expiresAt) {
          this.cache.delete(key);
          cleaned++;
        }
      }
      if (cleaned > 0) {
        logger.debug(`Cache cleanup: removed ${cleaned} expired entries`);
      }
    }, intervalMs);
  }

  /**
   * Generate cache key for route distance
   */
  static generateDistanceCacheKey(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): string {
    return `distance:${originLat},${originLng}:${destLat},${destLng}`;
  }

  /**
   * Generate cache key for weather
   */
  static generateWeatherCacheKey(lat: number, lng: number): string {
    return `weather:${lat},${lng}`;
  }

  /**
   * Generate cache key for route context
   */
  static generateRouteContextCacheKey(routeId: string, originId: string, destId: string): string {
    return `route_context:${routeId}:${originId}:${destId}`;
  }
}

// Singleton instance
export const cacheService = new CacheService();
