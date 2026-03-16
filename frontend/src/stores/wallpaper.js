import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api'

// Built-in wallpaper filenames per mode
const BUILTIN_WALLS = {
  canvas: ['001-城市背影.png', '003-星辰.png', '城市.png'],
  pure:   ['橘色云朵.png'],
}

// ─── One-time seeding (called at app startup) ───
// Sets flag FIRST, then imports — prevents re-entry even if called multiple times
const _seedingPromises = {}

export async function seedAllBuiltins() {
  await Promise.all(['canvas', 'pure'].map(mode => seedBuiltins(mode)))
}

async function seedBuiltins(mode) {
  // Deduplicate: if already seeding this mode, wait for existing promise
  if (_seedingPromises[mode]) return _seedingPromises[mode]

  _seedingPromises[mode] = (async () => {
    const seedKey = `seeded_${mode}`
    try {
      const res = await api.get(`/db/settings/${seedKey}`)
      if (res?.data === true || res?.data === 'true') return
    } catch {}

    const builtinFiles = BUILTIN_WALLS[mode] || []
    if (!builtinFiles.length) return

    // Set flag IMMEDIATELY to prevent re-import on concurrent/re-open
    await api.post('/db/settings', { key: seedKey, value: 'true' })

    console.log(`[Seed] Importing built-in wallpapers for ${mode}...`)
    for (const file of builtinFiles) {
      try {
        const url = `/builtin-walls/${mode}/${encodeURIComponent(file)}`
        const resp = await fetch(url)
        if (!resp.ok) continue
        const blob = await resp.blob()
        const imageData = await blobToDataURL(blob)
        const thumbData = await generateThumb(imageData)
        const palette = await extractPalette(imageData)
        await api.post('/db/wallpapers', { name: file, mode, imageData, thumbData, palette })
        console.log(`[Seed] Imported: ${mode}/${file}`)
      } catch (e) { console.warn(`[Seed] Failed to import ${file}:`, e) }
    }
  })()

  return _seedingPromises[mode]
}

function blobToDataURL(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })
}

// ─── Palette extraction (browser canvas) ───
function extractPalette(imageData) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        const size = 64
        c.width = size; c.height = size
        const ctx = c.getContext('2d')
        ctx.drawImage(img, 0, 0, size, size)
        const data = ctx.getImageData(0, 0, size, size).data
        const colors = {}
        for (let i = 0; i < data.length; i += 16) {
          const r = Math.round(data[i] / 32) * 32
          const g = Math.round(data[i+1] / 32) * 32
          const b = Math.round(data[i+2] / 32) * 32
          const key = `${r},${g},${b}`
          colors[key] = (colors[key] || 0) + 1
        }
        const sorted = Object.entries(colors).sort((a, b) => b[1] - a[1])
        resolve(sorted.slice(0, 5).map(([c]) => c))
      } catch { resolve([]) }
    }
    img.onerror = () => resolve([])
    img.src = imageData
  })
}

function generateThumb(imageData) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      const s = 200 / Math.max(img.width, img.height)
      c.width = img.width * s; c.height = img.height * s
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = () => resolve(imageData)
    img.src = imageData
  })
}


// ─── Store factory ───
function createWallpaperStore(mode, storeName, defaultWallpaperName) {
  return defineStore(storeName, () => {
    const wallpapers = ref([])
    const currentIndex = ref(-1)
    const currentFull = ref('')

    const currentWallpaper = computed(() =>
      currentIndex.value >= 0 && currentIndex.value < wallpapers.value.length
        ? wallpapers.value[currentIndex.value]
        : null
    )
    const currentPalette = computed(() => currentWallpaper.value?.palette || [])

    async function fetchWallpapers() {
      try {
        const res = await api.get(`/db/wallpapers?mode=${mode}`)
        wallpapers.value = res.data || []
      } catch (e) { console.error(`fetchWallpapers(${mode}):`, e) }
    }

    // ─── Image cache ───
    const imageCache = new Map()
    const CACHE_MAX = 5

    async function loadFullImage(id) {
      if (imageCache.has(id)) {
        currentFull.value = imageCache.get(id)
        return
      }
      try {
        const res = await api.get(`/db/wallpapers/${id}`)
        const data = res.data?.image_data || ''
        currentFull.value = data
        imageCache.set(id, data)
        if (imageCache.size > CACHE_MAX) {
          const oldest = imageCache.keys().next().value
          imageCache.delete(oldest)
        }
      } catch (e) { console.error(`loadFullImage(${mode}):`, e) }
    }

    function preloadAdjacent() {
      const len = wallpapers.value.length
      if (len <= 1) return
      const ci = currentIndex.value
      const prevIdx = (ci - 1 + len) % len
      const nextIdx = (ci + 1) % len
      const prevId = wallpapers.value[prevIdx]?.id
      const nextId = wallpapers.value[nextIdx]?.id
      if (prevId && !imageCache.has(prevId)) {
        api.get(`/db/wallpapers/${prevId}`).then(r => {
          imageCache.set(prevId, r.data?.image_data || '')
        }).catch(() => {})
      }
      if (nextId && !imageCache.has(nextId)) {
        api.get(`/db/wallpapers/${nextId}`).then(r => {
          imageCache.set(nextId, r.data?.image_data || '')
        }).catch(() => {})
      }
    }

    async function selectWallpaper(index) {
      if (index < 0 || index >= wallpapers.value.length) return
      currentIndex.value = index
      await loadFullImage(wallpapers.value[index].id)
      saveState()
      preloadAdjacent()
    }

    function nextWallpaper() {
      if (!wallpapers.value.length) return
      selectWallpaper((currentIndex.value + 1) % wallpapers.value.length)
    }
    function prevWallpaper() {
      if (!wallpapers.value.length) return
      selectWallpaper((currentIndex.value - 1 + wallpapers.value.length) % wallpapers.value.length)
    }
    function randomWallpaper() {
      if (wallpapers.value.length <= 1) return
      let idx
      do { idx = Math.floor(Math.random() * wallpapers.value.length) }
      while (idx === currentIndex.value)
      selectWallpaper(idx)
    }

    async function uploadWallpaper(name, imageData, thumbData, palette) {
      try {
        const res = await api.post('/db/wallpapers', { name, mode, imageData, thumbData, palette })
        await fetchWallpapers()
        const idx = wallpapers.value.findIndex(w => w.id === res.id)
        if (idx >= 0) await selectWallpaper(idx)
        return res.id
      } catch (e) { console.error(`uploadWallpaper(${mode}):`, e); return null }
    }

    async function deleteWallpaper(id) {
      try {
        await api.delete(`/db/wallpapers/${id}`)
        await fetchWallpapers()
        if (currentIndex.value >= wallpapers.value.length) {
          currentIndex.value = Math.max(0, wallpapers.value.length - 1)
        }
        if (wallpapers.value.length) await loadFullImage(wallpapers.value[currentIndex.value].id)
        else currentFull.value = ''
      } catch (e) { console.error(`deleteWallpaper(${mode}):`, e) }
    }

    // ─── Persistence ───
    const STORAGE_KEY = `wallpaper-${mode}-state`

    function saveState() {
      try {
        const wpId = wallpapers.value[currentIndex.value]?.id
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          wallpaperId: wpId,
          wallpaperIndex: currentIndex.value,
        }))
      } catch {}
    }

    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        return JSON.parse(raw)
      } catch { return null }
    }

    // Initialize: fetch wallpapers, restore last used or pick default
    // Seeding is NOT done here — it's done once at app startup via seedAllBuiltins()
    async function init() {
      await fetchWallpapers()
      if (!wallpapers.value.length) return

      const saved = loadState()
      if (saved?.wallpaperId) {
        const idx = wallpapers.value.findIndex(w => w.id === saved.wallpaperId)
        if (idx >= 0) {
          await selectWallpaper(idx)
          return
        }
      }

      if (defaultWallpaperName) {
        const idx = wallpapers.value.findIndex(w => w.name === defaultWallpaperName)
        if (idx >= 0) {
          await selectWallpaper(idx)
          return
        }
      }

      await selectWallpaper(0)
    }

    return {
      wallpapers, currentIndex, currentFull, currentWallpaper, currentPalette,
      fetchWallpapers, selectWallpaper, nextWallpaper, prevWallpaper, randomWallpaper,
      uploadWallpaper, deleteWallpaper, loadFullImage,
      init, saveState,
    }
  })
}

// Canvas mode store (default: 001-城市背影.png)
export const useCanvasStore = createWallpaperStore('canvas', 'canvasWallpaper', '001-城市背影.png')

// Pure mode store (default: 橘色云朵.png)
export const usePureWallpaperStore = createWallpaperStore('pure', 'pureWallpaper', '橘色云朵.png')
