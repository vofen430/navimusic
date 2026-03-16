import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  withCredentials: true,
})

api.interceptors.response.use(
  response => response.data,
  error => {
    const msg = error.response?.data?.message || error.message || '请求失败'
    console.error('API Error:', msg)
    return Promise.reject(error)
  }
)

// ─── Auth ───
export const loginByPhone = (phone, password) =>
  api.get('/login/cellphone', { params: { phone, password, timestamp: Date.now() } })

export const getQRKey = () =>
  api.get('/login/qr/key', { params: { timestamp: Date.now() } })

export const createQR = (key) =>
  api.get('/login/qr/create', { params: { key, qrimg: true, timestamp: Date.now() } })

export const checkQR = (key) =>
  api.get('/login/qr/check', { params: { key, timestamp: Date.now(), noCookie: true } })

export const getLoginStatus = () =>
  api.get('/login/status', { params: { timestamp: Date.now() } })

export const logout = () =>
  api.get('/logout', { params: { timestamp: Date.now() } })

export const registerAnonymous = () =>
  api.get('/register/anonimous', { params: { timestamp: Date.now() } })

// ─── User ───
export const getUserAccount = () =>
  api.get('/user/account')

export const getUserDetail = (uid) =>
  api.get('/user/detail', { params: { uid } })

export const getUserPlaylists = (uid, limit = 50, offset = 0) =>
  api.get('/user/playlist', { params: { uid, limit, offset } })

export const getUserRecord = (uid, type = 0) =>
  api.get('/user/record', { params: { uid, type } })

// ─── Playlist Management ───
export const createPlaylist = (name, privacy = false) =>
  api.get('/playlist/create', { params: { name, privacy: privacy ? 10 : undefined, timestamp: Date.now() } })

export const deletePlaylist = (id) =>
  api.get('/playlist/delete', { params: { id, timestamp: Date.now() } })

export const updatePlaylist = (id, name, desc, tags) =>
  api.get('/playlist/update', { params: { id, name, desc, tags, timestamp: Date.now() } })

export const getPlaylistDetail = (id) =>
  api.get('/playlist/detail', { params: { id } })

export const getPlaylistAllSongs = (id, limit = 1000, offset = 0) =>
  api.get('/playlist/track/all', { params: { id, limit, offset } })

export const addSongToPlaylist = (pid, tracks) =>
  api.get('/playlist/tracks', { params: { op: 'add', pid, tracks, timestamp: Date.now() } })

export const removeSongFromPlaylist = (pid, tracks) =>
  api.get('/playlist/tracks', { params: { op: 'del', pid, tracks, timestamp: Date.now() } })

export const subscribePlaylist = (id, t = 1) =>
  api.get('/playlist/subscribe', { params: { id, t, timestamp: Date.now() } })

export const makePlaylistPublic = (id) =>
  api.get('/playlist/privacy', { params: { id, timestamp: Date.now() } })

export const updatePlaylistCover = (id, imageBlob) =>
  axios.post(`/api/playlist/cover/upload?id=${id}&timestamp=${Date.now()}`, imageBlob, {
    headers: { 'Content-Type': imageBlob.type || 'image/jpeg' },
    withCredentials: true,
  }).then(res => res.data)

export const getPlaylistCategories = () =>
  api.get('/playlist/catlist')

// ─── Songs ───
export const getSongDetail = (ids) =>
  api.get('/song/detail', { params: { ids } })

export const getSongUrl = (id, level = 'exhigh') =>
  api.get('/song/url/v1', { params: { id, level } })

export const checkMusic = (id) =>
  api.get('/check/music', { params: { id } })

export const likeSong = (id, like = true) =>
  api.get('/like', { params: { id, like, timestamp: Date.now() } })

export const getLikeList = (uid) =>
  api.get('/likelist', { params: { uid } })

export const getLyric = (id) =>
  api.get('/lyric/new', { params: { id } })

// ─── Discover / Recommend ───
export const getBanner = (type = 0) =>
  api.get('/banner', { params: { type } })

export const getPersonalized = (limit = 12) =>
  api.get('/personalized', { params: { limit } })

export const getPersonalizedNewSong = (limit = 12) =>
  api.get('/personalized/newsong', { params: { limit } })

export const getRecommendSongs = () =>
  api.get('/recommend/songs')

export const getHistoryRecommendDates = () =>
  api.get('/history/recommend/songs')

export const getHistoryRecommendDetail = (date) =>
  api.get('/history/recommend/songs/detail', { params: { date } })

export const getRecommendResource = () =>
  api.get('/recommend/resource')

export const getPersonalFM = () =>
  api.get('/personal_fm')

export const getTopSong = (type = 0) =>
  api.get('/top/song', { params: { type } })

export const getTopPlaylist = (limit = 20, order = 'hot', cat = '全部') =>
  api.get('/top/playlist', { params: { limit, order, cat } })

export const getTopPlaylistHighquality = (limit = 20, cat = '全部') =>
  api.get('/top/playlist/highquality', { params: { limit, cat } })

export const getTopArtists = (limit = 30) =>
  api.get('/top/artists', { params: { limit } })

export const getToplist = () =>
  api.get('/toplist')

export const getToplistDetail = () =>
  api.get('/toplist/detail')

export const getSimiSong = (id) =>
  api.get('/simi/song', { params: { id } })

export const getSimiPlaylist = (id) =>
  api.get('/simi/playlist', { params: { id } })

export const getIntelligenceList = (id, pid, sid) =>
  api.get('/playmode/intelligence/list', { params: { id, pid, sid } })

export const dislikeRecommendSong = (id) =>
  api.get('/recommend/songs/dislike', { params: { id, timestamp: Date.now() } })

// ─── Genre / Style ───
export const getStyleList = () =>
  api.get('/style/list')

export const getStylePreference = () =>
  api.get('/style/preference')

export const getStyleDetail = (tagId) =>
  api.get('/style/detail', { params: { tagId } })

export const getStyleSongs = (tagId, size = 20, cursor = 0, sort = 0) =>
  api.get('/style/song', { params: { tagId, size, cursor, sort } })

export const getStylePlaylists = (tagId, size = 20, cursor = 0) =>
  api.get('/style/playlist', { params: { tagId, size, cursor } })

export const getStyleArtists = (tagId, size = 20, cursor = 0) =>
  api.get('/style/artist', { params: { tagId, size, cursor } })

export const getPlaylistHotTags = () =>
  api.get('/playlist/hot')

// ─── Search ───
export const search = (keywords, type = 1, limit = 30, offset = 0) =>
  api.get('/cloudsearch', { params: { keywords, type, limit, offset } })

export const searchSuggest = (keywords) =>
  api.get('/search/suggest', { params: { keywords } })

export const searchMultimatch = (keywords) =>
  api.get('/search/multimatch', { params: { keywords } })

export const searchHotDetail = () =>
  api.get('/search/hot/detail')

export const searchDefault = () =>
  api.get('/search/default')

// ─── Artist ───
export const getArtistDetail = (id) =>
  api.get('/artist/detail', { params: { id } })

export const getArtistTopSong = (id) =>
  api.get('/artist/top/song', { params: { id } })

export const getArtistSongs = (id, limit = 50, offset = 0, order = 'hot') =>
  api.get('/artist/songs', { params: { id, limit, offset, order } })

// ─── Album ───
export const getAlbumDetail = (id) =>
  api.get('/album', { params: { id } })

// ─── Song Extended Info ───
export const ugcSongGet = (id) =>
  api.get('/ugc/song/get', { params: { id } })

export const songMusicDetail = (id) =>
  api.get('/song/music/detail', { params: { id } })

// ─── Misc ───
export const scrobble = (id, sourceid, time) =>
  api.get('/scrobble', { params: { id, sourceid, time, timestamp: Date.now() } })

export const fmTrash = (id) =>
  api.get('/fm_trash', { params: { id, timestamp: Date.now() } })

// ═══════════════════════════════════════════
//  Database API  /api/db/*
// ═══════════════════════════════════════════

// Play History
export const dbAddPlay = (data) => api.post('/db/play-history', data)
export const dbGetPlayHistory = (limit = 50, offset = 0) => api.get('/db/play-history', { params: { limit, offset } })
export const dbGetMostPlayed = (limit = 20) => api.get('/db/play-history/most', { params: { limit } })

// Downloads
export const dbAddDownload = (data) => api.post('/db/downloads', data)
export const dbGetDownloads = (limit = 50, offset = 0) => api.get('/db/downloads', { params: { limit, offset } })
export const dbDeleteDownload = (songId) => api.delete(`/db/downloads/${songId}`)

// Search History
export const dbAddSearch = (keyword) => api.post('/db/search-history', { keyword })
export const dbGetSearchHistory = (limit = 30) => api.get('/db/search-history', { params: { limit } })
export const dbDeleteSearch = (keyword) => api.delete(`/db/search-history/${encodeURIComponent(keyword)}`)
export const dbClearSearchHistory = () => api.delete('/db/search-history')

// Settings
export const dbGetSettings = () => api.get('/db/settings')
export const dbGetSetting = (key) => api.get(`/db/settings/${key}`)
export const dbSetSetting = (key, value) => api.post('/db/settings', { key, value })

// API Cache
export const dbGetCache = (key) => api.get(`/db/cache/${encodeURIComponent(key)}`)
export const dbSetCache = (key, response) => api.post('/db/cache', { key, response })
export const dbClearCache = () => api.delete('/db/cache')
export const dbCacheStats = () => api.get('/db/cache/stats')

// Lyrics Cache
export const dbGetLyrics = (songId) => api.get(`/db/lyrics/${songId}`)
export const dbSetLyrics = (songId, lyrics) => api.post('/db/lyrics', { songId, lyrics })
export const dbClearLyrics = () => api.delete('/db/lyrics')

// DB Stats
export const dbStats = () => api.get('/db/stats')

export default api
