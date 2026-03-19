import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { getSongUrl, getSongDetail, getLyric, getAlbumDetail, ugcSongGet, getPersonalFM, fmTrash as apiFmTrash, likeSong, dbAddPlay, dbGetLyrics, dbSetLyrics } from '../api'
import { slimSong, slimSongs } from '../utils/slimSong'
import api from '../api'

// Maximum playlist size — FIFO eviction when exceeded
const MAX_PLAYLIST_SIZE = 100

export const usePlayerStore = defineStore('player', () => {
  // State
  const currentSong = ref(null)
  const playlist = ref([])
  const currentIndex = ref(-1)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(0.8)
  const isMuted = ref(false)
  const playMode = ref('list') // list | random | single
  const isFullscreen = ref(false)
  const lyrics = ref([])
  const currentLyricIndex = ref(0)
  const audioUrl = ref('')
  const isLoading = ref(false)
  const themeColor = ref('')  // Extracted from cover: 'r, g, b'

  // Unified cover URL — all components should use this to avoid duplicate requests
  const coverUrl200 = computed(() => {
    const url = currentSong.value?.al?.picUrl
    return url ? url + '?param=200y200' : ''
  })

  // ─── Centralized song metadata (shared between PlayerBar & PlayerFull) ───
  const songMeta = ref(null)        // { album, albumId, genres, language, publishTime, version, bpm, instruments }
  const songMetaLoading = ref(false)
  const songInfo = ref({ likeCount: 0, commentCount: 0 })

  // Audio element
  let audio = null

  function getAudio() {
    if (!audio) {
      audio = new Audio()
      audio.preload = 'auto' // aggressively buffer audio for smooth playback
      audio.volume = volume.value
      audio.addEventListener('timeupdate', () => {
        currentTime.value = audio.currentTime
        updateLyricIndex()
      })
      audio.addEventListener('durationchange', () => {
        duration.value = audio.duration
      })
      audio.addEventListener('ended', () => {
        playNext()
      })
      audio.addEventListener('error', (e) => {
        console.error('Audio error:', e)
        isPlaying.value = false
      })
    }
    return audio
  }

  // Computed
  const progress = computed(() => {
    if (!duration.value) return 0
    return (currentTime.value / duration.value) * 100
  })

  const hasNext = computed(() => {
    if (playMode.value === 'single') return true
    return currentIndex.value < playlist.value.length - 1 || playMode.value === 'list'
  })

  const hasPrev = computed(() => {
    if (playMode.value === 'single') return true
    return currentIndex.value > 0 || playMode.value === 'list'
  })

  // ─── Playlist size enforcement ───
  function enforcePlaylistCap() {
    if (playlist.value.length <= MAX_PLAYLIST_SIZE) return
    const excess = playlist.value.length - MAX_PLAYLIST_SIZE
    // Remove from the beginning (FIFO)
    playlist.value.splice(0, excess)
    // Adjust currentIndex
    currentIndex.value = Math.max(0, currentIndex.value - excess)
  }

  // Actions
  async function playSong(song, list = null, index = -1, _fromFm = false) {
    isLoading.value = true
    try {
      // Exit FM mode when user plays from a non-FM source
      if (!_fromFm && fmMode.value) {
        fmMode.value = false
        fmPlaying.value = false
      }

      if (list) {
        // If list is larger than cap, take a window around the target index
        const slimList = slimSongs(list)
        if (slimList.length > MAX_PLAYLIST_SIZE) {
          const targetIdx = index >= 0 ? index : slimList.findIndex(s => s.id === song.id)
          const half = Math.floor(MAX_PLAYLIST_SIZE / 2)
          let start = Math.max(0, targetIdx - half)
          let end = start + MAX_PLAYLIST_SIZE
          if (end > slimList.length) {
            end = slimList.length
            start = Math.max(0, end - MAX_PLAYLIST_SIZE)
          }
          playlist.value = slimList.slice(start, end)
          currentIndex.value = targetIdx - start
        } else {
          playlist.value = slimList
          currentIndex.value = index >= 0 ? index : slimList.findIndex(s => s.id === song.id)
        }
      } else if (currentSong.value?.id !== song.id) {
        const existIdx = playlist.value.findIndex(s => s.id === song.id)
        if (existIdx >= 0) {
          currentIndex.value = existIdx
        } else {
          playlist.value.push(song)
          currentIndex.value = playlist.value.length - 1
          enforcePlaylistCap()
        }
      }

      currentSong.value = slimSong(song)

      // Get playable URL
      const urlRes = await getSongUrl(song.id, 'exhigh')
      const urlData = urlRes.data?.[0]
      if (!urlData?.url) {
        console.warn('Song URL not available')
        isLoading.value = false
        return
      }

      audioUrl.value = urlData.url
      const a = getAudio()
      a.src = urlData.url
      a.play()
      isPlaying.value = true

      // Record play history (fire-and-forget)
      try {
        dbAddPlay({
          songId: song.id,
          songName: song.name,
          artist: song.ar?.map(a => a.name).join(', ') || '',
          coverUrl: song.al?.picUrl || '',
          albumName: song.al?.name || ''
        })
      } catch {}

      // Load lyrics — delay slightly to let audio buffering get priority
      setTimeout(() => loadLyrics(song.id), 300)
    } catch (e) {
      console.error('Failed to play song:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function loadLyrics(id) {
    try {
      // Check DB cache first
      try {
        const cached = await dbGetLyrics(id)
        if (cached.code === 200 && cached.data) {
          lyrics.value = cached.data
          currentLyricIndex.value = 0
          return
        }
      } catch {}

      // Fetch from API
      const res = await getLyric(id)
      const lrcStr = res.lrc?.lyric || ''
      const tLrcStr = res.tlyric?.lyric || ''
      const parsed = parseLrc(lrcStr)

      // Merge translations by timestamp
      if (tLrcStr) {
        const tMap = new Map()
        for (const t of parseLrc(tLrcStr)) {
          tMap.set(t.time, t.text)
        }
        for (const line of parsed) {
          const trans = tMap.get(line.time)
          if (trans) line.tText = trans
        }
      }

      lyrics.value = parsed
      currentLyricIndex.value = 0

      // Cache to DB (fire-and-forget)
      if (parsed.length) {
        try { dbSetLyrics(id, parsed) } catch {}
      }
    } catch {
      lyrics.value = []
    }
  }

  function parseLrc(lrcStr) {
    const lines = lrcStr.split('\n')
    const result = []
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/
    for (const line of lines) {
      const match = regex.exec(line)
      if (match) {
        const min = parseInt(match[1])
        const sec = parseInt(match[2])
        const ms = parseInt(match[3].padEnd(3, '0'))
        const time = min * 60 + sec + ms / 1000
        const text = line.replace(regex, '').trim()
        if (text) {
          result.push({ time, text })
        }
      }
    }
    return result.sort((a, b) => a.time - b.time)
  }

  function updateLyricIndex() {
    if (!lyrics.value.length) return
    const t = currentTime.value
    for (let i = lyrics.value.length - 1; i >= 0; i--) {
      if (t >= lyrics.value[i].time) {
        currentLyricIndex.value = i
        return
      }
    }
    currentLyricIndex.value = 0
  }

  function togglePlay() {
    const a = getAudio()
    if (isPlaying.value) {
      a.pause()
    } else {
      a.play()
    }
    isPlaying.value = !isPlaying.value
  }

  function playNext() {
    // In FM mode, delegate to fmNext for auto-play
    if (fmMode.value) {
      fmNext()
      return
    }
    if (!playlist.value.length) return
    let nextIdx
    if (playMode.value === 'single') {
      nextIdx = currentIndex.value
    } else if (playMode.value === 'random') {
      nextIdx = Math.floor(Math.random() * playlist.value.length)
    } else {
      nextIdx = (currentIndex.value + 1) % playlist.value.length
    }
    playSong(playlist.value[nextIdx], null, -1)
    currentIndex.value = nextIdx
  }

  function playPrev() {
    if (!playlist.value.length) return
    let prevIdx
    if (playMode.value === 'single') {
      prevIdx = currentIndex.value
    } else if (playMode.value === 'random') {
      prevIdx = Math.floor(Math.random() * playlist.value.length)
    } else {
      prevIdx = (currentIndex.value - 1 + playlist.value.length) % playlist.value.length
    }
    playSong(playlist.value[prevIdx], null, -1)
    currentIndex.value = prevIdx
  }

  function seek(percent) {
    const a = getAudio()
    if (duration.value) {
      a.currentTime = (percent / 100) * duration.value
    }
  }

  function setVolume(val) {
    volume.value = val
    const a = getAudio()
    a.volume = val
    isMuted.value = val === 0
  }

  function toggleMute() {
    const a = getAudio()
    isMuted.value = !isMuted.value
    a.volume = isMuted.value ? 0 : volume.value
  }

  function togglePlayMode() {
    // Exit FM mode when user manually switches play mode
    if (fmMode.value) {
      fmMode.value = false
      fmPlaying.value = false
    }
    const modes = ['list', 'random', 'single']
    const idx = modes.indexOf(playMode.value)
    playMode.value = modes[(idx + 1) % modes.length]
  }

  function toggleFullscreen() {
    isFullscreen.value = !isFullscreen.value
  }

  function addToPlaylist(song) {
    if (!playlist.value.find(s => s.id === song.id)) {
      playlist.value.push(slimSong(song))
      enforcePlaylistCap()
    }
  }

  function removeFromPlaylist(index) {
    playlist.value.splice(index, 1)
    if (index < currentIndex.value) {
      currentIndex.value--
    } else if (index === currentIndex.value) {
      if (playlist.value.length) {
        const nextIdx = Math.min(index, playlist.value.length - 1)
        playSong(playlist.value[nextIdx])
        currentIndex.value = nextIdx
      } else {
        currentSong.value = null
        isPlaying.value = false
        getAudio().pause()
      }
    }
  }

  function clearPlaylist() {
    playlist.value = []
    currentIndex.value = -1
    currentSong.value = null
    isPlaying.value = false
    getAudio().pause()
  }

  // ─── Centralized song metadata watcher ───
  // Loads comment count, like count, and full song metadata whenever the current song changes.
  // This replaces the separate watchers in PlayerBar.vue and PlayerFull.vue.
  // Extract dominant color from cover image
  function extractThemeColor(url) {
    if (!url) { themeColor.value = ''; return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = url + '?param=50y50'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 50; canvas.height = 50
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, 50, 50)
        const data = ctx.getImageData(0, 0, 50, 50).data
        // Sample and find most vibrant color
        let bestColor = [80, 80, 120]
        let bestSat = 0
        for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel
          const r = data[i], g = data[i+1], b = data[i+2]
          const max = Math.max(r, g, b), min = Math.min(r, g, b)
          const l = (max + min) / 2
          if (l < 30 || l > 230) continue // skip near-black/near-white
          const sat = max === 0 ? 0 : (max - min) / max
          if (sat > bestSat) { bestSat = sat; bestColor = [r, g, b] }
        }
        themeColor.value = bestColor.join(', ')
      } catch { themeColor.value = '' }
    }
    img.onerror = () => { themeColor.value = '' }
  }

  watch(() => currentSong.value?.id, async (id) => {
    if (!id) {
      songMeta.value = null
      songInfo.value = { likeCount: 0, commentCount: 0 }
      songMetaLoading.value = false
      themeColor.value = ''
      return
    }

    // Extract theme color from cover
    const coverUrl = currentSong.value?.al?.picUrl
    extractThemeColor(coverUrl)

    songInfo.value = { likeCount: 0, commentCount: 0 }
    songMetaLoading.value = true
    songMeta.value = null

    // Wait for audio to buffer enough before loading non-critical metadata
    // This ensures the audio stream gets maximum bandwidth during initial load
    const a = audio
    if (a && a.readyState < 3) {
      await new Promise(resolve => {
        const onReady = () => { a.removeEventListener('canplay', onReady); resolve() }
        a.addEventListener('canplay', onReady)
        // Fallback timeout: don't wait forever (2s max)
        setTimeout(() => { a.removeEventListener('canplay', onReady); resolve() }, 2000)
      })
    }

    // Fetch comment count (fire and forget, non-blocking)
    try {
      const res = await api.get('/comment/new', { params: { type: 0, id, pageSize: 1, pageNo: 1, sortType: 1 } })
      songInfo.value.commentCount = (res.data || res).totalCount || 0
    } catch {}

    // Song metadata: album, genre, language, release date, version, BPM, instruments
    try {
      const song = currentSong.value
      const meta = {
        album: song.al?.name || '', albumId: song.al?.id,
        genres: '', language: '', publishTime: '', version: '', bpm: '', instruments: ''
      }

      const [detailResult, wikiResult, ugcResult, albumResult] = await Promise.allSettled([
        getSongDetail(String(id)),
        api.get('/song/wiki/summary', { params: { id } }),
        ugcSongGet(id),
        song.al?.id ? getAlbumDetail(song.al.id) : Promise.resolve(null),
      ])

      // --- Song detail: publishTime, version/aliases ---
      if (detailResult.status === 'fulfilled') {
        const detail = detailResult.value?.songs?.[0]
        if (detail) {
          if (detail.publishTime || detail.al?.publishTime) {
            const ts = detail.publishTime || detail.al?.publishTime
            if (ts && ts > 0) {
              const d = new Date(ts)
              meta.publishTime = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`
            }
          }
          if (detail.alia?.length) meta.version = detail.alia.join(', ')
        }
      }

      // --- Album detail ---
      if (albumResult.status === 'fulfilled' && albumResult.value) {
        const albumData = albumResult.value?.album || albumResult.value
        if (albumData) {
          if (albumData.publishTime && albumData.publishTime > 0 && !meta.publishTime) {
            const d = new Date(albumData.publishTime)
            meta.publishTime = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`
          }
          if (albumData.company && !meta.version) meta.version = albumData.company
          if (albumData.subType) meta.version = [meta.version, albumData.subType].filter(Boolean).join(' · ')
        }
      }

      // --- Wiki summary ---
      if (wikiResult.status === 'fulfilled') {
        const wikiData = wikiResult.value?.data || wikiResult.value
        if (wikiData) {
          const blocks = wikiData.blocks || []
          for (const block of blocks) {
            for (const c of (block.creatives || [])) {
              const key = (c.creativeType || '').toLowerCase()
              const val = c.resources?.map(r => r.uiElement?.mainTitle?.title).filter(Boolean).join(', ') || c.content || ''
              if (!val) continue
              if (key.includes('bpm') || key === 'bpm') meta.bpm = val
              else if (key === 'language' || key.includes('语种') || key.includes('lang')) meta.language = val
              else if (key === 'genre' || key.includes('曲风') || key.includes('风格') || key.includes('style')) meta.genres = val
              else if (key.includes('乐器') || key === 'instrument' || key.includes('instrumen')) meta.instruments = val
            }
          }
        }
      }

      // --- UGC fallback ---
      if (ugcResult.status === 'fulfilled') {
        const ugcData = ugcResult.value?.data || ugcResult.value
        if (ugcData) {
          if (ugcData.tags && Array.isArray(ugcData.tags)) {
            const tagNames = ugcData.tags.map(t => t.name || t).filter(Boolean).join(', ')
            if (tagNames && !meta.genres) meta.genres = tagNames
          }
          if (ugcData.bpm && !meta.bpm) meta.bpm = String(ugcData.bpm)
          if (ugcData.language && !meta.language) meta.language = ugcData.language
          if (ugcData.instruments && !meta.instruments) {
            meta.instruments = Array.isArray(ugcData.instruments)
              ? ugcData.instruments.map(i => i.name || i).join(', ') : String(ugcData.instruments)
          }
        }
      }

      songMeta.value = meta
    } catch { songMeta.value = null }
    finally { songMetaLoading.value = false }
  }, { immediate: true })

  // ─── Personal FM ───
  const fmSong = ref(null)
  const fmPlaying = ref(false)
  const fmMode = ref(false) // true when FM is active
  const fmBuffer = ref([])  // pre-loaded FM songs from backend

  // Pre-load FM songs from backend into buffer
  async function loadFmBuffer() {
    try {
      const res = await getPersonalFM()
      const songs = res.data || []
      if (songs.length) {
        fmBuffer.value.push(...songs)
      }
    } catch { console.error('FM load failed') }
  }

  // Take next song from buffer, refill if running low
  function shiftFmBuffer() {
    const song = fmBuffer.value.shift() || null
    // When buffer is low (<=1 remaining), pre-fetch more in background
    if (fmBuffer.value.length <= 1) {
      loadFmBuffer()
    }
    return song
  }

  async function toggleFm() {
    if (!fmSong.value) {
      // First time: fill buffer and take first song
      await loadFmBuffer()
      fmSong.value = shiftFmBuffer()
      if (!fmSong.value) return
    }
    if (!fmPlaying.value) {
      fmMode.value = true
      // Start FM: set playlist to just this FM song
      const slim = slimSong(fmSong.value)
      playlist.value = [slim]
      currentIndex.value = 0
      playSong(fmSong.value, null, -1, true)
      currentIndex.value = 0
      fmPlaying.value = true
    } else {
      togglePlay()
      fmPlaying.value = isPlaying.value
    }
  }

  async function fmNext() {
    // Get next song from buffer
    let nextSong = shiftFmBuffer()
    if (!nextSong) {
      // Buffer empty, force fetch
      await loadFmBuffer()
      nextSong = shiftFmBuffer()
    }
    if (nextSong) {
      fmSong.value = nextSong
      fmMode.value = true
      // Append the new song to the visible playlist
      const slim = slimSong(nextSong)
      playlist.value.push(slim)
      enforcePlaylistCap()
      const newIdx = playlist.value.length - 1
      currentIndex.value = newIdx
      playSong(nextSong, null, -1, true)
      currentIndex.value = newIdx
      fmPlaying.value = true
    }
  }

  async function fmTrashSong() {
    if (!fmSong.value) return
    try { await apiFmTrash(fmSong.value.id) } catch {}
    await fmNext()
  }

  async function fmLikeSong(userStore) {
    if (!fmSong.value) return
    try {
      const like = !userStore.isLiked(fmSong.value.id)
      await likeSong(fmSong.value.id, like)
      userStore.fetchLikeList()
      window.__toast?.(like ? '已添加到喜欢' : '已取消喜欢', 'success')
    } catch { window.__toast?.('操作失败', 'error') }
  }

  // Sync FM playing state with main player
  watch(isPlaying, (val) => {
    if (fmMode.value) fmPlaying.value = val
  })

  return {
    currentSong, playlist, currentIndex, isPlaying, currentTime, duration,
    volume, isMuted, playMode, isFullscreen, lyrics, currentLyricIndex,
    audioUrl, isLoading, progress, hasNext, hasPrev, themeColor, coverUrl200,
    songMeta, songMetaLoading, songInfo,
    fmSong, fmPlaying, fmMode,
    playSong, togglePlay, playNext, playPrev, seek, setVolume, toggleMute,
    togglePlayMode, toggleFullscreen, loadLyrics, addToPlaylist,
    removeFromPlaylist, clearPlaylist,
    loadFmBuffer, toggleFm, fmNext, fmTrashSong, fmLikeSong
  }
})
