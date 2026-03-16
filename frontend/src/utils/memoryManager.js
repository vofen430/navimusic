/**
 * Dynamic memory release manager.
 *
 * Three tiers:
 *  1. Idle GC — every 5 min, evicts stale LRU entries and clears expired sessionStorage
 *  2. Low-memory response — if performance.measureUserAgentSpecificMemory is available,
 *     triggers aggressive cleanup when heap exceeds threshold
 *  3. Visibility-based — when the tab goes hidden, runs a lighter cleanup pass
 */

const IDLE_GC_INTERVAL = 5 * 60 * 1000        // 5 minutes
const MEMORY_CHECK_INTERVAL = 2 * 60 * 1000   // 2 minutes
const CACHE_PREFIX = 'cm_cache_'

let _idleTimer = null
let _memoryTimer = null
let _visibilityHandler = null
let _lruCacheRef = null  // will be set via init()

/**
 * Clean expired sessionStorage entries.
 */
function cleanSessionStorage() {
  const now = Date.now()
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const k = sessionStorage.key(i)
    if (k?.startsWith(CACHE_PREFIX)) {
      try {
        const { expiry } = JSON.parse(sessionStorage.getItem(k))
        if (now > expiry) sessionStorage.removeItem(k)
      } catch { sessionStorage.removeItem(k) }
    }
  }
}

/**
 * Evict LRU entries that haven't been accessed in a while.
 */
function cleanLRU(maxAge = 10 * 60 * 1000) {
  if (!_lruCacheRef) return
  const now = Date.now()
  for (const [id, entry] of _lruCacheRef) {
    if (now > entry.expiry || (entry.lastAccess && now - entry.lastAccess > maxAge)) {
      _lruCacheRef.delete(id)
    }
  }
}

/**
 * Aggressive cleanup — called under memory pressure.
 * Clears all sessionStorage cache and reduces LRU to just 1 entry.
 */
function aggressiveCleanup() {
  // Clear all sessionStorage cache entries
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const k = sessionStorage.key(i)
    if (k?.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(k)
  }
  // Reduce LRU to 1 entry (keep most recent)
  if (_lruCacheRef && _lruCacheRef.size > 1) {
    const keys = [..._lruCacheRef.keys()]
    // Keep only the last (most recently used) entry
    for (let i = 0; i < keys.length - 1; i++) {
      _lruCacheRef.delete(keys[i])
    }
  }
}

function idleGC() {
  cleanSessionStorage()
  cleanLRU()
}

function onVisibilityChange() {
  if (document.hidden) {
    // Tab hidden — light cleanup
    cleanSessionStorage()
    cleanLRU(5 * 60 * 1000)
  }
}

/**
 * Initialize the memory manager. Call once from App.vue onMounted.
 * @param {Map} lruCache - reference to the LRU Map from useCache.js
 */
export function initMemoryManager(lruCache = null) {
  _lruCacheRef = lruCache

  // Tier 1: Periodic idle GC
  if (_idleTimer) clearInterval(_idleTimer)
  _idleTimer = setInterval(idleGC, IDLE_GC_INTERVAL)

  // Tier 2: Low-memory detection (if available)
  if (typeof performance !== 'undefined' && performance.measureUserAgentSpecificMemory) {
    if (_memoryTimer) clearInterval(_memoryTimer)
    _memoryTimer = setInterval(async () => {
      try {
        const mem = await performance.measureUserAgentSpecificMemory()
        // If JS heap > 150MB, trigger aggressive cleanup
        if (mem.bytes > 150 * 1024 * 1024) {
          aggressiveCleanup()
        }
      } catch { /* API not available in this context */ }
    }, MEMORY_CHECK_INTERVAL)
  }

  // Tier 3: Visibility-based cleanup
  if (_visibilityHandler) document.removeEventListener('visibilitychange', _visibilityHandler)
  _visibilityHandler = onVisibilityChange
  document.addEventListener('visibilitychange', _visibilityHandler)
}

export function destroyMemoryManager() {
  if (_idleTimer) { clearInterval(_idleTimer); _idleTimer = null }
  if (_memoryTimer) { clearInterval(_memoryTimer); _memoryTimer = null }
  if (_visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler)
    _visibilityHandler = null
  }
  _lruCacheRef = null
}
