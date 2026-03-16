<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div v-for="toast in toasts" :key="toast.id" class="toast" :class="toast.type">
          <Icon :name="iconMap[toast.type]" :size="16" :color="colorMap[toast.type]" />
          <span>{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, provide } from 'vue'
import Icon from './Icon.vue'

const toasts = ref([])
const iconMap = { success: 'heart-fill', error: 'x', warning: 'info', info: 'info' }
const colorMap = { success: 'var(--success)', error: 'var(--error)', warning: 'var(--warning)', info: 'var(--info)' }
let toastId = 0

function showToast(message, type = 'success', duration = 3000) {
  const id = ++toastId
  toasts.value.push({ id, message, type })
  setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, duration)
}

provide('toast', showToast)
window.__toast = showToast
</script>

<style scoped>
.toast-enter-active { animation: slideInRight 0.3s ease-out; }
.toast-leave-active { animation: fadeOut 0.2s ease-out forwards; }
</style>
