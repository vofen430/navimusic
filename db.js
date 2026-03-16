/**
 * SQLite database layer using better-sqlite3.
 *
 * Tables:
 *   play_history     – song play records (capped at 2000)
 *   download_records – download log (capped at 500)
 *   search_history   – recent searches (capped at 200)
 *   user_settings    – key/value pairs
 *   api_cache        – API response cache (capped at 5000, LRU eviction)
 *   lyrics_cache     – lyrics cache (capped at 2000, LRU eviction)
 */

const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = path.join(__dirname, 'data', 'cloudmusic.db')

// Ensure data directory exists
const fs = require('fs')
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)

// Performance pragmas
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')

// ═══════════════════════════════════════════
//  Schema
// ═══════════════════════════════════════════

db.exec(`
  CREATE TABLE IF NOT EXISTS play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL,
    song_name TEXT NOT NULL,
    artist TEXT DEFAULT '',
    cover_url TEXT DEFAULT '',
    album_name TEXT DEFAULT '',
    played_at DATETIME DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_ph_song ON play_history(song_id);
  CREATE INDEX IF NOT EXISTS idx_ph_time ON play_history(played_at);

  CREATE TABLE IF NOT EXISTS download_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL UNIQUE,
    song_name TEXT NOT NULL,
    artist TEXT DEFAULT '',
    cover_url TEXT DEFAULT '',
    quality TEXT DEFAULT 'standard',
    file_url TEXT DEFAULT '',
    status TEXT DEFAULT 'completed',
    downloaded_at DATETIME DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL UNIQUE,
    count INTEGER DEFAULT 1,
    last_searched DATETIME DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS api_cache (
    cache_key TEXT PRIMARY KEY,
    response TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now','localtime')),
    last_hit DATETIME DEFAULT (datetime('now','localtime')),
    hit_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS lyrics_cache (
    song_id INTEGER PRIMARY KEY,
    lyrics TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now','localtime')),
    last_hit DATETIME DEFAULT (datetime('now','localtime')),
    hit_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS wallpaper_gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT DEFAULT '',
    mode TEXT DEFAULT 'canvas',
    image_data TEXT NOT NULL,
    thumb_data TEXT DEFAULT '',
    palette TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT (datetime('now','localtime'))
  );
`)

// Migration: add mode column if missing
try {
  db.prepare(`SELECT mode FROM wallpaper_gallery LIMIT 1`).get()
} catch {
  db.prepare(`ALTER TABLE wallpaper_gallery ADD COLUMN mode TEXT DEFAULT 'canvas'`).run()
}

// ═══════════════════════════════════════════
//  Table caps & eviction
// ═══════════════════════════════════════════

const CAPS = {
  play_history: 2000,
  download_records: 500,
  search_history: 200,
  api_cache: 5000,
  lyrics_cache: 2000,
  wallpaper_gallery: 200,
}

/**
 * Evict oldest rows when table exceeds cap.
 * For cache tables, evicts by LRU (last_hit); for others, by primary key.
 */
function evict(table) {
  const cap = CAPS[table]
  if (!cap) return
  const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get()
  if (countRow.cnt <= cap) return

  const excess = countRow.cnt - cap
  if (table === 'api_cache') {
    db.prepare(`DELETE FROM api_cache WHERE cache_key IN (SELECT cache_key FROM api_cache ORDER BY last_hit ASC LIMIT ?)`).run(excess)
  } else if (table === 'lyrics_cache') {
    db.prepare(`DELETE FROM lyrics_cache WHERE song_id IN (SELECT song_id FROM lyrics_cache ORDER BY last_hit ASC LIMIT ?)`).run(excess)
  } else if (table === 'wallpaper_gallery') {
    db.prepare(`DELETE FROM wallpaper_gallery WHERE id IN (SELECT id FROM wallpaper_gallery ORDER BY created_at ASC LIMIT ?)`).run(excess)
  } else {
    db.prepare(`DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} ORDER BY id ASC LIMIT ?)`).run(excess)
  }
}

// ═══════════════════════════════════════════
//  Play History
// ═══════════════════════════════════════════

const stmts = {
  insertPlay: db.prepare(`INSERT INTO play_history (song_id, song_name, artist, cover_url, album_name) VALUES (?, ?, ?, ?, ?)`),
  getPlayHistory: db.prepare(`SELECT * FROM play_history ORDER BY played_at DESC LIMIT ? OFFSET ?`),
  getPlayCount: db.prepare(`SELECT COUNT(*) as cnt FROM play_history`),
  getMostPlayed: db.prepare(`SELECT song_id, song_name, artist, cover_url, album_name, COUNT(*) as play_count FROM play_history GROUP BY song_id ORDER BY play_count DESC LIMIT ?`),

  // Download
  upsertDownload: db.prepare(`INSERT INTO download_records (song_id, song_name, artist, cover_url, quality, file_url, status) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(song_id) DO UPDATE SET file_url=excluded.file_url, quality=excluded.quality, status=excluded.status, downloaded_at=datetime('now','localtime')`),
  getDownloads: db.prepare(`SELECT * FROM download_records ORDER BY downloaded_at DESC LIMIT ? OFFSET ?`),
  deleteDownload: db.prepare(`DELETE FROM download_records WHERE song_id = ?`),

  // Search
  upsertSearch: db.prepare(`INSERT INTO search_history (keyword) VALUES (?) ON CONFLICT(keyword) DO UPDATE SET count=count+1, last_searched=datetime('now','localtime')`),
  getSearchHistory: db.prepare(`SELECT * FROM search_history ORDER BY last_searched DESC LIMIT ?`),
  deleteSearch: db.prepare(`DELETE FROM search_history WHERE keyword = ?`),
  clearSearchHistory: db.prepare(`DELETE FROM search_history`),

  // Settings
  setSetting: db.prepare(`INSERT INTO user_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now','localtime')`),
  getSetting: db.prepare(`SELECT value FROM user_settings WHERE key = ?`),
  getAllSettings: db.prepare(`SELECT key, value FROM user_settings`),
  deleteSetting: db.prepare(`DELETE FROM user_settings WHERE key = ?`),

  // API Cache
  setApiCache: db.prepare(`INSERT INTO api_cache (cache_key, response) VALUES (?, ?) ON CONFLICT(cache_key) DO UPDATE SET response=excluded.response, created_at=datetime('now','localtime'), last_hit=datetime('now','localtime'), hit_count=0`),
  getApiCache: db.prepare(`SELECT response FROM api_cache WHERE cache_key = ?`),
  touchApiCache: db.prepare(`UPDATE api_cache SET last_hit=datetime('now','localtime'), hit_count=hit_count+1 WHERE cache_key = ?`),
  deleteApiCache: db.prepare(`DELETE FROM api_cache WHERE cache_key = ?`),
  clearApiCache: db.prepare(`DELETE FROM api_cache`),
  apiCacheStats: db.prepare(`SELECT COUNT(*) as cnt, SUM(LENGTH(response)) as total_bytes FROM api_cache`),

  // Lyrics Cache
  setLyrics: db.prepare(`INSERT INTO lyrics_cache (song_id, lyrics) VALUES (?, ?) ON CONFLICT(song_id) DO UPDATE SET lyrics=excluded.lyrics, created_at=datetime('now','localtime'), last_hit=datetime('now','localtime'), hit_count=0`),
  getLyrics: db.prepare(`SELECT lyrics FROM lyrics_cache WHERE song_id = ?`),
  touchLyrics: db.prepare(`UPDATE lyrics_cache SET last_hit=datetime('now','localtime'), hit_count=hit_count+1 WHERE song_id = ?`),
  clearLyrics: db.prepare(`DELETE FROM lyrics_cache`),
  lyricsCacheStats: db.prepare(`SELECT COUNT(*) as cnt FROM lyrics_cache`),

  // Wallpaper Gallery (mode-aware)
  insertWallpaper: db.prepare(`INSERT INTO wallpaper_gallery (name, mode, image_data, thumb_data, palette) VALUES (?, ?, ?, ?, ?)`),
  getWallpapers: db.prepare(`SELECT id, name, mode, thumb_data, palette, created_at FROM wallpaper_gallery WHERE mode = ? ORDER BY created_at ASC`),
  getWallpaper: db.prepare(`SELECT * FROM wallpaper_gallery WHERE id = ?`),
  deleteWallpaper: db.prepare(`DELETE FROM wallpaper_gallery WHERE id = ?`),
  countWallpapers: db.prepare(`SELECT COUNT(*) as cnt FROM wallpaper_gallery WHERE mode = ?`),
}

// ═══════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════

module.exports = {
  // ─── Play History ───
  addPlayRecord(songId, songName, artist = '', coverUrl = '', albumName = '') {
    stmts.insertPlay.run(songId, songName, artist, coverUrl, albumName)
    evict('play_history')
  },
  getPlayHistory(limit = 50, offset = 0) {
    return stmts.getPlayHistory.all(limit, offset)
  },
  getPlayHistoryCount() {
    return stmts.getPlayCount.get().cnt
  },
  getMostPlayed(limit = 20) {
    return stmts.getMostPlayed.all(limit)
  },

  // ─── Downloads ───
  addDownload(songId, songName, artist = '', coverUrl = '', quality = 'standard', fileUrl = '', status = 'completed') {
    stmts.upsertDownload.run(songId, songName, artist, coverUrl, quality, fileUrl, status)
    evict('download_records')
  },
  getDownloads(limit = 50, offset = 0) {
    return stmts.getDownloads.all(limit, offset)
  },
  deleteDownload(songId) {
    stmts.deleteDownload.run(songId)
  },

  // ─── Search History ───
  addSearch(keyword) {
    stmts.upsertSearch.run(keyword)
    evict('search_history')
  },
  getSearchHistory(limit = 30) {
    return stmts.getSearchHistory.all(limit)
  },
  deleteSearch(keyword) {
    stmts.deleteSearch.run(keyword)
  },
  clearSearchHistory() {
    stmts.clearSearchHistory.run()
  },

  // ─── Settings ───
  setSetting(key, value) {
    stmts.setSetting.run(key, typeof value === 'string' ? value : JSON.stringify(value))
  },
  getSetting(key) {
    const row = stmts.getSetting.get(key)
    if (!row) return null
    try { return JSON.parse(row.value) } catch { return row.value }
  },
  getAllSettings() {
    const rows = stmts.getAllSettings.all()
    const result = {}
    for (const r of rows) {
      try { result[r.key] = JSON.parse(r.value) } catch { result[r.key] = r.value }
    }
    return result
  },
  deleteSetting(key) {
    stmts.deleteSetting.run(key)
  },

  // ─── API Cache ───
  setApiCache(key, responseData) {
    stmts.setApiCache.run(key, JSON.stringify(responseData))
    evict('api_cache')
  },
  getApiCache(key) {
    const row = stmts.getApiCache.get(key)
    if (!row) return null
    stmts.touchApiCache.run(key)
    try { return JSON.parse(row.response) } catch { return null }
  },
  deleteApiCache(key) {
    stmts.deleteApiCache.run(key)
  },
  clearApiCache() {
    stmts.clearApiCache.run()
  },
  getApiCacheStats() {
    return stmts.apiCacheStats.get()
  },

  // ─── Lyrics Cache ───
  setLyrics(songId, lyricsData) {
    stmts.setLyrics.run(songId, JSON.stringify(lyricsData))
    evict('lyrics_cache')
  },
  getLyrics(songId) {
    const row = stmts.getLyrics.get(songId)
    if (!row) return null
    stmts.touchLyrics.run(songId)
    try { return JSON.parse(row.lyrics) } catch { return null }
  },
  clearLyrics() {
    stmts.clearLyrics.run()
  },
  getLyricsCacheStats() {
    return stmts.lyricsCacheStats.get()
  },

  // ─── Wallpaper Gallery (mode-aware) ───
  addWallpaper(name, mode, imageData, thumbData, palette) {
    const info = stmts.insertWallpaper.run(name, mode || 'canvas', imageData, thumbData, JSON.stringify(palette))
    evict('wallpaper_gallery')
    return info.lastInsertRowid
  },
  getWallpapers(mode) {
    return stmts.getWallpapers.all(mode || 'canvas').map(r => {
      try { r.palette = JSON.parse(r.palette) } catch { r.palette = [] }
      return r
    })
  },
  getWallpaper(id) {
    return stmts.getWallpaper.get(id)
  },
  deleteWallpaper(id) {
    stmts.deleteWallpaper.run(id)
  },
  countWallpapers(mode) {
    return stmts.countWallpapers.get(mode || 'canvas').cnt
  },

  // ─── DB Utilities ───
  close() {
    db.close()
  },
  getDbStats() {
    const tables = ['play_history', 'download_records', 'search_history', 'user_settings', 'api_cache', 'lyrics_cache']
    const stats = {}
    for (const t of tables) {
      stats[t] = db.prepare(`SELECT COUNT(*) as count FROM ${t}`).get().count
    }
    // File size
    try {
      const stat = fs.statSync(DB_PATH)
      stats.file_size_mb = (stat.size / 1024 / 1024).toFixed(2)
    } catch { stats.file_size_mb = '0' }
    return stats
  }
}
