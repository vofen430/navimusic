<template>
  <div class="app-container">
    <TitleBar :hidden="pureMode || canvasMode" />
    <Toast />
    <LoginModal v-if="userStore.showLoginModal" @close="userStore.showLoginModal = false" />
    <QuickAddModal v-if="quickAddSong" :song="quickAddSong" @close="quickAddSong = null" />
    <CommentModal v-if="commentSongId" :songId="commentSongId" @close="commentSongId = null" />

    <div class="app-layout">
      <!-- Canvas Mode overlay -->
      <Transition name="canvas-enter">
        <CanvasMode v-if="canvasMode" @exit="canvasMode = false" />
      </Transition>

      <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }" v-show="!playerStore.isFullscreen">
        <div class="sidebar-logo">
          <div class="logo-icon">
            <img src="/icon.png" alt="NaviMusic" width="28" height="28" style="border-radius: 6px;" />
          </div>
          <span class="sidebar-text"><h1>NaviMusic</h1></span>
        </div>
        <nav class="nav-section">
          <router-link v-for="item in navItems" :key="item.path" :to="item.path" custom v-slot="{ isActive, navigate }">
            <div class="nav-item" :class="{ active: isActive }" @click="navigate" :title="sidebarCollapsed ? item.label : ''">
              <span class="nav-icon"><Icon :name="item.icon" :size="20" /></span>
              <span class="sidebar-text">{{ item.label }}</span>
            </div>
          </router-link>
        </nav>

        <!-- Sidebar FM Widget -->
        <div v-if="userStore.isLoggedIn" class="sidebar-fm">
          <!-- Collapsed: mini FM button -->
          <div class="fm-mini-btn" :class="{ playing: playerStore.fmPlaying, visible: sidebarCollapsed }" @click="fmCollapsedClick" title="私人FM">
            <Icon name="radio" :size="18" color="white" />
          </div>
          <!-- Expanded: full FM card -->
          <div class="sidebar-fm-card-wrapper" :class="{ collapsed: sidebarCollapsed }">
            <div class="sidebar-fm-card" :style="sidebarFmBg">
              <div class="sidebar-fm-inner">
                <div class="sidebar-fm-top">
                  <div class="sidebar-fm-label"><Icon name="radio" :size="10" /> FM</div>
                  <button class="sfm-skip-btn" @click.stop="playerStore.fmNext()" title="下一首" :disabled="!playerStore.fmSong">
                    <Icon name="skip-forward" :size="12" />
                  </button>
                </div>
                <div class="sidebar-fm-body">
                  <div class="sidebar-fm-cover-ring" :class="{ spinning: playerStore.fmPlaying }">
                    <div class="sidebar-fm-cover">
                      <img v-if="playerStore.fmSong" :src="(playerStore.fmSong.album?.picUrl || playerStore.fmSong.al?.picUrl || '') + '?param=200y200'" alt="" />
                      <Icon v-else name="radio" :size="20" color="rgba(255,255,255,0.2)" />
                    </div>
                    <div class="sfm-cover-dot"></div>
                  </div>
                  <div class="sidebar-fm-info">
                    <div class="sidebar-fm-name">{{ playerStore.fmSong?.name || '私人FM' }}</div>
                    <div class="sidebar-fm-artist">{{ playerStore.fmSong ? (playerStore.fmSong.artists || playerStore.fmSong.ar || []).map(a => a.name).join(', ') : '点击开始' }}</div>
                  </div>
                </div>
                <div class="sidebar-fm-btns">
                  <button class="sfm-btn" @click.stop="playerStore.fmTrashSong()" title="不喜欢" :disabled="!playerStore.fmSong"><Icon name="x" :size="13" /></button>
                  <button class="sfm-btn sfm-btn-play" @click.stop="playerStore.toggleFm()">
                    <Icon :name="playerStore.fmPlaying ? 'pause' : 'play'" :size="16" color="white" />
                  </button>
                  <button class="sfm-btn" :class="{ liked: playerStore.fmSong && userStore.isLiked(playerStore.fmSong.id) }" @click.stop="playerStore.fmLikeSong(userStore)" title="喜欢" :disabled="!playerStore.fmSong">
                    <Icon :name="playerStore.fmSong && userStore.isLiked(playerStore.fmSong.id) ? 'heart-fill' : 'heart'" :size="13" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style="flex:1"></div>
        <!-- Theme toggle -->
        <div class="sidebar-toggle theme-toggle" @click="toggleTheme" :title="sidebarCollapsed ? (isDark ? '浅色模式' : '深色模式') : ''">
          <Icon :name="isDark ? 'sun' : 'moon'" :size="16" />
          <span class="sidebar-text">{{ isDark ? '浅色模式' : '深色模式' }}</span>
        </div>
        <!-- Canvas mode toggle -->
        <div class="sidebar-toggle theme-toggle" @click="enterCanvasMode" :title="sidebarCollapsed ? '画境模式' : ''">
          <Icon name="sunset" :size="16" />
          <span class="sidebar-text">画境模式</span>
        </div>
        <!-- Pure mode toggle -->
        <div class="sidebar-toggle theme-toggle" @click="enterPureMode" :title="sidebarCollapsed ? '纯净模式' : ''">
          <Icon name="sparkles" :size="16" />
          <span class="sidebar-text">纯净模式</span>
        </div>
        <!-- Sidebar collapse toggle -->
        <div class="sidebar-toggle" @click="toggleSidebar" :title="sidebarCollapsed ? '展开侧栏' : '收起侧栏'">
          <Icon :name="sidebarCollapsed ? 'chevron-right' : 'chevron-left'" :size="16" />
        </div>
        <div class="nav-section" style="padding-bottom: 16px;">
          <div v-if="userStore.isLoggedIn" class="user-info-section" @click="$router.push('/settings')">
            <img class="user-avatar" :src="userStore.profile?.avatarUrl + '?param=80y80'" alt="" />
            <div class="sidebar-text">
              <div style="font-size: var(--font-sm); font-weight: 600;">{{ userStore.profile?.nickname }}</div>
              <div style="font-size: var(--font-xs); color: var(--text-tertiary);">查看设置</div>
            </div>
          </div>
          <div v-else class="nav-item" @click="userStore.showLoginModal = true" :title="sidebarCollapsed ? '登录' : ''">
            <span class="nav-icon"><Icon name="user" :size="20" /></span>
            <span class="sidebar-text">登录</span>
          </div>
        </div>
      </aside>

      <main class="main-content" :class="{ 'no-page-anim': skipPageAnim }">
        <Transition name="pure-mode">
          <PureMode v-if="pureMode" @exit="exitPureMode" @navigate="onPureNavigate" @enter-canvas="onPureToCanvas" />
        </Transition>
        <template v-if="!pureMode">
          <router-view v-slot="{ Component }">
            <transition :name="skipPageAnim ? '' : 'page'" mode="out-in">
              <component :is="Component" @quick-add="onQuickAdd" />
            </transition>
          </router-view>
          <!-- PlayerFull overlays the main content -->
          <Transition name="detail-slide">
            <PlayerFull v-if="playerStore.isFullscreen" @quick-add="onQuickAdd" @show-comments="onShowComments" />
          </Transition>
        </template>
      </main>
    </div>

    <!-- Transition overlay for pure mode enter/exit navigation -->
    <Teleport to="body">
      <Transition name="pure-curtain">
        <div v-if="pureCurtain" class="pure-curtain">
          <div class="pure-curtain-content" v-if="pureCurtain.icon">
            <div class="pure-curtain-icon-wrap"><Icon :name="pureCurtain.icon" :size="36" /></div>
            <div class="pure-curtain-label">{{ pureCurtain.label }}</div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- PlayerBar: always present, can be collapsed -->
    <Transition name="bar-slide">
      <PlayerBar v-show="!barCollapsed && !playerStore.isFullscreen" @quick-add="onQuickAdd" @show-comments="onShowComments" @collapse-bar="collapseBar" />
    </Transition>

    <!-- Fullscreen toggle button: animates between normal and restore position -->
    <Transition name="float-pop">
      <button v-if="playerStore.currentSong && !pureMode && !canvasMode" class="float-btn float-fullscreen"
        :class="{ shifted: barCollapsed && !playerStore.isFullscreen, 'at-restore': playerStore.isFullscreen }"
        @click="toggleDetail" :title="playerStore.isFullscreen ? '收起详情' : '展开播放详情'">
        <Icon :name="playerStore.isFullscreen ? 'arrows-minimize' : 'arrows-maximize'" :size="18" />
      </button>
    </Transition>

    <!-- Restore bar button: only visible when bar is collapsed (bottom-right) -->
    <Transition name="float-rise">
      <button v-if="barCollapsed && !playerStore.isFullscreen" class="float-btn float-restore" :class="{ glass: pureMode }" @click="restoreBar" title="恢复底栏">
        <Icon name="chevron-up" :size="20" />
      </button>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, provide, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from './stores/player'
import { useUserStore } from './stores/user'
import { seedAllBuiltins } from './stores/wallpaper'
import { getLruCache } from './composables/useCache'
import { initMemoryManager, destroyMemoryManager } from './utils/memoryManager'
import Icon from './components/Icon.vue'
import Toast from './components/Toast.vue'
import LoginModal from './components/LoginModal.vue'
import QuickAddModal from './components/QuickAddModal.vue'
import CommentModal from './components/CommentModal.vue'
import PlayerBar from './components/PlayerBar.vue'
import PlayerFull from './components/PlayerFull.vue'
import PureMode from './components/PureMode.vue'
import CanvasMode from './components/CanvasMode.vue'
import TitleBar from './components/TitleBar.vue'

const playerStore = usePlayerStore()
const userStore = useUserStore()
const router = useRouter()
const quickAddSong = ref(null)
const commentSongId = ref(null)

const navItems = [
  { path: '/', label: '发现', icon: 'compass' },
  { path: '/playlists', label: '歌单', icon: 'list-music' },
  { path: '/downloads', label: '下载', icon: 'download' },
  { path: '/settings', label: '设置', icon: 'settings' },
]

function onQuickAdd(song) { quickAddSong.value = song }

function onShowComments(id) { commentSongId.value = id }
const pureMode = ref(localStorage.getItem('pureMode') === 'true')

const barCollapsed = ref(false)
const sidebarCollapsed = ref(localStorage.getItem('sidebar-collapsed') === 'true')
const isDark = ref(localStorage.getItem('theme') !== 'light')
const canvasMode = ref(false)

const sidebarAnimating = ref(false)
const sidebarFlipCallbacks = new Set()

// Core sidebar toggle with FLIP coordination
function doSidebarChange(newCollapsed) {
  if (sidebarCollapsed.value === newCollapsed) return

  const sidebar = document.querySelector('.sidebar')
  const oldWidth = sidebar?.getBoundingClientRect().width

  // 1. Pre-change: let views snapshot their grid card positions
  for (const cb of sidebarFlipCallbacks) cb.snapshot?.()

  // 1b. Capture old computed styles for nav-items so we can FLIP them
  const navItems_els = sidebar ? [...sidebar.querySelectorAll('.nav-item')] : []
  const navItemOldStyles = navItems_els.map(el => {
    const cs = getComputedStyle(el)
    return {
      padding: cs.padding,
      gap: cs.gap,
      justifyContent: cs.justifyContent,
    }
  })

  // 2. Suppress ALL transitions inside sidebar so everything JUMPS to final state
  const transitionEls = sidebar ? [
    sidebar,
    ...sidebar.querySelectorAll('.sidebar-text, .nav-item, .nav-icon, .logo-icon, .sidebar-logo, .nav-section, .sidebar-toggle, .theme-toggle, .sidebar-fm, .sidebar-fm-card-wrapper, .fm-mini-btn, .user-info-section')
  ] : []
  for (const el of transitionEls) el.style.transition = 'none'

  // 3. Toggle state — Vue re-renders, class changes
  sidebarAnimating.value = true
  sidebarCollapsed.value = newCollapsed
  localStorage.setItem('sidebar-collapsed', newCollapsed)

  // 4. After DOM update: sidebar is at FINAL width (no transition, instant jump)
  nextTick(() => {
    if (sidebar) sidebar.offsetHeight // force layout at final width

    // 5. Views measure new card positions (at final width) & set up FLIP
    for (const cb of sidebarFlipCallbacks) cb.animate?.()

    // 6. Set sidebar back to old width, re-enable all transitions, remove override
    if (sidebar && oldWidth != null) {
      sidebar.style.width = oldWidth + 'px'  // jump back to old width visually

      // 6b. Set nav-items back to OLD styles inline so they can animate
      navItems_els.forEach((el, i) => {
        el.style.padding = navItemOldStyles[i].padding
        el.style.gap = navItemOldStyles[i].gap
        el.style.justifyContent = navItemOldStyles[i].justifyContent
      })

      sidebar.offsetHeight                    // force browser to register old layout
      // Re-enable all transitions
      for (const el of transitionEls) el.style.transition = ''

      // Clear nav-item inline styles so they animate to CSS-defined values
      navItems_els.forEach(el => {
        el.style.padding = ''
        el.style.gap = ''
        el.style.justifyContent = ''
      })

      sidebar.style.width = ''               // triggers CSS transition old → new
    } else {
      // No sidebar or no measurement — just restore transitions
      for (const el of transitionEls) el.style.transition = ''
    }
  })

  setTimeout(() => { sidebarAnimating.value = false }, 500)
}

function toggleSidebar() { doSidebarChange(!sidebarCollapsed.value) }
function toggleTheme() {
  isDark.value = !isDark.value
  const theme = isDark.value ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
}
let barStateBeforePure = false
const pureCurtain = ref(null)
const skipPageAnim = ref(false)

// Enter pure mode with curtain transition
function enterPureMode() {
  pureCurtain.value = { icon: 'sparkles', label: '纯净模式' }
  barStateBeforePure = barCollapsed.value
  setTimeout(() => {
    pureMode.value = true
    localStorage.setItem('pureMode', 'true')
    barCollapsed.value = true
    playerStore.isFullscreen = false
    setTimeout(() => { pureCurtain.value = null }, 250)
  }, 500)
}

// Enter canvas mode with curtain transition
function enterCanvasMode() {
  pureCurtain.value = { icon: 'sunset', label: '画境模式' }
  setTimeout(() => {
    canvasMode.value = true
    setTimeout(() => { pureCurtain.value = null }, 250)
  }, 500)
}

// Exit pure mode (simple, used by exit button)
function exitPureMode() {
  pureMode.value = false
  localStorage.setItem('pureMode', 'false')
  barCollapsed.value = barStateBeforePure
}

// Switch from pure mode to canvas mode
function onPureToCanvas() {
  exitPureMode()
  enterCanvasMode()
}

// Navigate from pure mode with curtain overlay
function onPureNavigate({ icon, label, route }) {
  // Phase 1: show curtain with icon
  pureCurtain.value = { icon, label }
  skipPageAnim.value = true

  setTimeout(() => {
    // Phase 2: behind the curtain, exit pure mode + navigate
    pureMode.value = false
    localStorage.setItem('pureMode', 'false')
    barCollapsed.value = barStateBeforePure
    router.push(route)

    // Phase 3: after page mounts, fade curtain out
    setTimeout(() => {
      pureCurtain.value = null
      setTimeout(() => { skipPageAnim.value = false }, 400)
    }, 200)
  }, 400)
}
function fmCollapsedClick() {
  doSidebarChange(false)
  // If not playing FM, start it
  if (!playerStore.fmPlaying) {
    playerStore.toggleFm()
  }
}
let barCollapsedByUser = false  // tracks if user explicitly collapsed bar

function toggleDetail() {
  if (!playerStore.isFullscreen) {
    barCollapsedByUser = barCollapsed.value
    barCollapsed.value = true
    playerStore.isFullscreen = true
  } else {
    playerStore.isFullscreen = false
    barCollapsed.value = barCollapsedByUser
  }
}
function collapseBar() {
  barCollapsed.value = true
  barCollapsedByUser = true
}
function restoreBar() {
  barCollapsed.value = false
  barCollapsedByUser = false
}

provide('quickAdd', onQuickAdd)
provide('showComments', onShowComments)
provide('expandDetail', toggleDetail)
provide('collapseSidebar', () => { doSidebarChange(true) })
provide('sidebarCollapsed', sidebarCollapsed)
provide('sidebarAnimating', sidebarAnimating)
provide('sidebarFlipCallbacks', sidebarFlipCallbacks)

const sidebarFmBg = computed(() => {
  const url = playerStore.fmSong?.album?.picUrl || playerStore.fmSong?.al?.picUrl
  return url ? { backgroundImage: `url(${url}?param=100y100)` } : {}
})

onMounted(() => {
  userStore.checkLoginStatus()
  initMemoryManager(getLruCache())
  // Seed built-in wallpapers once at app startup
  seedAllBuiltins()
  // Restore theme preference
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
    isDark.value = false
  }
})

onUnmounted(() => {
  destroyMemoryManager()
})
</script>

<style scoped>
.app-container { height: 100vh; display: flex; flex-direction: column; }

/* ─── Sidebar FM Widget ─── */
.sidebar-fm { padding: 10px 12px; transition: padding 0.35s cubic-bezier(.4,0,.2,1); }
.sidebar.collapsed .sidebar-fm { padding: 4px 6px; }

/* FM card wrapper for smooth collapse/expand */
.sidebar-fm-card-wrapper {
  max-height: 300px;
  opacity: 1;
  overflow: hidden;
  transition: max-height 0.35s cubic-bezier(.4,0,.2,1),
              opacity 0.25s ease 0.05s;
}
.sidebar-fm-card-wrapper.collapsed {
  max-height: 0;
  opacity: 0;
  transition: max-height 0.3s cubic-bezier(.4,0,.2,1) 0.05s,
              opacity 0.15s ease;
}

.sidebar-fm-card {
  border-radius: var(--radius-lg); overflow: hidden; position: relative;
  background-size: cover; background-position: center;
  isolation: isolate;
}
.sidebar-fm-card::before {
  content: ''; position: absolute; inset: 0;
  border-radius: inherit;
  background: linear-gradient(145deg, rgba(15,15,30,0.92), rgba(40,18,65,0.88));
  backdrop-filter: blur(30px);
}
.sidebar-fm-inner {
  position: relative; z-index: 1; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 8px;
}

/* Top bar: FM label + skip */
.sidebar-fm-top {
  display: flex; align-items: center; justify-content: space-between;
}
.sidebar-fm-label {
  display: flex; align-items: center; gap: 4px;
  font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.35);
  text-transform: uppercase; letter-spacing: 2px;
}
.sfm-skip-btn {
  width: 22px; height: 22px; border-radius: 50%;
  background: rgba(255,255,255,0.06); border: none;
  color: rgba(255,255,255,0.4); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.sfm-skip-btn:hover { background: rgba(255,255,255,0.12); color: white; }
.sfm-skip-btn:disabled { opacity: 0.25; cursor: default; }

/* Body: cover + info */
.sidebar-fm-body {
  display: flex; align-items: center; gap: 10px;
}
.sidebar-fm-cover-ring {
  width: 56px; height: 56px; border-radius: 50%; flex-shrink: 0;
  padding: 3px; position: relative;
  background: conic-gradient(
    rgba(236,65,65,0.6), rgba(168,85,247,0.6), rgba(59,130,246,0.5),
    rgba(236,65,65,0.6)
  );
  transition: box-shadow 0.3s ease;
}
.sidebar-fm-cover-ring.spinning {
  animation: rotateCover 12s linear infinite;
  box-shadow: 0 0 12px rgba(236,65,65,0.3), 0 0 24px rgba(168,85,247,0.15);
}
.sidebar-fm-cover {
  width: 100%; height: 100%; border-radius: 50%; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: rgba(20,20,35,0.95);
}
.sidebar-fm-cover img { width: 100%; height: 100%; object-fit: cover; }
.sfm-cover-dot {
  position: absolute; top: 50%; left: 50%;
  width: 8px; height: 8px; border-radius: 50%;
  background: rgba(20,20,35,0.95); border: 2px solid rgba(255,255,255,0.15);
  transform: translate(-50%, -50%); z-index: 2;
}

/* Song info */
.sidebar-fm-info { flex: 1; min-width: 0; }
.sidebar-fm-name {
  font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.92);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  line-height: 1.3;
}
.sidebar-fm-artist {
  font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Control buttons */
.sidebar-fm-btns {
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.sfm-btn {
  width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.5); cursor: pointer; transition: all 0.15s;
  background: rgba(255,255,255,0.06); border: none;
}
.sfm-btn:hover { background: rgba(255,255,255,0.12); color: white; }
.sfm-btn:disabled { opacity: 0.25; cursor: default; }
.sfm-btn.liked { color: var(--primary); }
.sfm-btn-play {
  width: 34px; height: 34px; background: var(--primary); color: white;
  box-shadow: 0 2px 8px rgba(236,65,65,0.35);
}
.sfm-btn-play:hover { transform: scale(1.06); box-shadow: 0 2px 12px rgba(236,65,65,0.5); }

/* ── Mode buttons (below FM) ── */
.sidebar-modes {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;
  padding: 8px 12px;
  max-width: 100%; /* max 3 per row enforced by item width + gap */
  transition: padding 0.35s cubic-bezier(.4,0,.2,1);
}
.sidebar-modes.collapsed { padding: 8px 6px; gap: 6px; }
.mode-btn {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  cursor: pointer; transition: all 0.2s;
}
.mode-icon {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(var(--text-primary-rgb, 255,255,255), 0.06);
  color: var(--text-secondary);
  border: 1px solid rgba(var(--text-primary-rgb, 255,255,255), 0.04);
  transition: all 0.2s;
}
.mode-btn:hover .mode-icon {
  background: rgba(var(--text-primary-rgb, 255,255,255), 0.12);
  color: var(--text-primary);
  transform: scale(1.06);
}
.mode-label {
  font-size: 10px; color: var(--text-tertiary);
  white-space: nowrap; line-height: 1;
}

/* ── Sidebar toggle button ── */
.sidebar-toggle {
  display: flex; align-items: center; justify-content: center;
  height: 36px; margin: 4px 12px;
  border-radius: var(--radius-md);
  color: var(--text-tertiary); cursor: pointer;
  transition: color var(--transition-fast),
              background var(--transition-fast),
              margin 0.35s cubic-bezier(.4,0,.2,1),
              border-color 0.35s cubic-bezier(.4,0,.2,1);
  border-top: 1px solid var(--divider);
}
.sidebar-toggle:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
.sidebar.collapsed .sidebar-toggle {
  margin: 4px 6px;
  border-top-color: transparent;
}

/* ── Theme toggle ── */
.theme-toggle {
  justify-content: flex-start;
  gap: 12px;
  padding: 0 20px;
  font-size: var(--font-sm);
  font-weight: 500;
  border-top: none;
  border-bottom: 1px solid var(--divider);
}
.theme-toggle .sidebar-text {
  white-space: nowrap;
}
.sidebar.collapsed .theme-toggle {
  justify-content: center;
  padding: 0;
  gap: 0;
  border-bottom-color: transparent;
}

/* ── FM mini button (collapsed sidebar) ── */
.fm-mini-btn {
  width: 36px; height: 36px; border-radius: var(--radius-md);
  background: var(--primary-gradient);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  margin: 0 auto;
  position: relative;
  /* Hidden by default, shown when .visible */
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: max-height 0.25s cubic-bezier(.4,0,.2,1),
              opacity 0.2s ease,
              transform 0.2s ease,
              box-shadow 0.2s ease;
}
.fm-mini-btn.visible {
  max-height: 40px;
  opacity: 1;
  margin: 4px auto;
  transition: max-height 0.3s cubic-bezier(.4,0,.2,1) 0.1s,
              opacity 0.2s ease 0.15s,
              transform 0.2s ease,
              box-shadow 0.2s ease;
}
.fm-mini-btn.visible:hover {
  transform: scale(1.1);
  box-shadow: 0 0 16px rgba(236,65,65,0.5);
}
.fm-mini-btn.playing.visible {
  animation: fmGlow 2s ease-in-out infinite;
}
@keyframes fmGlow {
  0%, 100% { box-shadow: 0 0 10px rgba(236,65,65,0.4), 0 0 20px rgba(236,65,65,0.15); }
  50% { box-shadow: 0 0 24px rgba(236,65,65,0.7), 0 0 48px rgba(236,65,65,0.3); }
}

@keyframes rotateCover {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ─── Floating Circular Buttons ─── */
.float-btn {
  position: fixed; z-index: 200;
  width: 46px; height: 46px; border-radius: 50%;
  background: var(--bg-card); border: 1px solid var(--border);
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary); cursor: pointer;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.float-btn:hover {
  background: var(--primary); color: white; border-color: var(--primary);
  box-shadow: 0 4px 20px rgba(236,65,65,0.4);
  transform: scale(1.1);
}

/* Fullscreen button — bottom-right above bar, shifts left when bar collapses */
.float-fullscreen {
  right: 24px; bottom: 84px;
}
.float-fullscreen.shifted {
  right: 80px; bottom: 24px;
}
.float-fullscreen.at-restore {
  right: 24px; bottom: 24px; z-index: 201;
}

/* Restore bar button — bottom-right */
.float-restore {
  right: 24px; bottom: 24px;
}
.float-btn.glass {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-color: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}
.float-btn.glass:hover {
  background: rgba(255, 255, 255, 0.22);
  color: white;
  border-color: rgba(255, 255, 255, 0.25);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

/* ─── Transition: Bar slide down/up ─── */
.bar-slide-enter-active, .bar-slide-leave-active {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease;
}
.bar-slide-enter-from, .bar-slide-leave-to {
  transform: translateY(100%); opacity: 0;
}

/* ─── Transition: Detail page slide up/down ─── */
.detail-slide-enter-active, .detail-slide-leave-active {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease;
}
.detail-slide-enter-from {
  transform: translateY(40px); opacity: 0;
}
.detail-slide-leave-to {
  transform: translateY(40px); opacity: 0;
}

/* ─── Transition: Float button pop in ─── */
.float-pop-enter-active, .float-pop-leave-active {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
}
.float-pop-enter-from, .float-pop-leave-to {
  transform: scale(0); opacity: 0;
}


/* ─── Transition: Float button rise up ─── */
.float-rise-enter-active {
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease;
}
.float-rise-leave-active {
  transition: transform 0.3s ease, opacity 0.2s ease;
}
.float-rise-enter-from {
  transform: translateY(60px); opacity: 0;
}
.float-rise-leave-to {
  transform: translateY(20px); opacity: 0;
}
/* Pure mode enter/leave */
.pure-mode-enter-active {
  transition: opacity 0.4s ease;
}
.pure-mode-enter-active :deep(.pure-center) {
  animation: pure-center-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both;
}
.pure-mode-leave-active {
  transition: opacity 0.25s ease;
}
.pure-mode-enter-from { opacity: 0; }
.pure-mode-leave-to { opacity: 0; }
@keyframes pure-center-in {
  0% { transform: scale(0.92) translateY(16px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
/* Pure mode curtain overlay */
.pure-curtain {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pure-curtain-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.pure-curtain-icon-wrap {
  color: white;
  animation: curtain-icon-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.pure-curtain-label {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.04em;
}
@keyframes curtain-icon-pop {
  0% { transform: scale(0.4); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.pure-curtain-enter-active { transition: opacity 0.25s ease; }
.pure-curtain-leave-active { transition: opacity 0.4s ease; }
.pure-curtain-enter-from { opacity: 0; }
.pure-curtain-leave-to { opacity: 0; }

/* Canvas mode transition */
.canvas-enter-enter-active { transition: opacity 0.4s ease; }
.canvas-enter-leave-active { transition: opacity 0.3s ease; }
.canvas-enter-enter-from, .canvas-enter-leave-to { opacity: 0; }
</style>
