/*
  Lightweight in-memory TTL cache using a plain Map.
  No external dependencies — works in any Node.js environment.

  Usage:
    import { getCache, setCache, clearCacheByPrefix } from '../utils/cache.js'

    const data = getCache('home')
    if (data) return res.json(data)
    // … fetch data …
    setCache('home', result, 90)     // TTL in seconds (default 90s)
    clearCacheByPrefix('product:')   // invalidate all product list entries
*/

const store = new Map()   // key → { value, expiresAt }

const DEFAULT_TTL = 90    // seconds

/**
 * Read a cached value. Returns null on miss or expiry.
 */
export function getCache(key) {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.value
}

/**
 * Write a value with an optional TTL in seconds.
 */
export function setCache(key, value, ttlSeconds = DEFAULT_TTL) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  })
}

/**
 * Delete a single key.
 */
export function deleteCache(key) {
  store.delete(key)
}

/**
 * Delete all keys whose name starts with the given prefix.
 * Call this on create/update/delete so stale lists are removed.
 */
export function clearCacheByPrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

/**
 * Wipe the entire cache (e.g. on boot or forced invalidation).
 */
export function clearAllCache() {
  store.clear()
}
