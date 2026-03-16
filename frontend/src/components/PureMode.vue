<template>
  <div class="pure-mode" :style="wallpaperStyle">
    <div class="pure-overlay"></div>

    <!-- FM glow particle (animated from FM button to now-playing) -->
    <div v-if="fmGlowActive" class="fm-glow-particle" :style="fmGlowStyle"></div>

    <!-- Top-right buttons -->
    <div class="pure-top-btns">
      <button class="pure-top-btn" @click="showGallery = !showGallery" title="图库">
        <Icon name="image" :size="18" />
      </button>
      <button class="pure-top-btn" @click="showConfig = !showConfig" title="设置">
        <Icon name="more-vertical" :size="18" />
      </button>
      <button class="pure-top-btn" @click="$emit('exit')" title="返回传统模式">
        <Icon name="layout-dashboard" :size="18" />
      </button>
      <!-- Config dropdown -->
      <Transition name="pure-dropdown">
        <div v-if="showConfig" class="pure-config-dropdown">
          <div class="pure-config-item" @click="toggleDesktopMode">
            <Icon name="monitor" :size="14" /><span>{{ desktopMode ? '退出桌面壁纸' : '桌面壁纸模式' }}</span>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Gallery panel -->
    <Transition name="pure-dropdown">
      <div v-if="showGallery" class="pure-gallery-panel">
        <h4 class="pure-gallery-title">图库
          <button class="pure-gallery-shuffle" @click="pureStore.randomWallpaper()" title="随机"><Icon name="shuffle" :size="14" /></button>
        </h4>
        <div class="pure-gallery-grid">
          <div v-for="(wp, i) in pureGalleryPageItems" :key="wp.id"
            class="pure-gallery-item" :class="{ active: pureStore.currentIndex === (pureGalleryPage * 9 + i) }"
            @click="pureStore.selectWallpaper(pureGalleryPage * 9 + i)">
            <img :src="wp.thumb_data" alt="" />
          </div>
        </div>
        <div v-if="pureGalleryTotalPages > 1" class="pure-gallery-pager">
          <button class="pure-gallery-pager-btn" @click="pureGalleryPage = Math.max(0, pureGalleryPage - 1)" :disabled="pureGalleryPage === 0">
            <Icon name="chevron-left" :size="14" />
          </button>
          <span class="pure-gallery-pager-num">{{ pureGalleryPage + 1 }} / {{ pureGalleryTotalPages }}</span>
          <button class="pure-gallery-pager-btn" @click="pureGalleryPage = Math.min(pureGalleryTotalPages - 1, pureGalleryPage + 1)" :disabled="pureGalleryPage >= pureGalleryTotalPages - 1">
            <Icon name="chevron-right" :size="14" />
          </button>
        </div>
        <label class="pure-gallery-import">
          <Icon name="plus" :size="14" /> 导入壁纸
          <input type="file" accept="image/*" multiple style="display:none" @change="importPureWallpapers" />
        </label>
      </div>
    </Transition>


    <div class="pure-center">
      <!-- Greeting & Time -->
      <div class="pure-greeting">{{ greeting }}</div>
      <div class="pure-time">{{ timeStr }}</div>
      <div class="pure-date">{{ dateStr }}</div>

      <!-- Search -->
      <div class="pure-search">
        <Icon name="search" :size="16" class="pure-search-icon" />
        <input
          v-model="query"
          type="text"
          placeholder="搜索歌曲、歌手、歌单..."
          @keydown.enter="doSearch"
          class="pure-search-input"
        />
      </div>

      <!-- Daily Recommend with pagination -->
      <div v-if="allDailySongs.length" class="pure-section">
        <div class="pure-section-header">
          <div class="pure-section-title">每日推荐</div>
          <div class="pure-pager">
            <button class="pure-pager-btn" @click="dailyPrev">
              <Icon name="chevron-left" :size="14" />
            </button>
            <span class="pure-pager-num">{{ dailyPage + 1 }} / {{ dailyTotalPages }}</span>
            <button class="pure-pager-btn" @click="dailyNext">
              <Icon name="chevron-right" :size="14" />
            </button>
          </div>
        </div>
        <div class="pure-cards-wrapper">
          <Transition :name="dailySlideDir" mode="out-in">
            <div class="pure-cards" :key="dailyPage">
              <div
                v-for="(song, idx) in dailyPageSongs"
                :key="song.id"
                class="pure-card"
                :ref="el => { if (el) cardRefs[idx] = el }"
                @click="playDailySong(song, idx)"
              >
                <img class="pure-card-cover" :src="(song.al?.picUrl || '') + '?param=200y200'" alt="" />
                <div class="pure-card-info">
                  <div class="pure-card-name">{{ song.name }}</div>
                  <div class="pure-card-artist">{{ song.ar?.map(a => a.name).join(' / ') || '' }}</div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- Now Playing -->
      <Transition name="pure-np">
        <div v-if="playerStore.currentSong?.id" ref="npRef" class="pure-now-playing" :class="{ 'fm-glow-target': fmGlowLand }" @click="togglePlay">
          <div class="pure-np-cover-wrap">
            <img class="pure-np-cover" :src="playerStore.coverUrl200" alt="" />
            <div class="pure-np-play-btn">
              <Icon :name="playerStore.isPlaying ? 'pause' : 'play'" :size="18" />
            </div>
          </div>
          <div class="pure-np-info">
            <div class="pure-np-label">正在播放</div>
            <div class="pure-np-name">{{ playerStore.currentSong.name }}</div>
            <div class="pure-np-artist">{{ playerStore.currentSong.ar?.map(a => a.name).join(' / ') || '' }}</div>
          </div>
          <div class="pure-np-bars" :class="{ paused: !playerStore.isPlaying }">
            <span></span><span></span><span></span><span></span>
          </div>
        </div>
      </Transition>

      <!-- Quick access -->
      <div class="pure-shortcuts">
        <button ref="fmBtnRef" class="pure-shortcut" :class="{ 'fm-btn-glow': fmBtnGlow }" @click="goTo('fm')">
          <Icon name="radio" :size="14" /> 私人FM
        </button>
        <button class="pure-shortcut" @click="goTo('playlists')">
          <Icon name="list-music" :size="14" /> 我的歌单
        </button>
        <button class="pure-shortcut" @click="goTo('discover')">
          <Icon name="compass" :size="14" /> 发现音乐
        </button>
      </div>
      <div class="pure-shortcuts" style="margin-top: 8px;">
        <button class="pure-shortcut" @click="$emit('enter-canvas')">
          <Icon name="sunset" :size="14" /> 画境模式
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'
import { getRecommendSongs } from '../api'
import { usePureWallpaperStore } from '../stores/wallpaper'
import Icon from './Icon.vue'

const emit = defineEmits(['exit', 'navigate', 'enter-canvas'])
const router = useRouter()
const playerStore = usePlayerStore()
const pureStore = usePureWallpaperStore()

// Wallpaper from pure store (thumb first, then full-res)
const wallpaperStyle = computed(() => {
  const full = pureStore.currentFull
  const thumb = pureStore.currentWallpaper?.thumb_data
  if (full) {
    return { backgroundImage: `url(${full})` }
  }
  if (thumb) {
    return { backgroundImage: `url(${thumb})`, filter: 'blur(8px)', transform: 'scale(1.05)' }
  }
  return { backgroundImage: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }
})

// Gallery
const showGallery = ref(false)
const pureGalleryPage = ref(0)
const pureGalleryTotalPages = computed(() => Math.max(1, Math.ceil(pureStore.wallpapers.length / 9)))
const pureGalleryPageItems = computed(() => {
  const start = pureGalleryPage.value * 9
  return pureStore.wallpapers.slice(start, start + 9)
})
async function importPureWallpapers(e) {
  const files = Array.from(e.target.files || [])
  for (const file of files) {
    await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => {
        const imageData = reader.result
        const img = new Image()
        img.src = imageData
        img.onload = async () => {
          const c = document.createElement('canvas')
          const s = 200 / Math.max(img.width, img.height)
          c.width = img.width * s; c.height = img.height * s
          const ctx = c.getContext('2d')
          ctx.drawImage(img, 0, 0, c.width, c.height)
          const thumb = c.toDataURL('image/jpeg', 0.7)
          await pureStore.uploadWallpaper(file.name, imageData, thumb, [])
          resolve()
        }
      }
      reader.readAsDataURL(file)
    })
  }
  e.target.value = ''
  pureGalleryPage.value = pureGalleryTotalPages.value - 1
}

// Time
const now = ref(new Date())
let timer = null

const greeting = computed(() => {
  const h = now.value.getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const timeStr = computed(() => {
  const d = now.value
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
})

const dateStr = computed(() => {
  const d = now.value
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 星期${weekdays[d.getDay()]}`
})

// Config menu
const showConfig = ref(false)
const desktopMode = ref(false)
function toggleDesktopMode() {
  desktopMode.value = !desktopMode.value
  if (window.electronAPI?.setDesktopMode) {
    window.electronAPI.setDesktopMode(desktopMode.value)
  }
  showConfig.value = false
}

// Search
const query = ref('')
function doSearch() {
  const q = query.value.trim()
  if (!q) return
  emit('exit')
  router.push('/')
  setTimeout(() => {
    const input = document.querySelector('.search-input')
    if (input) {
      input.value = q
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
    }
  }, 300)
}

// Daily recommend with pagination
const DAILY_PER_PAGE = 6
const allDailySongs = ref([])
const dailyPage = ref(0)
const dailySlideDir = ref('daily-slide-left')

const dailyTotalPages = computed(() => Math.ceil(allDailySongs.value.length / DAILY_PER_PAGE) || 1)
const dailyPageSongs = computed(() => {
  const start = dailyPage.value * DAILY_PER_PAGE
  return allDailySongs.value.slice(start, start + DAILY_PER_PAGE)
})

function dailyPrev() {
  dailySlideDir.value = 'daily-slide-right'
  dailyPage.value = dailyPage.value <= 0 ? dailyTotalPages.value - 1 : dailyPage.value - 1
}
function dailyNext() {
  dailySlideDir.value = 'daily-slide-left'
  dailyPage.value = dailyPage.value >= dailyTotalPages.value - 1 ? 0 : dailyPage.value + 1
}

async function loadDaily() {
  try {
    const res = await getRecommendSongs()
    allDailySongs.value = res.data?.dailySongs || []
  } catch { /* ignore if not logged in */ }
}

const cardRefs = {}

function playDailySong(song, idx) {
  playerStore.playSong(song, allDailySongs.value)
  // Glow effect from clicked card
  const el = cardRefs[idx]
  if (el) fireGlow(el)
}

function togglePlay() {
  playerStore.togglePlay()
}

// Navigation — emit to App.vue which handles curtain overlay
function goTo(target) {
  if (target === 'fm') {
    triggerFmGlow()
    return
  }
  const items = {
    playlists: { icon: 'list-music', label: '我的歌单', route: '/playlists' },
    discover: { icon: 'compass', label: '发现音乐', route: '/' },
  }
  emit('navigate', items[target])
}

// FM glow effect
const fmBtnRef = ref(null)
const npRef = ref(null)
const fmGlowActive = ref(false)
const fmGlowLand = ref(false)
const fmGlowStyle = ref({})

const fmBtnGlow = ref(false)

// Reusable glow: fires from sourceEl to npRef (or self-glow)
function fireGlow(sourceEl) {
  const np = npRef.value
  const srcRect = sourceEl.getBoundingClientRect()
  const startX = srcRect.left + srcRect.width / 2
  const startY = srcRect.top + srcRect.height / 2

  if (!np) {
    // No now-playing: pulse the source element
    sourceEl.style.boxShadow = '0 0 16px 6px rgba(236,65,65,0.5)'
    sourceEl.style.transition = 'box-shadow 0.3s ease'
    setTimeout(() => {
      sourceEl.style.boxShadow = ''
      setTimeout(() => { sourceEl.style.transition = '' }, 300)
    }, 500)
    return
  }

  fmGlowStyle.value = {
    left: startX + 'px',
    top: startY + 'px',
    transform: 'translate(-50%, -50%) scale(1)',
    opacity: '1',
  }
  fmGlowActive.value = true

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const npRect = np.getBoundingClientRect()
      fmGlowStyle.value = {
        left: (npRect.left + npRect.width / 2) + 'px',
        top: (npRect.top + npRect.height / 2) + 'px',
        transform: 'translate(-50%, -50%) scale(2.5)',
        opacity: '0',
      }
      fmGlowLand.value = true
      setTimeout(() => {
        fmGlowActive.value = false
        fmGlowLand.value = false
      }, 600)
    })
  })
}

function triggerFmGlow() {
  const btn = fmBtnRef.value
  playerStore.toggleFm()

  if (!btn) return
  fireGlow(btn)
}

onMounted(async () => {
  timer = setInterval(() => { now.value = new Date() }, 10000)
  loadDaily()
  await pureStore.init()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.pure-mode {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  z-index: 10;
}
.pure-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  pointer-events: none;
  z-index: 0;
}

/* Top-right buttons */
.pure-top-btns {
  position: absolute; top: 20px; right: 20px; z-index: 2;
  display: flex; gap: 8px;
}
.pure-top-btn {
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.85);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.25s ease;
}
.pure-top-btn:hover {
  background: rgba(255, 255, 255, 0.22); transform: scale(1.08);
}
/* Config dropdown */
.pure-config-dropdown {
  position: absolute; top: calc(100% + 6px); right: 0;
  min-width: 140px; padding: 4px;
  background: rgba(18,18,30,0.92); backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.pure-config-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 8px;
  font-size: 12px; color: rgba(255,255,255,0.7);
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.pure-config-item:hover {
  background: rgba(255,255,255,0.08); color: white;
}
.pure-dropdown-enter-active { transition: opacity 0.2s, transform 0.2s; }
.pure-dropdown-leave-active { transition: opacity 0.15s; }
.pure-dropdown-enter-from { opacity: 0; transform: translateY(-4px); }
.pure-dropdown-leave-to { opacity: 0; }

/* Gallery panel */
.pure-gallery-panel {
  position: absolute; top: 70px; right: 20px; z-index: 10;
  width: 220px; padding: 12px;
  background: rgba(18,18,30,0.92); backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
}
.pure-gallery-title {
  font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.7);
  margin: 0 0 8px; display: flex; align-items: center; justify-content: space-between;
}
.pure-gallery-shuffle {
  width: 24px; height: 24px; border-radius: 6px; border: none;
  background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.15s;
}
.pure-gallery-shuffle:hover { background: rgba(255,255,255,0.12); color: white; }
.pure-gallery-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px;
}
.pure-gallery-item {
  aspect-ratio: 16/10; border-radius: 6px; overflow: hidden; cursor: pointer;
  border: 2px solid transparent; transition: border-color 0.2s;
}
.pure-gallery-item img { width: 100%; height: 100%; object-fit: cover; }
.pure-gallery-item:hover { border-color: rgba(255,255,255,0.3); }
.pure-gallery-item.active { border-color: var(--primary, #ec4141); }
.pure-gallery-pager {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 4px 0;
}
.pure-gallery-pager-btn {
  width: 22px; height: 22px; border-radius: 6px; border: none;
  background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.15s;
}
.pure-gallery-pager-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12); color: white; }
.pure-gallery-pager-btn:disabled { opacity: 0.3; cursor: default; }
.pure-gallery-pager-num { font-size: 11px; color: rgba(255,255,255,0.4); }
.pure-gallery-import {
  display: flex; align-items: center; gap: 6px; justify-content: center;
  width: 100%; padding: 6px; border-radius: 8px; margin-top: 4px;
  background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6);
  font-size: 11px; cursor: pointer; transition: all 0.2s;
}
.pure-gallery-import:hover { background: rgba(255,255,255,0.1); color: white; }


/* FM glow particle */
.fm-glow-particle {
  position: fixed;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(236, 65, 65, 0.9), rgba(236, 65, 65, 0.3));
  box-shadow: 0 0 20px 8px rgba(236, 65, 65, 0.5), 0 0 60px 16px rgba(236, 65, 65, 0.2);
  pointer-events: none;
  z-index: 30;
  transition: all 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}
.fm-glow-target {
  animation: pure-np-glow 0.6s ease;
}
@keyframes pure-np-glow {
  0% { box-shadow: 0 0 0 0 rgba(236, 65, 65, 0); }
  50% { box-shadow: 0 0 20px 6px rgba(236, 65, 65, 0.4); }
  100% { box-shadow: none; }
}

/* Center container */
.pure-center {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  max-width: 680px;
  width: 100%;
  padding: 32px 24px;
}

/* Time & Greeting */
.pure-greeting {
  font-size: 16px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.4);
  letter-spacing: 0.08em;
  margin-bottom: 2px;
}
.pure-time {
  font-size: 72px;
  font-weight: 200;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  letter-spacing: 0.04em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.pure-date {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.55);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.4);
  margin-bottom: 24px;
}

/* Search */
.pure-search {
  position: relative;
  width: 100%;
  max-width: 420px;
  margin-bottom: 28px;
}
.pure-search-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.45);
  pointer-events: none;
}
.pure-search-input {
  width: 100%;
  padding: 12px 16px 12px 44px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  color: rgba(255, 255, 255, 0.95);
  font-size: 14px;
  outline: none;
  transition: all 0.25s ease;
}
.pure-search-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}
.pure-search-input:focus {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.06);
}

/* Section */
.pure-section {
  width: 100%;
  margin-bottom: 20px;
}
.pure-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.pure-section-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

/* Pager */
.pure-pager {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pure-pager-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}
.pure-pager-btn:not(:disabled):hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}
.pure-pager-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.pure-pager-num {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  min-width: 36px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* Daily cards with slide animation */
.pure-cards-wrapper {
  overflow: hidden;
  position: relative;
}
.pure-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.pure-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
  overflow: hidden;
}
.pure-card:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}
.pure-card-cover {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}
.pure-card-info {
  flex: 1;
  min-width: 0;
}
.pure-card-name {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pure-card-artist {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Daily slide transitions */
.daily-slide-left-enter-active,
.daily-slide-left-leave-active,
.daily-slide-right-enter-active,
.daily-slide-right-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.daily-slide-left-enter-from { opacity: 0; transform: translateX(30px); }
.daily-slide-left-leave-to { opacity: 0; transform: translateX(-30px); }
.daily-slide-right-enter-from { opacity: 0; transform: translateX(-30px); }
.daily-slide-right-leave-to { opacity: 0; transform: translateX(30px); }

/* Now playing */
.pure-now-playing {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  max-width: 360px;
  padding: 12px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: all 0.25s ease;
  margin-bottom: 20px;
}
.pure-now-playing:hover {
  background: rgba(255, 255, 255, 0.16);
  transform: translateY(-2px);
}
.pure-np-cover-wrap {
  position: relative;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
}
.pure-np-cover {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.pure-np-play-btn {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.35);
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}
.pure-now-playing:hover .pure-np-play-btn {
  background: rgba(0, 0, 0, 0.5);
}
.pure-np-info {
  flex: 1;
  min-width: 0;
}
.pure-np-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 2px;
}
.pure-np-name {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pure-np-artist {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Audio bars animation */
.pure-np-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 20px;
  flex-shrink: 0;
}
.pure-np-bars span {
  width: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.6);
  animation: pure-bar 1.2s ease-in-out infinite;
}
.pure-np-bars.paused span {
  animation-play-state: paused;
}
.pure-np-bars span:nth-child(1) { height: 8px; animation-delay: 0s; }
.pure-np-bars span:nth-child(2) { height: 14px; animation-delay: 0.15s; }
.pure-np-bars span:nth-child(3) { height: 10px; animation-delay: 0.3s; }
.pure-np-bars span:nth-child(4) { height: 16px; animation-delay: 0.45s; }
@keyframes pure-bar {
  0%, 100% { transform: scaleY(0.4); }
  50% { transform: scaleY(1); }
}

/* Shortcuts */
.pure-shortcuts {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}
.pure-shortcut {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.75);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.pure-shortcut:hover {
  background: rgba(255, 255, 255, 0.18);
  color: white;
  transform: translateY(-1px);
}

/* Now playing enter/leave transition */
.pure-np-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.pure-np-leave-active {
  transition: all 0.25s ease;
}
.pure-np-enter-from {
  opacity: 0;
  transform: translateY(16px) scale(0.95);
}
.pure-np-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}

/* FM button self-glow (when no now-playing exists) */
.fm-btn-glow {
  animation: fm-self-glow 0.8s ease;
}
@keyframes fm-self-glow {
  0% { box-shadow: 0 0 0 0 rgba(236, 65, 65, 0); }
  30% { box-shadow: 0 0 16px 6px rgba(236, 65, 65, 0.5); background: rgba(236, 65, 65, 0.25); }
  100% { box-shadow: 0 0 0 0 rgba(236, 65, 65, 0); }
}

/* Responsive */
@media (max-width: 600px) {
  .pure-time { font-size: 48px; }
  .pure-cards { grid-template-columns: 1fr 1fr; }
}
</style>
