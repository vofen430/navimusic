import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDownloadStore = defineStore('download', () => {
  const queue = ref([])       // { id, name, artist, progress, status, quality, url, size }
  const completed = ref([])   // downloaded items

  function addToQueue(song, quality = 'exhigh') {
    if (queue.value.find(d => d.id === song.id) || completed.value.find(d => d.id === song.id)) {
      return false
    }
    queue.value.push({
      id: song.id,
      name: song.name || song.al?.name || 'Unknown',
      artist: song.ar?.map(a => a.name).join(', ') || 'Unknown',
      cover: song.al?.picUrl || '',
      progress: 0,
      status: 'waiting',  // waiting | downloading | converting | done | error
      quality,
      url: '',
      size: 0,
      addedAt: Date.now()
    })
    return true
  }

  function updateProgress(id, progress, status) {
    const item = queue.value.find(d => d.id === id)
    if (item) {
      item.progress = progress
      if (status) item.status = status
    }
  }

  function completeDownload(id, filePath) {
    const idx = queue.value.findIndex(d => d.id === id)
    if (idx >= 0) {
      const item = { ...queue.value[idx], status: 'done', progress: 100, filePath, completedAt: Date.now() }
      completed.value.unshift(item)
      queue.value.splice(idx, 1)
    }
  }

  function removeFromQueue(id) {
    const idx = queue.value.findIndex(d => d.id === id)
    if (idx >= 0) queue.value.splice(idx, 1)
  }

  function removeCompleted(id) {
    const idx = completed.value.findIndex(d => d.id === id)
    if (idx >= 0) completed.value.splice(idx, 1)
  }

  function clearCompleted() {
    completed.value = []
  }

  return {
    queue, completed,
    addToQueue, updateProgress, completeDownload,
    removeFromQueue, removeCompleted, clearCompleted
  }
})
