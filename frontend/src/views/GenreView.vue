<template>
  <div class="page genre-page">
    <div class="genre-header">
      <button class="btn btn-ghost" @click="router.back()">
        <Icon name="chevron-left" :size="18" /> 返回
      </button>
      <div class="genre-header-info">
        <h1 class="genre-title">{{ genreDetail?.tagName || '加载中...' }}</h1>
        <p class="genre-desc" v-if="genreDetail?.desc">{{ genreDetail.desc }}</p>
      </div>
    </div>

    <div class="genre-tabs">
      <button v-for="tab in tabs" :key="tab.key" class="genre-tab"
        :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
        <Icon :name="tab.icon" :size="16" /> {{ tab.label }}
      </button>
    </div>

    <div class="genre-sort" v-if="activeTab === 'songs'">
      <button class="sort-btn" :class="{ active: sortMode === 0 }" @click="sortMode = 0">热度</button>
      <button class="sort-btn" :class="{ active: sortMode === 1 }" @click="sortMode = 1">最新</button>
    </div>

    <!-- Songs Tab -->
    <div v-if="activeTab === 'songs'" class="genre-content">
      <div class="genre-song-list">
        <div v-for="(song, idx) in songs" :key="song.id" class="genre-song-item" @dblclick="playSong(song, idx)">
          <span class="song-idx">{{ idx + 1 }}</span>
          <img class="song-cover-sm" :src="(song.al?.picUrl || '') + '?param=60y60'" alt="" loading="lazy" />
          <div class="song-main">
            <div class="song-name">{{ song.name }}</div>
            <div class="song-artist">{{ (song.ar || []).map(a => a.name).join(', ') }}</div>
          </div>
          <div class="song-actions-row">
            <button class="action-btn" @click.stop="playSong(song, idx)" title="播放"><Icon name="play" :size="14" /></button>
            <button class="action-btn" :class="{ liked: userStore.isLiked(song.id) }" @click.stop="onLike(song)" title="喜欢">
              <Icon :name="userStore.isLiked(song.id) ? 'heart-fill' : 'heart'" :size="14" />
            </button>
            <button class="action-btn" @click.stop="quickAdd(song)" title="添加到歌单"><Icon name="plus-circle" :size="14" /></button>
          </div>
        </div>
      </div>
      <button v-if="songs.length" class="btn btn-ghost load-more" @click="loadMore('songs')" :disabled="contentLoading">
        {{ contentLoading ? '加载中...' : '加载更多' }}
      </button>
    </div>

    <!-- Playlists Tab -->
    <div v-if="activeTab === 'playlists'" class="genre-content">
      <div class="genre-grid">
        <div v-for="pl in playlists" :key="pl.id" class="card" @click="goToPlaylist(pl)">
          <div class="card-cover">
            <img :src="(pl.coverImgUrl || '') + '?param=300y300'" alt="" loading="lazy" />
            <div class="play-overlay"><div class="play-btn" @click.stop="playPlaylistDirect(pl)"><Icon name="play" :size="18" color="white" /></div></div>
          </div>
          <div class="card-body"><div class="card-title">{{ pl.name }}</div></div>
        </div>
      </div>
      <button v-if="playlists.length" class="btn btn-ghost load-more" @click="loadMore('playlists')" :disabled="contentLoading">
        {{ contentLoading ? '加载中...' : '加载更多' }}
      </button>
    </div>

    <!-- Artists Tab -->
    <div v-if="activeTab === 'artists'" class="genre-content">
      <div class="genre-artists-grid">
        <div v-for="ar in artists" :key="ar.id" class="artist-card">
          <img class="artist-avatar" :src="(ar.picUrl || ar.img1v1Url || '') + '?param=200y200'" alt="" loading="lazy" />
          <div class="artist-name">{{ ar.name }}</div>
        </div>
      </div>
      <button v-if="artists.length" class="btn btn-ghost load-more" @click="loadMore('artists')" :disabled="contentLoading">
        {{ contentLoading ? '加载中...' : '加载更多' }}
      </button>
    </div>

    <div v-if="contentLoading && !songs.length && !playlists.length && !artists.length" class="page-loading">
      <div class="loading-spinner"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'
import { useUserStore } from '../stores/user'
import { getStyleDetail, getStyleSongs, getStylePlaylists, getStyleArtists, likeSong, getPlaylistAllSongs, getSongUrl } from '../api'
import { slimSongs } from '../utils/slimSong'
import Icon from '../components/Icon.vue'

const route = useRoute()
const router = useRouter()
const playerStore = usePlayerStore()
const userStore = useUserStore()
const quickAdd = inject('quickAdd')

const tabs = [
  { key: 'songs', label: '歌曲', icon: 'music' },
  { key: 'playlists', label: '歌单', icon: 'list-music' },
  { key: 'artists', label: '歌手', icon: 'user' },
]
const activeTab = ref('songs')
const sortMode = ref(0)
const genreDetail = ref(null)
const songs = ref([])
const playlists = ref([])
const artists = ref([])
const contentLoading = ref(false)
let cursors = { songs: 0, playlists: 0, artists: 0 }

const tagId = ref(Number(route.params.tagId))

onMounted(() => {
  loadGenreDetail()
  loadContent()
})

watch(activeTab, () => loadContent())
watch(sortMode, () => { songs.value = []; cursors.songs = 0; loadContent() })

async function loadGenreDetail() {
  try {
    const res = await getStyleDetail(tagId.value)
    genreDetail.value = res.data || {}
  } catch {}
}

async function loadContent() {
  contentLoading.value = true
  try {
    const tab = activeTab.value
    if (tab === 'songs' && !songs.value.length) {
      const res = await getStyleSongs(tagId.value, 30, cursors.songs, sortMode.value)
      const data = res.data || {}
      songs.value = slimSongs(data.songs || [])
      cursors.songs = data.cursor || 0
    } else if (tab === 'playlists' && !playlists.value.length) {
      const res = await getStylePlaylists(tagId.value, 30, cursors.playlists)
      const data = res.data || {}
      playlists.value = data.playlists || []
      cursors.playlists = data.cursor || 0
    } else if (tab === 'artists' && !artists.value.length) {
      const res = await getStyleArtists(tagId.value, 30, cursors.artists)
      const data = res.data || {}
      artists.value = data.artists || []
      cursors.artists = data.cursor || 0
    }
  } catch {}
  finally { contentLoading.value = false }
}

async function loadMore(tab) {
  contentLoading.value = true
  try {
    if (tab === 'songs') {
      const res = await getStyleSongs(tagId.value, 30, cursors.songs, sortMode.value)
      const data = res.data || {}
      const existing = new Set(songs.value.map(s => s.id))
      songs.value.push(...slimSongs((data.songs || []).filter(s => !existing.has(s.id))))
      cursors.songs = data.cursor || 0
    } else if (tab === 'playlists') {
      const res = await getStylePlaylists(tagId.value, 30, cursors.playlists)
      const data = res.data || {}
      const existing = new Set(playlists.value.map(p => p.id))
      playlists.value.push(...(data.playlists || []).filter(p => !existing.has(p.id)))
      cursors.playlists = data.cursor || 0
    } else if (tab === 'artists') {
      const res = await getStyleArtists(tagId.value, 30, cursors.artists)
      const data = res.data || {}
      const existing = new Set(artists.value.map(a => a.id))
      artists.value.push(...(data.artists || []).filter(a => !existing.has(a.id)))
      cursors.artists = data.cursor || 0
    }
  } catch {}
  finally { contentLoading.value = false }
}

function playSong(song, idx) { playerStore.playSong(song, songs.value, idx) }
async function onLike(song) {
  if (!userStore.isLoggedIn) return
  try { await likeSong(song.id, !userStore.isLiked(song.id)); userStore.fetchLikeList() } catch {}
}
function goToPlaylist(pl) { router.push({ path: '/playlists', query: { id: pl.id } }) }
async function playPlaylistDirect(pl) {
  try {
    const res = await getPlaylistAllSongs(pl.id, 50)
    const list = slimSongs(res.songs || [])
    if (list.length) playerStore.playSong(list[0], list, 0)
  } catch {}
}
</script>

<style scoped>
.genre-page { padding: 24px 32px; max-width: 1200px; margin: 0 auto; }
.genre-header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
.genre-header-info { flex: 1; }
.genre-title { font-size: var(--font-2xl); font-weight: 800; margin: 0; }
.genre-desc { font-size: var(--font-sm); color: var(--text-tertiary); margin-top: 8px; line-height: 1.5; max-width: 600px; }

.genre-tabs { display: flex; gap: 4px; margin-bottom: 20px; padding: 3px; background: var(--bg-tertiary); border-radius: var(--radius-md); width: fit-content; }
.genre-tab {
  padding: 8px 20px; border-radius: var(--radius-sm); font-size: var(--font-sm); font-weight: 500;
  color: var(--text-tertiary); cursor: pointer; transition: all var(--transition-fast);
  display: flex; align-items: center; gap: 6px;
}
.genre-tab.active { background: var(--bg-card); color: var(--text-primary); box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
.genre-tab:hover:not(.active) { color: var(--text-secondary); }

.genre-sort { display: flex; gap: 8px; margin-bottom: 16px; }
.sort-btn {
  padding: 4px 14px; border-radius: var(--radius-full); font-size: var(--font-xs); font-weight: 500;
  background: var(--bg-tertiary); color: var(--text-tertiary); cursor: pointer; transition: all var(--transition-fast);
}
.sort-btn.active { background: var(--primary); color: white; }

.genre-content { min-height: 200px; }

/* Songs */
.genre-song-list { display: flex; flex-direction: column; gap: 2px; }
.genre-song-item {
  display: flex; align-items: center; gap: 12px; padding: 8px 12px;
  border-radius: var(--radius-sm); cursor: pointer; transition: background var(--transition-fast);
}
.genre-song-item:hover { background: var(--bg-hover); }
.song-idx { width: 28px; text-align: center; font-size: var(--font-sm); color: var(--text-tertiary); }
.song-cover-sm { width: 44px; height: 44px; border-radius: var(--radius-sm); object-fit: cover; }
.song-main { flex: 1; min-width: 0; }
.song-name { font-size: var(--font-sm); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.song-artist { font-size: var(--font-xs); color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.song-actions-row { display: flex; gap: 4px; opacity: 0; transition: opacity var(--transition-fast); }
.genre-song-item:hover .song-actions-row { opacity: 1; }
.action-btn {
  width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary); cursor: pointer; transition: all var(--transition-fast);
}
.action-btn:hover { background: var(--bg-active); color: var(--text-primary); }
.action-btn.liked { color: var(--primary); }

/* Playlists Grid */
.genre-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 20px;
}
.card { cursor: pointer; transition: transform var(--transition-fast); }
.card:hover { transform: translateY(-4px); }
.card-cover { position: relative; border-radius: var(--radius-md); overflow: hidden; aspect-ratio: 1; }
.card-cover img { width: 100%; height: 100%; object-fit: cover; }
.play-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity var(--transition-fast); }
.card:hover .play-overlay { opacity: 1; }
.play-btn { width: 44px; height: 44px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.card-body { padding: 8px 0; }
.card-title { font-size: var(--font-sm); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Artists Grid */
.genre-artists-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 20px;
}
.artist-card { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; }
.artist-avatar { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid var(--border); transition: transform var(--transition-fast); }
.artist-card:hover .artist-avatar { transform: scale(1.05); }
.artist-name { font-size: var(--font-sm); font-weight: 500; text-align: center; }

.load-more { margin: 24px auto; display: block; }
.page-loading { display: flex; justify-content: center; padding: 60px; }
</style>
