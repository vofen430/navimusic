<template>
  <Transition name="tb-fade">
    <div v-if="isElectron && !hidden" class="titlebar-overlay">
      <button class="tb-btn tb-minimize" @click="minimize" title="最小化">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="1" y="5.5" width="10" height="1" rx="0.5" fill="currentColor"/>
        </svg>
      </button>
      <button class="tb-btn tb-maximize" @click="maximize" :title="isMax ? '还原' : '最大化'">
        <svg v-if="!isMax" width="12" height="12" viewBox="0 0 12 12">
          <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1" fill="none"/>
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 12 12">
          <rect x="3" y="0.5" width="8" height="8" rx="1.2" stroke="currentColor" stroke-width="1" fill="none"/>
          <rect x="0.5" y="3" width="8" height="8" rx="1.2" stroke="currentColor" stroke-width="1" fill="var(--bg-secondary, #141416)"/>
        </svg>
      </button>
      <button class="tb-btn tb-close" @click="closeWin" title="关闭">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

defineProps({
  hidden: { type: Boolean, default: false }
})

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
  setTimeout(syncMaxState, 100)
}
function closeWin() { window.electronAPI?.closeWindow() }

onMounted(() => {
  if (!isElectron) return
  syncMaxState()
  pollTimer = setInterval(syncMaxState, 500)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.titlebar-overlay {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 9000;
  display: flex;
  align-items: stretch;
  height: 36px;
  border-radius: 0 0 0 10px;
  overflow: hidden;
  -webkit-app-region: no-drag;
  user-select: none;
}

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

.tb-close:hover {
  background: #e81123;
  color: white;
}
.tb-close:active {
  background: #bf0f1d;
  color: white;
}

/* Fade transition for hide/show */
.tb-fade-enter-active { transition: opacity 0.2s ease; }
.tb-fade-leave-active { transition: opacity 0.15s ease; }
.tb-fade-enter-from, .tb-fade-leave-to { opacity: 0; }
</style>
