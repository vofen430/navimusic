<template>
  <div class="player-bar" :class="{ idle: !hasSong }"
    :style="playerStore.themeColor ? { '--theme-rgb': playerStore.themeColor } : {}"
  >
    <div v-if="hasSong" class="player-progress-top" @click="seekFromBar">
      <div class="progress-fill" :style="{ width: playerStore.progress + '%' }"></div>
    </div>
    <div class="player-content">
      <div class="player-song" :class="{ clickable: hasSong }" @click="hasSong && expandDetail()">
        <div class="player-cover" :class="{ idle: !hasSong }">
          <img v-if="hasSong" :src="coverUrl" alt="" class="cover-img" :class="{ spinning: playerStore.isPlaying }" />
          <div v-else class="player-cover-empty">
            <Icon name="disc" :size="20" />
          </div>
        </div>
        <div class="player-info">
          <div class="player-name">{{ hasSong ? playerStore.currentSong.name : '暂无音乐播放' }}</div>
          <div class="player-artist">{{ hasSong ? artistName : '从每日推荐、歌单或搜索结果开始播放' }}</div>
        </div>
      </div>

      <div class="player-controls">
        <button class="ctrl-btn" :class="{ 'fm-active': playerStore.fmMode }" :disabled="!hasSong" @click="playerStore.togglePlayMode()" :title="modeLabel"><Icon :name="modeIcon" :size="18" /></button>
        <button class="ctrl-btn" :disabled="!hasSong" @click="playerStore.playPrev()" title="上一曲"><Icon name="skip-back" :size="18" /></button>
        <button class="ctrl-btn play-btn-main" :class="{ disabled: !hasSong }" :disabled="!hasSong" @click="playerStore.togglePlay()" :title="playerStore.isPlaying ? '暂停' : '播放'">
          <Icon :name="hasSong && playerStore.isPlaying ? 'pause' : 'play'" :size="20" color="white" />
        </button>
        <button class="ctrl-btn" :disabled="!hasSong" @click="playerStore.playNext()" title="下一曲"><Icon name="skip-forward" :size="18" /></button>
        <button class="ctrl-btn" @click="showPlaylist = !showPlaylist" title="播放列表"><Icon name="list" :size="18" /></button>
      </div>

      <div class="player-actions">
        <button class="ctrl-btn" :class="{ liked: isLiked }" :disabled="!hasSong" @click="onLike" title="喜欢">
          <Icon :name="isLiked ? 'heart-fill' : 'heart'" :size="18" />
        </button>
        <button class="ctrl-btn" :disabled="!hasSong" @click="emit('show-comments', playerStore.currentSong.id)" title="评论">
          <Icon name="message-circle" :size="18" />
          <span v-if="hasSong" class="count-badge">{{ songInfo.commentCount ? formatCount(songInfo.commentCount) : '...' }}</span>
        </button>
        <button class="ctrl-btn" :disabled="!hasSong" @click="emit('quick-add', playerStore.currentSong)" title="添加到歌单"><Icon name="plus-circle" :size="18" /></button>
        <button class="ctrl-btn" :disabled="!hasSong" @click="startSimiRoam" title="相似歌曲漫游"><Icon name="radio" :size="18" /></button>
        <button class="ctrl-btn" :disabled="!hasSong" @click="onDownload" title="下载"><Icon name="download" :size="18" /></button>
        <div class="volume-control">
          <button class="ctrl-btn" @click="playerStore.toggleMute()" :title="playerStore.isMuted ? '取消静音' : '静音'">
            <Icon :name="playerStore.isMuted || playerStore.volume === 0 ? 'volume-x' : 'volume-2'" :size="18" />
          </button>
          <input type="range" min="0" max="100" :value="playerStore.isMuted ? 0 : playerStore.volume * 100"
            @input="playerStore.setVolume($event.target.value / 100)" class="volume-slider" />
        </div>
        <span class="player-time">{{ hasSong ? `${formatTime(playerStore.currentTime)} / ${formatTime(playerStore.duration)}` : '等待播放' }}</span>
        <button class="ctrl-btn bar-collapse-btn" @click="emit('collapse-bar')" title="收起底栏">
          <Icon name="chevron-down" :size="18" />
        </button>
      </div>
    </div>

    <Transition name="slide-up">
      <div v-if="showPlaylist" class="playlist-drawer">
        <div class="drawer-header">
          <h3>播放列表 ({{ playerStore.playlist.length }})</h3>
          <button class="btn btn-ghost btn-sm" :disabled="!playerStore.playlist.length" @click="playerStore.clearPlaylist()">清空</button>
        </div>
        <div class="drawer-list">
          <div v-if="!playerStore.playlist.length" class="drawer-empty">
            <Icon name="music" :size="18" />
            <span>还没有加入播放列表的音乐</span>
          </div>
          <div v-for="(song, idx) in playerStore.playlist" :key="song.id"
            class="drawer-item" :class="{ active: idx === playerStore.currentIndex }"
            @click="playerStore.playSong(song)">
            <span class="drawer-name">{{ song.name }}</span>
            <span class="drawer-artist">{{ song.ar?.map(a => a.name).join(', ') }}</span>
            <button class="drawer-remove" @click.stop="playerStore.removeFromPlaylist(idx)"><Icon name="x" :size="14" /></button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useUserStore } from '../stores/user'
import { useDownloadStore } from '../stores/download'
import { likeSong, getSongUrl, getSimiSong } from '../api'
import Icon from './Icon.vue'

const emit = defineEmits(['quick-add', 'show-comments', 'collapse-bar'])
const playerStore = usePlayerStore()
const userStore = useUserStore()
const downloadStore = useDownloadStore()
const expandDetail = inject('expandDetail')
const showPlaylist = ref(false)
// Use centralized songInfo from playerStore (no duplicate API calls)
const songInfo = computed(() => playerStore.songInfo)
const hasSong = computed(() => !!playerStore.currentSong)

const coverUrl = computed(() => playerStore.coverUrl200)
const artistName = computed(() => playerStore.currentSong?.ar?.map(a => a.name).join(', ') || '')
const isLiked = computed(() => userStore.isLiked(playerStore.currentSong?.id))
const modeIcon = computed(() => playerStore.fmMode ? 'radio' : ({ list: 'repeat', random: 'shuffle', single: 'repeat-1' })[playerStore.playMode])
const modeLabel = computed(() => playerStore.fmMode ? '私人FM（点击退出）' : ({ list: '列表循环', random: '随机播放', single: '单曲循环' })[playerStore.playMode])

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
function formatCount(n) {
  if (!n) return ''
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return n.toString()
}
function seekFromBar(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  playerStore.seek(((e.clientX - rect.left) / rect.width) * 100)
}
async function onLike() {
  if (!userStore.isLoggedIn) { userStore.showLoginModal = true; return }
  try {
    const like = !isLiked.value
    await likeSong(playerStore.currentSong.id, like)
    userStore.fetchLikeList()
    window.__toast?.(like ? '已添加到喜欢' : '已取消喜欢', 'success')
  } catch { window.__toast?.('操作失败', 'error') }
}
async function startSimiRoam() {
  const song = playerStore.currentSong
  if (!song) return
  try {
    window.__toast?.('正在加载相似歌曲...', 'info')
    const res = await getSimiSong(song.id)
    const songs = res.songs || []
    if (songs.length) {
      playerStore.playSong(songs[0], songs, 0)
      window.__toast?.(`开始漫游 ${songs.length} 首相似歌曲`, 'success')
    } else { window.__toast?.('未找到相似歌曲', 'warning') }
  } catch { window.__toast?.('加载失败', 'error') }
}
async function onDownload() {
  const song = playerStore.currentSong
  if (!song) return
  const added = downloadStore.addToQueue(song)
  if (!added) { window.__toast?.('已在下载列表中', 'info'); return }
  window.__toast?.('已添加到下载', 'success')
  try {
    const settings = JSON.parse(localStorage.getItem('cloudmusic-settings') || '{}')
    const urlRes = await getSongUrl(song.id, settings.downloadQuality || 'exhigh')
    const urlData = urlRes.data?.[0]
    if (urlData?.url) { downloadStore.updateProgress(song.id, 50, 'downloading'); setTimeout(() => downloadStore.completeDownload(song.id, urlData.url), 1500) }
  } catch { downloadStore.updateProgress(song.id, 0, 'error') }
}
</script>

<style scoped>
.player-bar {
  --theme-rgb: 80, 80, 120;
  height: var(--player-height); background: linear-gradient(90deg, rgba(var(--theme-rgb), 0.15), var(--bg-secondary) 60%);
  border-top: 1px solid var(--divider); position: relative; flex-shrink: 0; z-index: 100;
}
.player-bar.idle { background: var(--bg-secondary); }
.player-progress-top { height: 3px; background: var(--bg-tertiary); cursor: pointer; position: absolute; top: 0; left: 0; right: 0; }
.player-progress-top:hover { height: 5px; }
.player-progress-top .progress-fill { height: 100%; background: var(--primary-gradient); transition: width 0.1s linear; }
.player-content { display: flex; align-items: center; height: 100%; padding: 0 20px; gap: 16px; }
.player-song { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
.player-song.clickable { cursor: pointer; }
.player-cover { width: 52px; height: 52px; border-radius: var(--radius-md); overflow: hidden; flex-shrink: 0; }
.player-cover.idle { background: var(--bg-tertiary); border: 1px solid var(--border); }
.player-cover-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); }
.cover-img { width: 100%; height: 100%; object-fit: cover; }
.cover-img.spinning { animation: rotateCover 12s linear infinite; border-radius: 50%; }
.player-info { min-width: 0; }
.player-name { font-size: var(--font-sm); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.player-artist { font-size: var(--font-xs); color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.player-controls { display: flex; align-items: center; gap: 6px; }
.ctrl-btn { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all var(--transition-fast); color: var(--text-secondary); position: relative; cursor: pointer; }
.ctrl-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.ctrl-btn:disabled { cursor: default; opacity: 0.4; }
.ctrl-btn:disabled:hover { background: transparent; color: var(--text-secondary); }
.ctrl-btn.liked { color: var(--primary); }
.ctrl-btn.fm-active {
  color: var(--primary);
  background: rgba(236, 65, 65, 0.12);
}
.play-btn-main { width: 44px; height: 44px; background: var(--primary-gradient); color: white; box-shadow: var(--shadow-glow); }
.play-btn-main:hover { transform: scale(1.05); }
.play-btn-main.disabled { box-shadow: none; background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-tertiary); }
.play-btn-main.disabled:hover { transform: none; }
.player-actions { display: flex; align-items: center; gap: 2px; flex: 1; justify-content: flex-end; }
.count-badge { font-size: 10px; position: absolute; top: -2px; right: -8px; background: var(--bg-active); padding: 0 4px; border-radius: 8px; line-height: 16px; color: var(--text-tertiary); white-space: nowrap; pointer-events: none; }
.volume-control { display: flex; align-items: center; gap: 2px; }
.volume-slider { width: 70px; height: 4px; -webkit-appearance: none; appearance: none; background: var(--bg-tertiary); border-radius: 2px; outline: none; border: none; padding: 0; }
.volume-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: var(--primary); cursor: pointer; }
.player-time { font-size: var(--font-xs); color: var(--text-tertiary); min-width: 80px; text-align: right; }
.bar-collapse-btn { margin-left: 8px; border-left: 1px solid var(--border); padding-left: 8px; border-radius: var(--radius-sm); }
.bar-collapse-btn:hover { color: var(--primary); }
.playlist-drawer { position: absolute; bottom: 100%; right: 0; width: 360px; max-height: 400px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg) var(--radius-lg) 0 0; box-shadow: var(--shadow-lg); display: flex; flex-direction: column; }
.drawer-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--divider); }
.drawer-header h3 { font-size: var(--font-base); font-weight: 600; }
.drawer-list { overflow-y: auto; flex: 1; padding: 8px; }
.drawer-empty { min-height: 88px; display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--text-tertiary); font-size: var(--font-sm); }
.drawer-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; transition: background var(--transition-fast); }
.drawer-item:hover { background: var(--bg-hover); }
.drawer-item.active { color: var(--primary); }
.drawer-name { flex: 1; font-size: var(--font-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.drawer-artist { font-size: var(--font-xs); color: var(--text-tertiary); max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.drawer-remove { opacity: 0; color: var(--text-tertiary); transition: opacity var(--transition-fast); }
.drawer-item:hover .drawer-remove { opacity: 1; }
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(20px); }
</style>
