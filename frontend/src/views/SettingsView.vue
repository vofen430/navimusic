<template>
  <div class="page">
    <div class="page-header"><h1 class="page-title"><Icon name="settings" :size="24" color="var(--primary-light)" /> 设置</h1></div>
    <!-- Account -->
    <div class="settings-section">
      <h2 class="settings-title">账号</h2>
      <div class="settings-card">
        <div v-if="userStore.isLoggedIn" class="account-info">
          <img class="account-avatar" :src="(userStore.profile?.avatarUrl || '') + '?param=120y120'" alt="" />
          <div class="account-detail">
            <div class="account-name">{{ userStore.profile?.nickname }}</div>
            <div class="account-id">ID: {{ userStore.userId }}</div>
            <div class="account-meta"><span v-if="userStore.profile?.vipType">VIP</span><span>等级 Lv.{{ userStore.profile?.level || '?'}}</span></div>
          </div>
          <button class="btn btn-ghost" @click="onLogout"><Icon name="log-out" :size="16" /> 退出登录</button>
        </div>
        <div v-else class="account-login">
          <p>登录后可使用完整功能：每日推荐、歌单管理、喜欢歌曲等</p>
          <button class="btn btn-primary" @click="userStore.showLoginModal = true">登录</button>
        </div>
      </div>
    </div>
    <!-- Download -->
    <div class="settings-section">
      <h2 class="settings-title">下载设置</h2>
      <div class="settings-card">
        <div class="setting-item">
          <div class="setting-label"><div class="setting-name">下载音质</div><div class="setting-desc">音质越高，文件越大</div></div>
          <select v-model="settings.downloadQuality" class="setting-select">
            <option value="standard">标准 (128kbps)</option><option value="higher">较高 (192kbps)</option>
            <option value="exhigh">极高 (320kbps)</option><option value="lossless">无损 (FLAC)</option><option value="hires">Hi-Res</option>
          </select>
        </div>
        <div class="setting-item">
          <div class="setting-label"><div class="setting-name">下载格式偏好</div><div class="setting-desc">选择输出文件格式</div></div>
          <select v-model="settings.downloadFormat" class="setting-select">
            <option value="mp3">MP3</option><option value="flac">FLAC</option><option value="wav">WAV</option>
          </select>
        </div>
      </div>
    </div>
    <!-- NCMPlus -->
    <div class="settings-section">
      <h2 class="settings-title">NCMPlus 转换</h2>
      <div class="settings-card">
        <div class="setting-item">
          <div class="setting-label"><div class="setting-name">自动转换</div><div class="setting-desc">下载的 NCM 文件自动转换为目标格式</div></div>
          <label class="toggle"><input type="checkbox" v-model="settings.autoConvert" /><span class="toggle-slider"></span></label>
        </div>
        <div class="setting-item">
          <div class="setting-label"><div class="setting-name">输出格式</div><div class="setting-desc">NCM 文件转换后的输出格式</div></div>
          <select v-model="settings.ncmOutputFormat" class="setting-select">
            <option value="wav">WAV（默认）</option><option value="mp3">MP3</option><option value="flac">保留 FLAC</option>
          </select>
        </div>
        <div class="setting-item">
          <div class="setting-label"><div class="setting-name">转换后清理</div><div class="setting-desc">转换成功后清空原 NCM 文件内容</div></div>
          <label class="toggle"><input type="checkbox" v-model="settings.removeAfterConvert" /><span class="toggle-slider"></span></label>
        </div>
      </div>
    </div>
    <!-- Play -->
    <div class="settings-section">
      <h2 class="settings-title">播放设置</h2>
      <div class="settings-card">
        <div class="setting-item">
          <div class="setting-label"><div class="setting-name">播放音质</div><div class="setting-desc">在线播放时的音质选择</div></div>
          <select v-model="settings.playQuality" class="setting-select">
            <option value="standard">标准</option><option value="higher">较高</option><option value="exhigh">极高</option>
            <option value="lossless">无损</option><option value="hires">Hi-Res</option>
          </select>
        </div>
        <div class="setting-item">
          <div class="setting-label"><div class="setting-name">显示歌词</div><div class="setting-desc">全屏播放时显示歌词</div></div>
          <label class="toggle"><input type="checkbox" v-model="settings.showLyrics" /><span class="toggle-slider"></span></label>
        </div>
      </div>
    </div>
    <!-- About -->
    <div class="settings-section">
      <h2 class="settings-title">关于</h2>
      <div class="settings-card">
        <div class="setting-item"><div class="setting-label"><div class="setting-name">CloudMusic</div><div class="setting-desc">版本 1.0.0 · 基于 NeteaseCloudMusicApi</div></div></div>
        <div class="setting-item"><div class="setting-label"><div class="setting-name">NCMPlus</div><div class="setting-desc">NCM → WAV/MP3/FLAC 转换引擎</div></div></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'
import { useUserStore } from '../stores/user'
import Icon from '../components/Icon.vue'

const userStore = useUserStore()
const stored = JSON.parse(localStorage.getItem('cloudmusic-settings') || '{}')
const settings = reactive({
  downloadQuality: stored.downloadQuality || 'exhigh', downloadFormat: stored.downloadFormat || 'mp3',
  autoConvert: stored.autoConvert ?? true, ncmOutputFormat: stored.ncmOutputFormat || 'wav',
  removeAfterConvert: stored.removeAfterConvert ?? false, playQuality: stored.playQuality || 'exhigh', showLyrics: stored.showLyrics ?? true,
})
watch(settings, () => localStorage.setItem('cloudmusic-settings', JSON.stringify(settings)), { deep: true })
async function onLogout() { await userStore.logout(); window.__toast?.('已退出登录', 'info') }
</script>

<style scoped>
.settings-section { margin-bottom: 32px; }
.settings-title { font-size: var(--font-md); font-weight: 700; margin-bottom: 12px; color: var(--text-secondary); }
.settings-card { background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border); overflow: hidden; }
.setting-item { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--divider); }
.setting-item:last-child { border-bottom: none; }
.setting-label { flex: 1; }
.setting-name { font-size: var(--font-sm); font-weight: 600; }
.setting-desc { font-size: var(--font-xs); color: var(--text-tertiary); margin-top: 2px; }
.setting-select { background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 12px; color: var(--text-primary); font-size: var(--font-sm); cursor: pointer; min-width: 140px; }
.setting-select:focus { border-color: var(--primary); outline: none; }
.toggle { position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider { position: absolute; inset: 0; background: var(--bg-tertiary); border-radius: 12px; transition: background var(--transition-fast); }
.toggle-slider::before { content: ''; position: absolute; width: 18px; height: 18px; left: 3px; bottom: 3px; background: var(--text-secondary); border-radius: 50%; transition: transform var(--transition-fast), background var(--transition-fast); }
.toggle input:checked + .toggle-slider { background: var(--primary); }
.toggle input:checked + .toggle-slider::before { transform: translateX(20px); background: white; }
.account-info { display: flex; align-items: center; gap: 16px; padding: 20px; }
.account-avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border); }
.account-detail { flex: 1; }
.account-name { font-size: var(--font-lg); font-weight: 700; }
.account-id { font-size: var(--font-xs); color: var(--text-tertiary); }
.account-meta { display: flex; gap: 8px; margin-top: 4px; font-size: var(--font-xs); color: var(--text-secondary); }
.account-login { padding: 24px 20px; text-align: center; }
.account-login p { color: var(--text-secondary); margin-bottom: 16px; font-size: var(--font-sm); }
</style>
