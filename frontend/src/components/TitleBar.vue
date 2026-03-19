<template>
  <div v-if="isElectron" class="titlebar" :class="{ 'is-maximized': isMax }">
    <!-- Drag region fills the entire bar -->
    <div class="titlebar-drag"></div>
    <!-- Window controls (right side) -->
    <div class="titlebar-controls">
      <button class="tb-btn tb-minimize" @click="minimize" title="最小化">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="1" y="5.5" width="10" height="1" rx="0.5" fill="currentColor"/>
        </svg>
      </button>
      <button class="tb-btn tb-maximize" @click="maximize" :title="isMax ? '还原' : '最大化'">
        <!-- Maximize icon -->
        <svg v-if="!isMax" width="12" height="12" viewBox="0 0 12 12">
          <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1" fill="none"/>
        </svg>
        <!-- Restore icon (two overlapping rectangles) -->
        <svg v-else width="12" height="12" viewBox="0 0 12 12">
          <rect x="3" y="0.5" width="8" height="8" rx="1.2" stroke="currentColor" stroke-width="1" fill="none"/>
          <rect x="0.5" y="3" width="8" height="8" rx="1.2" stroke="currentColor" stroke-width="1" fill="var(--bg-secondary)"/>
        </svg>
      </button>
      <button class="tb-btn tb-close" @click="closeWin" title="关闭">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isElectron = !!(window.electronAPI?.isElectron)
const isMax = ref(false)

let pollTimer = null

async function syncMaxState() {
  if (window.electronAPI?.isMaximized) {
    isMax.value = await window.electronAPI.isMaximized()
  }
}

function minimize() { window.electronAPI?.minimizeWindow() }
function maximize() {
  window.electronAPI?.maximizeWindow()
  // poll after a short delay to get the new state
  setTimeout(syncMaxState, 100)
}
function closeWin() { window.electronAPI?.closeWindow() }

onMounted(() => {
  if (!isElectron) return
  syncMaxState()
  // Poll maximized state periodically to keep icon in sync
  // (e.g. when user double-clicks title bar or uses Win+Up)
  pollTimer = setInterval(syncMaxState, 500)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.titlebar {
  position: relative;
  height: 38px;
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  background: var(--bg-secondary);
  z-index: 9000;
  user-select: none;
}

/* Drag region spans entire bar */
.titlebar-drag {
  position: absolute;
  inset: 0;
  -webkit-app-region: drag;
}

/* Controls container */
.titlebar-controls {
  position: relative;
  display: flex;
  align-items: stretch;
  height: 100%;
  -webkit-app-region: no-drag;
  z-index: 1;
}

/* Individual button */
.tb-btn {
  width: 46px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
  -webkit-app-region: no-drag;
}

.tb-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tb-btn:active {
  background: var(--bg-active);
}

/* Close button special styling */
.tb-close:hover {
  background: #e81123;
  color: white;
}
.tb-close:active {
  background: #bf0f1d;
  color: white;
}
</style>
