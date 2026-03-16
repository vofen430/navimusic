// API response caching with sessionStorage
import { slimSongs } from '../utils/slimSong'
const CACHE_PREFIX = 'cm_cache_'
const DEFAULT_TTL = 10 * 60 * 1000 // 10 minutes

export function useCache() {
  function get(key) {
    try {
      const raw = sessionStorage.getItem(CACHE_PREFIX + key)
      if (!raw) return null
      const { data, expiry } = JSON.parse(raw)
      if (Date.now() > expiry) {
        sessionStorage.removeItem(CACHE_PREFIX + key)
        return null
      }
      return data
    } catch {
      return null
    }
  }

  function set(key, data, ttl = DEFAULT_TTL) {
    try {
      sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
        data,
        expiry: Date.now() + ttl
      }))
    } catch {
      // Storage full, clear old entries
      clearExpired()
    }
  }

  function remove(key) {
    sessionStorage.removeItem(CACHE_PREFIX + key)
  }

  function clearExpired() {
    const now = Date.now()
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i)
      if (k?.startsWith(CACHE_PREFIX)) {
        try {
          const { expiry } = JSON.parse(sessionStorage.getItem(k))
          if (now > expiry) sessionStorage.removeItem(k)
        } catch {
          sessionStorage.removeItem(k)
        }
      }
    }
  }

  // Cached fetch: returns cached data immediately if available, fetches in background
  async function cachedFetch(key, fetchFn, ttl = DEFAULT_TTL) {
    const cached = get(key)
    if (cached) return cached

    const data = await fetchFn()
    set(key, data, ttl)
    return data
  }

  return { get, set, remove, clearExpired, cachedFetch }
}

// ─── IndexedDB helpers ───
const IDB_NAME = 'cloudmusic-cache'
const IDB_VERSION = 1
const IDB_STORE = 'playlist-songs'

let _dbPromise = null

function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { _dbPromise = null; resolve(null) }
  })
  return _dbPromise
}

function idbGet(id) {
  return openDB().then(db => {
    if (!db) return null
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly')
        const req = tx.objectStore(IDB_STORE).get(id)
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => resolve(null)
      } catch { resolve(null) }
    })
  })
}

function idbPut(id, songs, expiry) {
  return openDB().then(db => {
    if (!db) return
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put({ id, songs, expiry })
    } catch { /* ignore */ }
  })
}

function idbDelete(id) {
  return openDB().then(db => {
    if (!db) return
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).delete(id)
    } catch { /* ignore */ }
  })
}

function idbCleanExpired() {
  return openDB().then(db => {
    if (!db) return
    const now = Date.now()
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      const store = tx.objectStore(IDB_STORE)
      const req = store.openCursor()
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) return
        if (cursor.value.expiry && now > cursor.value.expiry) {
          cursor.delete()
        }
        cursor.continue()
      }
    } catch { /* ignore */ }
  })
}

// ─── LRU + IndexedDB playlist songs cache ───
const LRU_MAX = 3
const PLAYLIST_TTL = 15 * 60 * 1000 // 15 minutes

// LRU memory cache: Map preserves insertion order, most recent at end
const _lruCache = new Map()

// Periodic cleanup: run once on first use
let _cleanupScheduled = false
function scheduleCleanup() {
  if (_cleanupScheduled) return
  _cleanupScheduled = true
  // Clean expired IDB entries every 5 minutes
  setInterval(() => { idbCleanExpired() }, 5 * 60 * 1000)
  // Also clean on first load
  idbCleanExpired()
}

function lruGet(id) {
  const entry = _lruCache.get(id)
  if (!entry) return null
  if (Date.now() > entry.expiry) {
    _lruCache.delete(id)
    return null
  }
  // Move to end (most recently used)
  _lruCache.delete(id)
  _lruCache.set(id, entry)
  return entry.songs
}

function lruSet(id, songs, ttl = PLAYLIST_TTL) {
  const expiry = Date.now() + ttl
  // If already exists, remove first to refresh order
  _lruCache.delete(id)
  // Evict oldest if at capacity
  if (_lruCache.size >= LRU_MAX) {
    const oldestKey = _lruCache.keys().next().value
    _lruCache.delete(oldestKey)
  }
  _lruCache.set(id, { songs: slimSongs(songs), expiry })
  // Persist to IndexedDB (fire and forget)
  idbPut(id, slimSongs(songs), expiry)
}

export function usePlaylistCache() {
  scheduleCleanup()

  /**
   * Get songs from cache. Checks LRU memory first, then IndexedDB.
   * Returns songs array or null. This is async due to IndexedDB fallback.
   */
  async function getSongs(playlistId) {
    // 1. Check LRU memory cache
    const memResult = lruGet(playlistId)
    if (memResult) return memResult

    // 2. Fallback to IndexedDB
    const dbEntry = await idbGet(playlistId)
    if (!dbEntry) return null
    if (Date.now() > dbEntry.expiry) {
      idbDelete(playlistId)
      return null
    }
    // Promote back to LRU memory
    lruSet(playlistId, dbEntry.songs, dbEntry.expiry - Date.now())
    return dbEntry.songs
  }

  /**
   * Synchronous LRU-only check (for immediate cache hits without awaiting IDB).
   * Returns songs or null.
   */
  function getSongsSync(playlistId) {
    return lruGet(playlistId)
  }

  function setSongs(playlistId, songs, ttl = PLAYLIST_TTL) {
    lruSet(playlistId, songs, ttl)
  }

  function invalidate(playlistId) {
    _lruCache.delete(playlistId)
    idbDelete(playlistId)
  }

  function preloadSongs(playlistId, fetchFn) {
    // Check LRU memory first (sync)
    if (_lruCache.has(playlistId)) return
    // Check IDB then fetch
    idbGet(playlistId).then(entry => {
      if (entry && Date.now() <= entry.expiry) {
        lruSet(playlistId, entry.songs, entry.expiry - Date.now())
        return
      }
      fetchFn().then(songs => {
        setSongs(playlistId, songs)
      }).catch(() => {})
    })
  }

  return { getSongs, getSongsSync, setSongs, invalidate, preloadSongs }
}

// Expose LRU cache reference for memoryManager
export function getLruCache() { return _lruCache }
