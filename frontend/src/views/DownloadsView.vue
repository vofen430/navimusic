<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title"><Icon name="download" :size="24" color="var(--primary-light)" /> 下载管理</h1>
      <p class="page-subtitle">管理您的下载内容</p>
    </div>
    <div class="section" v-if="downloadStore.queue.length">
      <div class="section-header"><h2 class="section-title">正在下载 ({{ downloadStore.queue.length }})</h2></div>
      <div class="download-list">
        <div v-for="item in downloadStore.queue" :key="item.id" class="download-item">
          <img class="dl-cover" :src="item.cover ? item.cover + '?param=80y80' : ''" alt="" />
          <div class="dl-info">
            <div class="dl-name">{{ item.name }}</div>
            <div class="dl-artist">{{ item.artist }}</div>
            <div class="dl-progress-row">
              <div class="dl-progress-bar"><div class="dl-progress-fill" :style="{ width: item.progress + '%' }"></div></div>
              <span class="dl-progress-text">{{ item.progress }}%</span>
            </div>
          </div>
          <div class="dl-status" :class="item.status">{{ statusLabels[item.status] || item.status }}</div>
          <button class="action-btn" @click="downloadStore.removeFromQueue(item.id)"><Icon name="x" :size="16" /></button>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">已下载 ({{ downloadStore.completed.length }})</h2>
        <button v-if="downloadStore.completed.length" class="btn btn-ghost btn-sm" @click="downloadStore.clearCompleted()">清空列表</button>
      </div>
      <div v-if="downloadStore.completed.length" class="download-list">
        <div v-for="item in downloadStore.completed" :key="item.id" class="download-item">
          <img class="dl-cover" :src="item.cover ? item.cover + '?param=80y80' : ''" alt="" />
          <div class="dl-info">
            <div class="dl-name">{{ item.name }}</div>
            <div class="dl-artist">{{ item.artist }}</div>
            <div class="dl-meta"><span class="tag">{{ item.quality }}</span><span class="dl-time">{{ formatDate(item.completedAt) }}</span></div>
          </div>
          <div class="dl-actions">
            <button class="action-btn" title="播放" @click="playDownloaded(item)"><Icon name="play" :size="16" /></button>
            <button class="action-btn" @click="downloadStore.removeCompleted(item.id)"><Icon name="trash" :size="16" /></button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <Icon name="download" :size="48" color="var(--text-tertiary)" />
        <div class="empty-text" style="margin-top: 16px;">暂无下载内容</div>
        <p style="color: var(--text-tertiary); font-size: var(--font-sm);">在歌曲列表中点击下载按钮开始下载</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useDownloadStore } from '../stores/download'
import { usePlayerStore } from '../stores/player'
import { getSongDetail } from '../api'
import Icon from '../components/Icon.vue'

const downloadStore = useDownloadStore()
const playerStore = usePlayerStore()
const statusLabels = { waiting: '等待中', downloading: '下载中', converting: '转换中', done: '完成', error: '失败' }

async function playDownloaded(item) {
  try { const res = await getSongDetail(item.id.toString()); const song = res.songs?.[0]; if (song) playerStore.playSong(song) } catch {}
}
function formatDate(ts) {
  if (!ts) return ''; const d = new Date(ts)
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`
}
</script>

<style scoped>
.download-list { display: flex; flex-direction: column; gap: 4px; }
.download-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: var(--radius-md); transition: background var(--transition-fast); }
.download-item:hover { background: var(--bg-hover); }
.dl-cover { width: 48px; height: 48px; border-radius: var(--radius-sm); object-fit: cover; flex-shrink: 0; background: var(--bg-tertiary); }
.dl-info { flex: 1; min-width: 0; }
.dl-name { font-size: var(--font-sm); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dl-artist { font-size: var(--font-xs); color: var(--text-tertiary); }
.dl-progress-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.dl-progress-bar { flex: 1; height: 4px; background: var(--bg-tertiary); border-radius: 2px; overflow: hidden; }
.dl-progress-fill { height: 100%; background: var(--primary-gradient); border-radius: 2px; transition: width 0.3s ease; }
.dl-progress-text { font-size: var(--font-xs); color: var(--text-tertiary); min-width: 36px; }
.dl-status { font-size: var(--font-xs); font-weight: 500; padding: 4px 10px; border-radius: var(--radius-full); background: var(--bg-tertiary); color: var(--text-secondary); flex-shrink: 0; }
.dl-status.downloading { background: rgba(33,150,243,0.1); color: var(--info); }
.dl-status.converting { background: rgba(255,152,0,0.1); color: var(--warning); }
.dl-status.error { background: rgba(244,67,54,0.1); color: var(--error); }
.dl-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.dl-time { font-size: var(--font-xs); color: var(--text-tertiary); }
.dl-actions { display: flex; gap: 4px; }
</style>
