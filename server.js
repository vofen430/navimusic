const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const NeteaseApi = require('NeteaseCloudMusicApi');
const db = require('./db');

// ─── Sync app icon from assets/ to frontend/public/ on startup ───
(function syncIcon() {
  const RES = process.env.RESOURCE_PATH || __dirname;
  const src = path.join(RES, 'assets', 'icon.png');
  const dst = path.join(__dirname, 'frontend', 'public', 'icon.png');
  try {
    if (!fs.existsSync(src)) return;
    const srcHash = crypto.createHash('md5').update(fs.readFileSync(src)).digest('hex');
    let dstHash = '';
    if (fs.existsSync(dst)) {
      dstHash = crypto.createHash('md5').update(fs.readFileSync(dst)).digest('hex');
    }
    if (srcHash !== dstHash) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      console.log('[Icon] Synced assets/icon.png → frontend/public/icon.png');
    }
  } catch (e) { console.warn('[Icon] Sync failed:', e.message); }
})();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
// Skip JSON body parsing for the cover upload route (needs raw binary)
app.use((req, res, next) => {
  if (req.path === '/api/playlist/cover/upload') return next();
  express.json({ limit: '10mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

// Serve Vue frontend build
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// Resource base path (different in packaged Electron vs dev)
const RES = process.env.RESOURCE_PATH || __dirname;

// Serve built-in wallpapers
app.use('/builtin-walls/canvas', express.static(path.join(RES, 'assets', 'wallpapers', 'canvas')));
app.use('/builtin-walls/pure', express.static(path.join(RES, 'assets', 'wallpapers', 'pure')));

// ─── Cookie Store (simple in-memory) ───
let globalCookie = '';

const COOKIE_ATTR_KEYS = new Set([
  'path', 'expires', 'max-age', 'domain', 'secure', 'httponly', 'samesite',
  'priority', 'partitioned'
]);

function extractCookiePairs(cookieSource) {
  const cookieMap = new Map();
  if (!cookieSource) return cookieMap;

  const cookieItems = Array.isArray(cookieSource) ? cookieSource : [cookieSource];
  for (const item of cookieItems) {
    if (typeof item !== 'string') continue;

    // `result.cookie` is usually an array of Set-Cookie strings.
    if (item.includes('\n') || item.toLowerCase().includes('httponly') || item.toLowerCase().includes('path=')) {
      const firstSegment = item.split(';')[0];
      const eqIndex = firstSegment.indexOf('=');
      if (eqIndex <= 0) continue;
      const key = firstSegment.slice(0, eqIndex).trim();
      const value = firstSegment.slice(eqIndex + 1).trim();
      if (!key || COOKIE_ATTR_KEYS.has(key.toLowerCase())) continue;
      cookieMap.set(key, value);
      continue;
    }

    // `body.cookie` is usually a cookie header string like `a=1; b=2`.
    for (const segment of item.split(';')) {
      const trimmed = segment.trim();
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex <= 0) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!key || COOKIE_ATTR_KEYS.has(key.toLowerCase())) continue;
      cookieMap.set(key, value);
    }
  }

  return cookieMap;
}

function mergeCookies(...sources) {
  const cookieMap = new Map();
  for (const source of sources) {
    for (const [key, value] of extractCookiePairs(source)) {
      cookieMap.set(key, value);
    }
  }
  return Array.from(cookieMap.entries()).map(([key, value]) => `${key}=${value}`).join('; ');
}

function buildBrowserSetCookieHeaders(cookieHeader) {
  return Array.from(extractCookiePairs(cookieHeader).entries()).map(([key, value]) =>
    `${key}=${value}; Path=/; SameSite=Lax`
  );
}

// ─── Generic API proxy ───
// Maps frontend requests to NeteaseCloudMusicApi module functions
const API_ROUTE_MAP = {
  // Auth
  'login/cellphone': 'login_cellphone',
  'login/qr/key': 'login_qr_key',
  'login/qr/create': 'login_qr_create',
  'login/qr/check': 'login_qr_check',
  'login/status': 'login_status',
  'login/refresh': 'login_refresh',
  'register/anonimous': 'register_anonimous',
  'logout': 'logout',
  'captcha/sent': 'captcha_sent',
  'captcha/verify': 'captcha_verify',

  // User
  'user/account': 'user_account',
  'user/detail': 'user_detail',
  'user/subcount': 'user_subcount',
  'user/playlist': 'user_playlist',
  'user/record': 'user_record',
  'user/level': 'user_level',

  // Playlist management
  'playlist/create': 'playlist_create',
  'playlist/delete': 'playlist_delete',
  'playlist/update': 'playlist_update',
  'playlist/desc/update': 'playlist_desc_update',
  'playlist/name/update': 'playlist_name_update',
  'playlist/tags/update': 'playlist_tags_update',
  'playlist/detail': 'playlist_detail',
  'playlist/track/all': 'playlist_track_all',
  'playlist/tracks': 'playlist_tracks',
  'playlist/subscribe': 'playlist_subscribe',
  'playlist/order/update': 'playlist_order_update',
  'playlist/privacy': 'playlist_privacy',
  'playlist/catlist': 'playlist_catlist',
  'playlist/hot': 'playlist_hot',
  'playlist/detail/dynamic': 'playlist_detail_dynamic',
  'playlist/highquality/tags': 'playlist_highquality_tags',
  'song/order/update': 'song_order_update',

  // Songs
  'song/detail': 'song_detail',
  'song/url': 'song_url',
  'song/url/v1': 'song_url_v1',
  'check/music': 'check_music',
  'like': 'like',
  'likelist': 'likelist',
  'lyric': 'lyric',
  'lyric/new': 'lyric_new',

  // Discover / Recommend
  'banner': 'banner',
  'personalized': 'personalized',
  'personalized/newsong': 'personalized_newsong',
  'personalized/mv': 'personalized_mv',
  'recommend/resource': 'recommend_resource',
  'recommend/songs': 'recommend_songs',
  'recommend/songs/dislike': 'recommend_songs_dislike',
  'history/recommend/songs': 'history_recommend_songs',
  'history/recommend/songs/detail': 'history_recommend_songs_detail',
  'personal_fm': 'personal_fm',
  'homepage/block/page': 'homepage_block_page',
  'top/playlist': 'top_playlist',
  'top/playlist/highquality': 'top_playlist_highquality',
  'top/song': 'top_song',
  'top/artists': 'top_artists',
  'toplist': 'toplist',
  'toplist/detail': 'toplist_detail',
  'related/playlist': 'related_playlist',

  // Style / Genre
  'style/list': 'style_list',
  'style/preference': 'style_preference',
  'style/detail': 'style_detail',
  'style/song': 'style_song',
  'style/playlist': 'style_playlist',
  'style/artist': 'style_artist',
  'style/album': 'style_album',

  // Search
  'search': 'search',
  'cloudsearch': 'cloudsearch',
  'search/default': 'search_default',
  'search/hot': 'search_hot',
  'search/hot/detail': 'search_hot_detail',
  'search/suggest': 'search_suggest',
  'search/multimatch': 'search_multimatch',

  // Artist
  'artist/list': 'artist_list',
  'artist/detail': 'artist_detail',
  'artist/top/song': 'artist_top_song',
  'artist/songs': 'artist_songs',
  'artist/sub': 'artist_sub',
  'artist/sublist': 'artist_sublist',
  'artists': 'artists',

  // Album
  'album': 'album',
  'album/new': 'album_new',
  'album/newest': 'album_newest',
  'album/detail/dynamic': 'album_detail_dynamic',
  'top/album': 'top_album',

  // Similar
  'simi/song': 'simi_song',
  'simi/playlist': 'simi_playlist',
  'simi/artist': 'simi_artist',

  // Playmode
  'playmode/intelligence/list': 'playmode_intelligence_list',

  // Style
  'style/list': 'style_list',
  'style/preference': 'style_preference',
  'style/detail': 'style_detail',
  'style/song': 'style_song',

  // Comments
  'comment/new': 'comment_new',
  'comment/hot': 'comment_hot',
  'comment/music': 'comment_music',
  'comment/like': 'comment_like',

  // Song wiki / encyclopedia
  'song/wiki/summary': 'song_wiki_summary',
  'ugc/song/get': 'ugc_song_get',
  'song/music/detail': 'song_music_detail',

  // Playlist cover
  'playlist/cover/update': 'playlist_cover_update',

  // Misc
  'scrobble': 'scrobble',
  'fm_trash': 'fm_trash',
  'daily_signin': 'daily_signin',
};

// ─── Playlist cover upload (must be BEFORE the catch-all /api/:route) ───
app.post('/api/playlist/cover/upload',
  express.raw({ type: ['image/jpeg', 'image/png', 'application/octet-stream'], limit: '5mb' }),
  async (req, res) => {
    const playlistId = req.query.id;
    if (!playlistId) {
      return res.status(400).json({ code: 400, message: 'id (playlist ID) is required' });
    }
    if (!req.body || !req.body.length) {
      return res.status(400).json({ code: 400, message: 'Image data is required in request body' });
    }

    try {
      const requestCookie = req.headers.cookie || '';
      const mergedCookie = mergeCookies(globalCookie, requestCookie);
      const params = {
        id: playlistId,
        imgFile: {
          name: `cover_${playlistId}_${Date.now()}.jpg`,
          data: req.body,  // Buffer
        },
      };
      if (mergedCookie) params.cookie = mergedCookie;

      const result = await NeteaseApi.playlist_cover_update(params);

      // Update cookies
      const responseCookie = mergeCookies(requestCookie, globalCookie, result.body?.cookie, result.cookie);
      if (responseCookie) {
        globalCookie = responseCookie;
        const setCookieHeaders = buildBrowserSetCookieHeaders(responseCookie);
        if (setCookieHeaders.length) res.setHeader('Set-Cookie', setCookieHeaders);
      }

      res.status(result.status || 200).json(result.body);
    } catch (error) {
      console.error('Cover upload error:', error.body || error.message || error);
      const status = error.status || error.body?.code || 500;
      const body = error.body || { code: status, message: error.message || 'Upload failed' };
      res.status(typeof status === 'number' ? status : 500).json(body);
    }
  }
);

// ─── Wallpaper Gallery (mode-aware, must be BEFORE the catch-all /api/:route) ───
app.get('/api/db/wallpapers', (req, res) => {
  try {
    const mode = req.query.mode || 'canvas';
    res.json({ code: 200, data: db.getWallpapers(mode) });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.get('/api/db/wallpapers/:id', (req, res) => {
  try {
    const wp = db.getWallpaper(parseInt(req.params.id));
    if (!wp) return res.status(404).json({ code: 404, message: 'Not found' });
    res.json({ code: 200, data: wp });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.post('/api/db/wallpapers', (req, res) => {
  try {
    const { name, mode, imageData, thumbData, palette } = req.body;
    if (!imageData) return res.status(400).json({ code: 400, message: 'imageData required' });
    const id = db.addWallpaper(name || '', mode || 'canvas', imageData, thumbData || '', palette || []);
    res.json({ code: 200, id });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.delete('/api/db/wallpapers/:id', (req, res) => {
  try { db.deleteWallpaper(parseInt(req.params.id)); res.json({ code: 200 }); }
  catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// ─── Settings (must be BEFORE the catch-all /api/:route) ───
app.get('/api/db/settings', (req, res) => {
  try { res.json({ code: 200, data: db.getAllSettings() }); }
  catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.get('/api/db/settings/:key', (req, res) => {
  try { res.json({ code: 200, data: db.getSetting(req.params.key) }); }
  catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.post('/api/db/settings', (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ code: 400, message: 'key required' });
    db.setSetting(key, value);
    res.json({ code: 200 });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.delete('/api/db/settings/:key', (req, res) => {
  try { db.deleteSetting(req.params.key); res.json({ code: 200 }); }
  catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// Dynamic API handler
app.all('/api/:route(*)', async (req, res) => {
  const route = req.params.route;
  const fnName = API_ROUTE_MAP[route];

  if (!fnName || !NeteaseApi[fnName]) {
    return res.status(404).json({ code: 404, message: `API not found: ${route}` });
  }

  try {
    const params = { ...req.query, ...req.body };
    const requestCookie = req.headers.cookie || '';
    const mergedRequestCookie = mergeCookies(globalCookie, requestCookie);
    if (mergedRequestCookie) {
      params.cookie = mergedRequestCookie;
    }

    const result = await NeteaseApi[fnName](params);

    const responseCookie = mergeCookies(requestCookie, globalCookie, result.body?.cookie, result.cookie);
    if (responseCookie) {
      globalCookie = responseCookie;
      const setCookieHeaders = buildBrowserSetCookieHeaders(responseCookie);
      if (setCookieHeaders.length) {
        res.setHeader('Set-Cookie', setCookieHeaders);
      }
    }

    res.status(result.status || 200).json(result.body);
  } catch (error) {
    console.error(`API error [${route}]:`, error.body || error.message || error);
    const status = error.status || error.body?.code || 500;
    const body = error.body || { code: status, message: error.message || 'Internal server error' };
    res.status(typeof status === 'number' ? status : 500).json(body);
  }
});



// ─── NCMPlus conversion endpoint ───
const NCMPLUS_BIN = path.join(__dirname, 'ncmplus', 'build', 'ncmplus');

app.post('/api/ncmplus/convert', (req, res) => {
  const { inputPath, outputPath, keepFlac } = req.body;
  if (!inputPath) {
    return res.status(400).json({ code: 400, message: 'inputPath required' });
  }

  const args = [inputPath];
  if (outputPath) args.push('-o', outputPath);
  if (keepFlac) args.push('-f');

  execFile(NCMPLUS_BIN, args, { timeout: 60000 }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ code: 500, message: stderr || error.message });
    }
    res.json({ code: 200, message: 'Conversion complete', output: stdout });
  });
});

// ═══════════════════════════════════════════════════════
//  Database API Routes  /api/db/*
// ═══════════════════════════════════════════════════════

// ─── Play History ───
app.post('/api/db/play-history', (req, res) => {
  try {
    const { songId, songName, artist, coverUrl, albumName } = req.body;
    if (!songId || !songName) return res.status(400).json({ code: 400, message: 'songId and songName required' });
    db.addPlayRecord(songId, songName, artist, coverUrl, albumName);
    res.json({ code: 200 });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.get('/api/db/play-history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const rows = db.getPlayHistory(limit, offset);
    const total = db.getPlayHistoryCount();
    res.json({ code: 200, data: rows, total });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.get('/api/db/play-history/most', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    res.json({ code: 200, data: db.getMostPlayed(limit) });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// ─── Downloads ───
app.post('/api/db/downloads', (req, res) => {
  try {
    const { songId, songName, artist, coverUrl, quality, fileUrl, status } = req.body;
    if (!songId || !songName) return res.status(400).json({ code: 400, message: 'songId and songName required' });
    db.addDownload(songId, songName, artist, coverUrl, quality, fileUrl, status);
    res.json({ code: 200 });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.get('/api/db/downloads', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    res.json({ code: 200, data: db.getDownloads(limit, offset) });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.delete('/api/db/downloads/:songId', (req, res) => {
  try { db.deleteDownload(parseInt(req.params.songId)); res.json({ code: 200 }); }
  catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// ─── Search History ───
app.post('/api/db/search-history', (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ code: 400, message: 'keyword required' });
    db.addSearch(keyword);
    res.json({ code: 200 });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.get('/api/db/search-history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    res.json({ code: 200, data: db.getSearchHistory(limit) });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.delete('/api/db/search-history/:keyword', (req, res) => {
  try { db.deleteSearch(req.params.keyword); res.json({ code: 200 }); }
  catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.delete('/api/db/search-history', (req, res) => {
  try { db.clearSearchHistory(); res.json({ code: 200 }); }
  catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});


// ─── API Cache ───
app.get('/api/db/cache/stats', (req, res) => {
  try { res.json({ code: 200, data: db.getApiCacheStats() }); }
  catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.get('/api/db/cache/:key', (req, res) => {
  try {
    const data = db.getApiCache(req.params.key);
    if (data === null) return res.json({ code: 404, data: null });
    res.json({ code: 200, data });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.post('/api/db/cache', (req, res) => {
  try {
    const { key, response } = req.body;
    if (!key) return res.status(400).json({ code: 400, message: 'key required' });
    db.setApiCache(key, response);
    res.json({ code: 200 });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.delete('/api/db/cache', (req, res) => {
  try { db.clearApiCache(); res.json({ code: 200 }); }
  catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// ─── Lyrics Cache ───
app.get('/api/db/lyrics/stats', (req, res) => {
  try { res.json({ code: 200, data: db.getLyricsCacheStats() }); }
  catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.get('/api/db/lyrics/:songId', (req, res) => {
  try {
    const data = db.getLyrics(parseInt(req.params.songId));
    if (data === null) return res.json({ code: 404, data: null });
    res.json({ code: 200, data });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.post('/api/db/lyrics', (req, res) => {
  try {
    const { songId, lyrics } = req.body;
    if (!songId) return res.status(400).json({ code: 400, message: 'songId required' });
    db.setLyrics(songId, lyrics);
    res.json({ code: 200 });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});
app.delete('/api/db/lyrics', (req, res) => {
  try { db.clearLyrics(); res.json({ code: 200 }); }
  catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// ─── DB Stats ───
app.get('/api/db/stats', (req, res) => {
  try { res.json({ code: 200, data: db.getDbStats() }); }
  catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// ─── SPA fallback ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🎵 NaviMusic API server running on http://localhost:${PORT}`);
});
