/**
 * Simple in-memory cache for analytics data
 * For production, consider using Redis or similar
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map()

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cache data with TTL in seconds
   */
  set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    const expiresAt = Date.now() + (ttlSeconds * 1000)
    this.cache.set(key, { data, expiresAt })
  }

  /**
   * Delete a specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Delete cache entries matching a pattern
   */
  deletePattern(pattern: string): void {
    const regex = new RegExp(pattern)
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }
}

// Singleton instance
export const cache = new MemoryCache()

// Run cleanup every 5 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    cache.cleanup()
  }, 5 * 60 * 1000)
}

/**
 * Cache key generators for different analytics endpoints
 */
export const CacheKeys = {
  adminAnalytics: () => 'analytics:admin',
  panchayatAnalytics: (mandalName: string) => `analytics:panchayat:${mandalName}`,
  fieldOfficerStats: () => 'analytics:field-officers',
  mandalStats: () => 'analytics:mandal-stats',
  updateTimeline: (days: number) => `analytics:timeline:${days}`,
}

/**
 * Invalidate analytics cache when data is updated
 */
export function invalidateAnalyticsCache(scope: 'all' | 'admin' | 'panchayat' | 'field-officer' = 'all'): void {
  if (scope === 'all') {
    cache.deletePattern('^analytics:')
  } else {
    cache.deletePattern(`^analytics:${scope}`)
  }
}

