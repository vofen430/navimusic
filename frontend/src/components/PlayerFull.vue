<template>
  <div class="player-full" :style="playerStore.themeColor ? { '--theme-rgb': playerStore.themeColor } : {}">
    <div class="full-bg" :style="bgStyle"></div>
    <div class="full-content">

      <!-- Top: Song info (left-aligned) -->
      <div class="full-header">
        <div class="header-info">
          <h2 class="header-title">{{ playerStore.currentSong?.name }}</h2>
          <p class="header-artist">{{ artistName }}</p>
        </div>
      </div>

      <!-- Main: Cover + Lyrics/Info -->
      <div class="full-main">
        <!-- Left: Cover -->
        <div class="cover-section">
          <div class="cover-wrap" :class="{ playing: playerStore.isPlaying }"
            ref="coverWrapRef"
            :style="coverTiltStyle"
            @mouseenter="onCoverMouseEnter"
            @mousemove="onCoverMouseMove"
            @mouseleave="onCoverMouseLeave">
            <img v-if="!largeCoverLoaded" :src="coverUrlSmall" alt="" class="cover-fallback" />
            <img :src="coverUrlLarge" alt="" @load="largeCoverLoaded = true"
              :style="{ opacity: largeCoverLoaded ? 1 : 0 }" class="cover-main" />
            <div class="cover-specular" :style="specularStyle"></div>
          </div>
        </div>

        <!-- Right: Lyrics / Info panels -->
        <div class="right-section">
          <!-- Panel tabs -->
          <div class="panel-tabs">
            <button :class="{ active: showPanel === 'lyrics' }" @click="showPanel = 'lyrics'">
              <Icon name="music" :size="13" /> 歌词
            </button>
            <button :class="{ active: showPanel === 'info' }" @click="showPanel = 'info'">
              <Icon name="info" :size="13" /> 详情
            </button>
          </div>

          <!-- Lyrics panel -->
          <div v-show="showPanel === 'lyrics'" class="lyrics-section">
            <div class="lyrics-scroll" ref="lyricsRef">
              <div class="lyrics-pad"></div>
              <div v-if="!playerStore.lyrics.length" class="lyrics-empty">暂无歌词</div>
              <div v-for="(line, idx) in playerStore.lyrics" :key="idx" class="lyric-line"
                :class="{ active: idx === playerStore.currentLyricIndex }"
                :ref="el => { if (idx === playerStore.currentLyricIndex) activeLineRef = el }">
                <span class="lyric-text">{{ line.text }}</span>
                <span v-if="line.tText" class="lyric-trans">{{ line.tText }}</span>
              </div>
              <div class="lyrics-pad"></div>
            </div>
          </div>

          <!-- Song Info panel -->
          <div v-show="showPanel === 'info'" class="info-section">
            <div v-if="songMetaLoading" class="info-loading"><div class="loading-spinner"></div></div>
            <template v-else-if="songMeta">
              <div class="info-item" v-if="songMeta.album">
                <span class="info-key"><Icon name="disc" :size="13" /> 专辑</span>
                <a class="info-val info-link" @click="openAlbum">{{ songMeta.album }}</a>
              </div>
              <div class="info-item" v-if="songMeta.genres">
                <span class="info-key"><Icon name="radio" :size="13" /> 曲风</span>
                <span class="info-val">{{ songMeta.genres }}</span>
              </div>
              <div class="info-item" v-if="songMeta.language">
                <span class="info-key"><Icon name="globe" :size="13" /> 语种</span>
                <span class="info-val">{{ songMeta.language }}</span>
              </div>
              <div class="info-item" v-if="songMeta.publishTime">
                <span class="info-key"><Icon name="calendar" :size="13" /> 发行</span>
                <span class="info-val">{{ songMeta.publishTime }}</span>
              </div>
              <div class="info-item" v-if="songMeta.version">
                <span class="info-key"><Icon name="disc" :size="13" /> 版本</span>
                <span class="info-val">{{ songMeta.version }}</span>
              </div>
              <div class="info-item" v-if="songMeta.bpm">
                <span class="info-key"><Icon name="bar-chart" :size="13" /> BPM</span>
                <span class="info-val">{{ songMeta.bpm }}</span>
              </div>
              <div class="info-item" v-if="songMeta.instruments">
                <span class="info-key"><Icon name="music" :size="13" /> 乐器</span>
                <span class="info-val">{{ songMeta.instruments }}</span>
              </div>
              <div v-if="!songMeta.album && !songMeta.genres && !songMeta.bpm" class="info-empty-msg">暂无详细信息</div>
            </template>
            <div v-else class="info-empty-msg">暂无详细信息</div>
          </div>
        </div>
      </div>

      <!-- Bottom: Glassmorphism action capsule with transport + actions -->
      <div class="full-bottom">
        <div class="action-capsule">
          <button class="act-btn transport-btn" @click="playerStore.playPrev()" title="上一首">
            <Icon name="skip-back" :size="18" />
          </button>
          <button class="act-btn transport-play" @click="playerStore.togglePlay()">
            <Icon :name="playerStore.isPlaying ? 'pause' : 'play'" :size="20" />
          </button>
          <button class="act-btn transport-btn" @click="playerStore.playNext()" title="下一首">
            <Icon name="skip-forward" :size="18" />
          </button>
          <div class="capsule-divider"></div>
          <button class="act-btn" :class="{ liked: isLiked }" @click="onLike" title="喜欢">
            <Icon :name="isLiked ? 'heart-fill' : 'heart'" :size="18" />
          </button>
          <button class="act-btn" @click="emit('show-comments', playerStore.currentSong?.id)" title="评论">
            <Icon name="message-circle" :size="18" />
            <span class="act-count" v-if="songInfo.commentCount">{{ formatCount(songInfo.commentCount) }}</span>
          </button>
          <button class="act-btn" @click="emit('quick-add', playerStore.currentSong)" title="添加到歌单">
            <Icon name="plus-circle" :size="18" />
          </button>
          <button class="act-btn" @click="startSimiRoam" title="相似歌曲漫游">
            <Icon name="radio" :size="18" />
          </button>
          <button class="act-btn" @click="onDownload" title="下载">
            <Icon name="download" :size="18" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'
import { useUserStore } from '../stores/user'
import { useDownloadStore } from '../stores/download'
import { likeSong, getSimiSong, getSongUrl } from '../api'
import Icon from './Icon.vue'

const emit = defineEmits(['quick-add', 'show-comments'])
const playerStore = usePlayerStore()
const userStore = useUserStore()
const downloadStore = useDownloadStore()
const router = useRouter()
const lyricsRef = ref(null)
const activeLineRef = ref(null)
const showPlaylist = ref(false)
const largeCoverLoaded = ref(false)

// 3D tilt / gravity press effect + specular highlight
const coverWrapRef = ref(null)
const coverTiltStyle = ref({})
const specularStyle = ref({})
let specularEnterTime = 0

function onCoverMouseEnter() {
  specularEnterTime = performance.now()
}

function onCoverMouseMove(e) {
  const el = coverWrapRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width   // 0..1
  const y = (e.clientY - rect.top) / rect.height    // 0..1
  const rotateY = (x - 0.5) * 6    // -3 to 3 deg
  const rotateX = (0.5 - y) * -6   // inverted: press down toward cursor
  coverTiltStyle.value = {
    transform: `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`,
    transition: 'transform 0.1s ease-out',
  }
  // Specular: light reflects from opposite side of mouse (mirror position)
  const lightX = (1 - x) * 100
  const lightY = (1 - y) * 100
  const intensity = Math.hypot(x - 0.5, y - 0.5) * 2 // 0..~1
  // Warm-up ramp: gradually increase over 400ms after mouse enters (easeOutCubic)
  const elapsed = performance.now() - specularEnterTime
  const t = Math.min(elapsed / 400, 1)
  const ramp = 1 - Math.pow(1 - t, 3) // easeOutCubic: 0 → 1
  const opacity = (0.15 + intensity * 0.35) * ramp
  specularStyle.value = {
    background: `radial-gradient(ellipse at ${lightX}% ${lightY}%, rgba(255,255,255,${opacity.toFixed(3)}) 0%, rgba(255,255,255,${(opacity * 0.4).toFixed(3)}) 45%, transparent 80%)`,
    transition: 'background 0.1s ease-out',
  }
}
function onCoverMouseLeave() {
  specularEnterTime = 0
  coverTiltStyle.value = {
    transform: 'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)',
    transition: 'transform 0.4s ease-out',
  }
  specularStyle.value = {
    background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.10) 0%, transparent 65%)',
    transition: 'background 0.4s ease-out',
  }
}

// Use centralized metadata from playerStore (no duplicate API calls)
const songMeta = computed(() => playerStore.songMeta)
const songMetaLoading = computed(() => playerStore.songMetaLoading)
const songInfo = computed(() => playerStore.songInfo)

// Panel toggle: defaults to 'lyrics' on app start, user choice persisted within session
const showPanel = ref('lyrics')

const coverUrlSmall = computed(() => playerStore.coverUrl200)
const coverUrlLarge = computed(() => {
  const url = playerStore.currentSong?.al?.picUrl
  return url ? url + '?param=800y800' : ''
})
const artistName = computed(() => playerStore.currentSong?.ar?.map(a => a.name).join(', ') || '')
const bgStyle = computed(() => ({ backgroundImage: coverUrlSmall.value ? `url(${coverUrlSmall.value})` : 'none' }))
const isLiked = computed(() => userStore.isLiked(playerStore.currentSong?.id))

// Reset large cover state when song changes.
// The actual 800y800 loading is handled by the template <img :src="coverUrlLarge" @load>,
// which only mounts when fullscreen is open (v-if). The 200y200 from the player bar
// (coverUrlSmall = playerStore.coverUrl200) is shown as a placeholder until the large image loads.
watch(() => playerStore.currentSong?.id, () => {
  largeCoverLoaded.value = false
})

function formatCount(n) { if (!n) return ''; if (n >= 10000) return (n/10000).toFixed(1)+'万'; return String(n) }
async function onLike() { if (!userStore.isLoggedIn) return; try { await likeSong(playerStore.currentSong.id, !isLiked.value); userStore.fetchLikeList() } catch {} }
async function startSimiRoam() {
  try { window.__toast?.('正在加载...', 'info'); const res = await getSimiSong(playerStore.currentSong.id); const songs = res.songs || []
    if (songs.length) { playerStore.playSong(songs[0], songs, 0); window.__toast?.(`漫游 ${songs.length} 首`, 'success') } else window.__toast?.('未找到', 'warning')
  } catch { window.__toast?.('失败', 'error') }
}
async function onDownload() {
  const song = playerStore.currentSong; if (!song) return
  if (!downloadStore.addToQueue(song)) { window.__toast?.('已在列表中', 'info'); return }
  window.__toast?.('已添加', 'success')
  try { const u = await getSongUrl(song.id, JSON.parse(localStorage.getItem('cloudmusic-settings')||'{}').downloadQuality||'exhigh'); const d = u.data?.[0]; if (d?.url) { downloadStore.updateProgress(song.id,50,'downloading'); setTimeout(()=>downloadStore.completeDownload(song.id,d.url),1500) } } catch { downloadStore.updateProgress(song.id,0,'error') }
}
function openAlbum() {
  if (songMeta.value?.albumId) {
    playerStore.toggleFullscreen()
    router.push({ path: '/', query: { search: songMeta.value.album } })
  }
}

// ─── Smooth scroll: manual RAF + easeOutCubic ───
let scrollAnimId = null
function smoothScrollTo(container, targetTop, duration = 600) {
  if (scrollAnimId) cancelAnimationFrame(scrollAnimId)
  const start = container.scrollTop
  const distance = targetTop - start
  if (Math.abs(distance) < 1) return
  const startTime = performance.now()
  function step(now) {
    const elapsed = now - startTime
    const t = Math.min(elapsed / duration, 1)
    const ease = 1 - Math.pow(1 - t, 3) // easeOutCubic
    container.scrollTop = start + distance * ease
    if (t < 1) scrollAnimId = requestAnimationFrame(step)
    else scrollAnimId = null
  }
  scrollAnimId = requestAnimationFrame(step)
}

watch(() => playerStore.currentLyricIndex, async () => {
  await nextTick()
  const container = lyricsRef.value
  const activeLine = activeLineRef.value
  if (!container || !activeLine) return
  const targetTop = activeLine.offsetTop - container.clientHeight / 2 + activeLine.clientHeight / 2
  smoothScrollTo(container, targetTop)
})
</script>

<style scoped>
/* ─── Root ─── */
.player-full {
  --theme-rgb: 80, 80, 120;
  position: fixed; inset: 0; z-index: 100;
  display: flex; flex-direction: column;
}
.full-bg {
  position: absolute; inset: -60px;
  background-size: cover; background-position: center;
  filter: blur(70px) brightness(0.25) saturate(1.4);
  z-index: -1;
}
.full-content {
  flex: 1; display: flex; flex-direction: column;
  background: linear-gradient(160deg, rgba(var(--theme-rgb), 0.2) 0%, rgba(0,0,0,0.55) 50%, rgba(var(--theme-rgb), 0.1) 100%);
  backdrop-filter: blur(24px);
}

/* ─── Header ─── */
.full-header {
  padding: 28px 48px 0;
  display: flex; align-items: flex-start; justify-content: space-between;
}
.header-info { max-width: 600px; }
.header-title {
  font-size: 22px; font-weight: 800; color: white;
  line-height: 1.3; margin: 0;
  text-shadow: 0 2px 12px rgba(0,0,0,0.3);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.header-artist {
  font-size: 14px; color: rgba(255,255,255,0.55);
  margin: 4px 0 0; font-weight: 400;
}

/* ─── Main layout ─── */
.full-main {
  flex: 1; display: flex; align-items: center;
  padding: 24px 48px; gap: 48px; overflow: hidden;
}

/* ─── Cover ─── */
.cover-section {
  flex: 0 0 45%; display: flex; align-items: center; justify-content: center;
  perspective: 800px;
}
.cover-wrap {
  width: 340px; height: 340px; border-radius: 20px;
  overflow: hidden; position: relative;
  box-shadow: 0 16px 60px rgba(0,0,0,0.5), 0 4px 20px rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.08);
  transform-style: preserve-3d;
  will-change: transform;
  cursor: grab;
  user-select: none;
}
.cover-wrap img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  pointer-events: none;
}
.cover-fallback { z-index: 1; filter: blur(2px); }
.cover-main { z-index: 2; transition: opacity 0.4s ease; }
.cover-specular {
  position: absolute; inset: 0; z-index: 3;
  border-radius: inherit; pointer-events: none;
  mix-blend-mode: screen;
  background: radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.10) 0%, transparent 65%);
}

/* ─── Right section ─── */
.right-section {
  flex: 1; display: flex; flex-direction: column;
  overflow: hidden; min-width: 0;
  height: 100%; max-height: 440px;
  padding: 8px 0;
  margin-top: -20px;
}

/* ─── Panel tabs ─── */
.panel-tabs {
  display: flex; gap: 2px; margin-bottom: 16px; padding: 3px;
  background: rgba(255,255,255,0.05); border-radius: 10px;
  width: fit-content; backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.panel-tabs button {
  padding: 7px 20px; border-radius: 8px;
  font-size: 12px; font-weight: 600;
  color: rgba(255,255,255,0.3); cursor: pointer;
  transition: all 0.25s ease;
  display: flex; align-items: center; gap: 5px;
  letter-spacing: 0.5px;
}
.panel-tabs button.active {
  background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.9);
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.panel-tabs button:hover:not(.active) { color: rgba(255,255,255,0.5); }

/* ─── Lyrics ─── */
.lyrics-section {
  flex: 1; overflow: hidden; position: relative; width: 100%;
  mask-image: linear-gradient(transparent 0%, black 12%, black 88%, transparent 100%);
}
.lyrics-scroll {
  height: 100%; overflow-y: auto;
  padding-right: 8px;
}
.lyrics-scroll::-webkit-scrollbar { width: 0; }
.lyrics-pad { height: 40%; flex-shrink: 0; }
.lyrics-empty {
  color: rgba(255,255,255,0.25); text-align: center;
  padding-top: 80px; font-size: 14px; font-style: italic;
}
.lyric-line {
  padding: 10px 0; cursor: default;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex; flex-direction: column; gap: 3px;
  text-align: left;
}
.lyric-text {
  font-size: 16px; line-height: 1.7; font-weight: 400;
  color: rgba(255,255,255,0.22);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.lyric-trans {
  font-size: 13px; color: rgba(255,255,255,0.1);
  transition: all 0.4s ease;
}
.lyric-line.active .lyric-text {
  font-size: 22px; font-weight: 700; color: white;
  text-shadow: 0 0 20px rgba(var(--theme-rgb), 0.4);
}
.lyric-line.active .lyric-trans {
  font-size: 14px; color: rgba(255,255,255,0.45);
}

/* ─── Song Info ─── */
.info-section {
  flex: 1; overflow-y: auto; padding: 8px 0;
}
.info-section::-webkit-scrollbar { width: 0; }
.info-item {
  display: flex; align-items: center; gap: 14px;
  padding: 10px 14px;
  border-radius: 10px;
  margin-bottom: 4px;
  background: rgba(255,255,255,0.03);
  transition: background 0.2s ease;
}
.info-item:hover { background: rgba(255,255,255,0.06); }
.info-key {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: rgba(255,255,255,0.3);
  font-weight: 700; min-width: 56px; flex-shrink: 0;
  text-transform: uppercase; letter-spacing: 0.8px;
}
.info-val {
  font-size: 13px; color: rgba(255,255,255,0.8); font-weight: 500;
}
.info-link {
  color: rgba(var(--theme-rgb), 1); cursor: pointer;
  transition: opacity 0.2s;
}
.info-link:hover { opacity: 0.7; text-decoration: underline; }
.info-empty-msg {
  color: rgba(255,255,255,0.2); text-align: center;
  padding-top: 60px; font-size: 13px; font-style: italic;
}
.info-loading { display: flex; justify-content: center; padding: 40px; }

/* ─── Bottom: Action capsule ─── */
.full-bottom {
  padding: 12px 48px 20px;
  display: flex; justify-content: center;
}
.action-capsule {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 50px;
  background: rgba(255,255,255,0.07);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: 0 4px 24px rgba(0,0,0,0.2);
}
.act-btn {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.6); cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}
.act-btn:hover {
  color: white; background: rgba(255,255,255,0.1);
  transform: scale(1.1);
}
.act-btn.liked { color: var(--primary); }
.act-count {
  position: absolute; top: 2px; right: 0;
  font-size: 9px; color: rgba(255,255,255,0.4);
}
/* Transport controls */
.transport-play {
  width: 44px; height: 44px;
  background: var(--primary);
  color: white !important;
  border-radius: 50%;
  box-shadow: 0 2px 12px rgba(236,65,65,0.4);
}
.transport-play:hover {
  background: var(--primary); transform: scale(1.1);
  box-shadow: 0 4px 18px rgba(236,65,65,0.55);
}
.transport-btn:hover { color: white; }
.capsule-divider {
  width: 1px; height: 24px;
  background: rgba(255,255,255,0.1);
  margin: 0 4px;
}
</style>
