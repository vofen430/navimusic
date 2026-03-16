<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal quick-add-modal">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">添加到歌单</h2>
            <p class="modal-song-name">{{ songDisplayText }}</p>
          </div>
          <button class="modal-close" @click="$emit('close')"><Icon name="x" :size="18" /></button>
        </div>
        <div class="modal-body">
          <div class="quick-search">
            <Icon name="search" :size="16" color="var(--text-tertiary)" class="qs-icon" />
            <input v-model="filterText" type="text" placeholder="搜索歌单..." class="quick-search-input" />
          </div>
          <!-- Grid layout for playlists -->
          <div class="playlist-grid">
            <div v-for="pl in filteredPlaylists" :key="pl.id"
              class="playlist-grid-item" :class="{ adding: addingId === pl.id }"
              @click="addToPlaylist(pl)">
              <img class="pg-cover" :src="(pl.coverImgUrl || '') + '?param=160y160'" alt="" />
              <div class="pg-overlay">
                <div v-if="addingId === pl.id" class="loading-spinner" style="width:20px;height:20px;border-width:2px;"></div>
                <Icon v-else name="plus" :size="24" color="white" />
              </div>
              <div class="pg-name">{{ pl.name }}</div>
              <div class="pg-count">{{ pl.trackCount }} 首</div>
            </div>
          </div>
          <div class="create-new" v-if="!showCreateForm">
            <button class="btn btn-ghost btn-sm" style="width:100%;" @click="showCreateForm = true">
              <Icon name="plus-circle" :size="16" /> 新建歌单
            </button>
          </div>
          <div class="create-form" v-else>
            <input v-model="newPlaylistName" type="text" placeholder="输入歌单名称" @keydown.enter="createAndAdd" />
            <button class="btn btn-primary btn-sm" :disabled="!newPlaylistName.trim()" @click="createAndAdd">创建并添加</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useUserStore } from '../stores/user'
import { addSongToPlaylist, createPlaylist } from '../api'
import Icon from './Icon.vue'

const props = defineProps({ song: { type: [Object, Array], required: true } })
const emit = defineEmits(['close'])
const userStore = useUserStore()
const filterText = ref('')
const addingId = ref(null)
const showCreateForm = ref(false)
const newPlaylistName = ref('')

const songList = computed(() => Array.isArray(props.song) ? props.song : [props.song])
const songDisplayText = computed(() => {
  if (songList.value.length === 1) {
    const s = songList.value[0]
    const artist = s.ar?.map(a => a.name).join(', ') || 'Unknown'
    return `${s.name} — ${artist}`
  }
  return `${songList.value.length} 首歌曲`
})
const trackIds = computed(() => songList.value.map(s => s.id).join(','))
const filteredPlaylists = computed(() => {
  const list = userStore.myPlaylists
  if (!filterText.value) return list
  const q = filterText.value.toLowerCase()
  return list.filter(p => p.name.toLowerCase().includes(q))
})

async function addToPlaylist(pl) {
  if (addingId.value) return
  addingId.value = pl.id
  try {
    await addSongToPlaylist(pl.id, trackIds.value)
    const countText = songList.value.length > 1 ? `${songList.value.length} 首歌曲` : ''
    window.__toast?.(`已添加${countText}到「${pl.name}」`, 'success')
    emit('close')
  } catch { window.__toast?.('添加失败', 'error') }
  finally { addingId.value = null }
}

async function createAndAdd() {
  if (!newPlaylistName.value.trim()) return
  try {
    const res = await createPlaylist(newPlaylistName.value.trim())
    if (res.playlist) {
      await addSongToPlaylist(res.playlist.id, trackIds.value)
      userStore.fetchPlaylists()
      const countText = songList.value.length > 1 ? `${songList.value.length} 首歌曲` : '歌曲'
      window.__toast?.(`已创建「${newPlaylistName.value}」并添加${countText}`, 'success')
      emit('close')
    }
  } catch { window.__toast?.('创建歌单失败', 'error') }
}
</script>

<style scoped>
.quick-add-modal {
  max-width: 580px;
  max-height: 80vh;
}
.modal-song-name { font-size: 11px; color: var(--text-tertiary); margin-top: 4px; }
.quick-search { margin-bottom: 14px; position: relative; }
.qs-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); }
.quick-search-input {
  width: 100%; padding: 10px 14px 10px 38px;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary); border: 1px solid var(--border);
  font-size: 13px; transition: border-color 0.2s;
}
.quick-search-input:focus { border-color: var(--primary); }

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 12px;
  padding: 4px;
}

.playlist-grid-item {
  cursor: pointer;
  text-align: center;
  position: relative;
  transition: transform 0.2s ease;
  border-radius: var(--radius-md);
}
.playlist-grid-item:hover { transform: translateY(-3px) scale(1.02); }

.pg-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  object-fit: cover;
  display: block;
  box-shadow: 0 2px 12px rgba(0,0,0,0.15);
}

.pg-overlay {
  position: absolute;
  top: 0; left: 0; right: 0;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  background: rgba(0,0,0,0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.playlist-grid-item:hover .pg-overlay { opacity: 1; }
.playlist-grid-item.adding .pg-overlay { opacity: 1; }

.pg-name {
  font-size: 11px;
  font-weight: 700;
  margin-top: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pg-count { font-size: 10px; color: var(--text-tertiary); margin-top: 1px; }

.create-form { display: flex; gap: 8px; }
.create-form input { flex: 1; }
</style>
