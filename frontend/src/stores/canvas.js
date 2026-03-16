import { defineStore, storeToRefs } from 'pinia'
import { ref } from 'vue'
import api from '../api'
import { useCanvasStore as useCanvasWallpaperStore } from './wallpaper'

// Canvas Mode layout store (elements, text, positioning)
// Wallpaper functionality is in stores/wallpaper.js
export const useCanvasStore = defineStore('canvas', () => {
  // Re-export wallpaper store with proper reactivity
  const wp = useCanvasWallpaperStore()
  const { wallpapers, currentIndex, currentFull, currentWallpaper, currentPalette } = storeToRefs(wp)

  // ─── Element Layout (hardcoded defaults from current DB snapshot) ───
  const defaultElements = () => ({
    title:  { x: 6, y: 27.71, size: 65, color: '#f7d08d', font: "'TGS Perfect Condensed'", align: 'left', shadow: false },
    artist: { x: 6, y: 37.89, size: 26, color: '#f7d08d', font: "'TGS Perfect Condensed'", align: 'left', shadow: false },
    custom: { x: 6, y: 42.28, size: 28, color: '#f7d08d', font: "'TGS Perfect Condensed'", align: 'left', shadow: false },
    lyric:  { x: 50, y: 87.25, size: 21, color: '#f7d08d', font: "'Franklin Gothic Medium'", align: 'center', shadow: false },
  })

  const elements = ref(defaultElements())
  const customText = ref('Collected by You')
  const selectedElement = ref(null)

  function updateElement(key, props) {
    if (elements.value[key]) {
      Object.assign(elements.value[key], props)
      saveLayout()
    }
  }

  function resetLayout() {
    elements.value = defaultElements()
    customText.value = 'Collected by You'
    selectedElement.value = null
    saveLayout()
  }

  // ─── Layout Persistence (DB-backed) ───
  let _saveDebounce = null

  function saveLayout() {
    // Debounce DB writes (300ms) to avoid excessive requests during dragging
    if (_saveDebounce) clearTimeout(_saveDebounce)
    _saveDebounce = setTimeout(() => {
      try {
        api.post('/db/settings', {
          key: 'canvas_layout',
          value: JSON.stringify({
            elements: elements.value,
            customText: customText.value,
          })
        })
      } catch {}
    }, 300)
  }

  async function loadLayout() {
    try {
      const res = await api.get('/db/settings/canvas_layout')
      const raw = res?.value
      if (!raw) return
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (data.elements) {
        const def = defaultElements()
        for (const key of Object.keys(def)) {
          if (data.elements[key]) elements.value[key] = { ...def[key], ...data.elements[key] }
        }
      }
      if (data.customText) customText.value = data.customText
    } catch {
      // DB empty or error → use hardcoded defaults (already set)
    }
  }

  return {
    // Wallpaper (reactive refs from wallpaper store)
    wallpapers, currentIndex, currentFull, currentWallpaper, currentPalette,
    // Wallpaper methods (direct delegation)
    fetchWallpapers: wp.fetchWallpapers,
    selectWallpaper: wp.selectWallpaper,
    nextWallpaper: wp.nextWallpaper,
    prevWallpaper: wp.prevWallpaper,
    randomWallpaper: wp.randomWallpaper,
    uploadWallpaper: wp.uploadWallpaper,
    deleteWallpaper: wp.deleteWallpaper,
    loadFullImage: wp.loadFullImage,
    init: wp.init,

    // Layout
    elements, customText, selectedElement,
    updateElement, resetLayout, saveLayout, loadLayout,
  }
})
