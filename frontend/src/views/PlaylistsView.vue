<template>
  <div class="page playlists-page">
    <div class="playlists-layout" ref="layoutRef">
      <!-- Left: Playlist grid sidebar -->
      <div class="playlists-sidebar">
        <div class="playlists-sidebar-inner">
          <div class="playlists-sidebar-header">
            <div>
              <h2>{{ currentPlaylistView.label }}</h2>
              <div class="playlists-sidebar-subtitle">{{ currentPlaylistView.description }}</div>
            </div>
            <div class="playlist-view-switch" role="tablist" aria-label="歌单分类切换">
              <button
                v-for="view in playlistViews"
                :key="view.key"
                class="playlist-view-btn"
                :class="{ active: activePlaylistView === view.key }"
                :title="view.label"
                :aria-label="view.label"
                :aria-selected="activePlaylistView === view.key"
                @click="setActivePlaylistView(view.key)"
              >
                <Icon :name="view.icon" :size="16" />
              </button>
            </div>
          </div>

          <div class="playlists-sidebar-toolbar">
            <div class="playlists-sidebar-meta">{{ visiblePlaylists.length }} 个歌单</div>
            <button v-if="activePlaylistView === 'mine'" class="btn btn-primary btn-sm" @click="showCreateDialog = true"><Icon name="plus" :size="14" /> 新建</button>
          </div>

          <div v-if="visiblePlaylists.length" class="playlists-grid" :style="gridStyle" ref="playlistGridRef"
            @dragover.prevent="onDragOverGrid" @dragleave="clearDropIndicator" @drop="onDropPlaylist($event)">
            <div v-for="(pl, plIdx) in visiblePlaylists" :key="pl.id"
              class="pl-card" :class="{
                active: selectedId === pl.id,
                dragging: activePlaylistView === 'mine' && isDraggingPlaylist(plIdx),
                'pl-selected': activePlaylistView === 'mine' && selectedPlIdxes.has(plIdx),
                'song-drop-target': songTransferHoverPlaylistId === pl.id
              }"
              :data-playlist-id="pl.id"
              :data-pl-idx="plIdx"
              :draggable="activePlaylistView === 'mine'"
              @dragstart="activePlaylistView === 'mine' && onDragStartPlaylist(plIdx, $event)"
              @dragend="onDragEndPlaylist"
              @click="onPlaylistClick(pl, plIdx, $event)">
              <div class="pl-card-badge" :class="activePlaylistView">
                <Icon :name="playlistSourceIcon(pl)" :size="12" />
              </div>
              <div class="pl-card-cover-wrap">
                <img class="pl-card-cover" :src="(pl.coverImgUrl || '') + '?param=200y200'" alt="" loading="lazy" />
                <div v-if="pl.privacy === 10" class="pl-card-lock">
                  <Icon name="lock" :size="28" color="rgba(255,255,255,0.75)" />
                </div>
                <div class="pl-card-play" @click.stop="playPlaylistDirect(pl)">
                  <Icon name="play" :size="18" color="white" />
                </div>
              </div>
              <div class="pl-card-info">
                <div class="pl-card-name">{{ pl.name }}</div>
                <div class="pl-card-count">{{ pl.trackCount }} 首</div>
              </div>
            </div>
            <!-- Drop indicator line -->
            <div v-show="dropIndicatorStyle" class="drop-indicator" :style="dropIndicatorStyle">
              <span class="drop-dot top"></span>
              <span class="drop-dot bottom"></span>
            </div>
          </div>

          <div v-else class="playlist-tab-empty">
            <Icon :name="currentPlaylistView.icon" :size="24" color="var(--text-tertiary)" />
            <div class="playlist-tab-empty-title">{{ currentPlaylistView.emptyTitle }}</div>
            <div class="playlist-tab-empty-text">{{ currentPlaylistView.emptyText }}</div>
          </div>
        </div>
      </div>

      <!-- Toggle button: positioned at sidebar/detail boundary -->
      <div class="toggle-wrapper" v-if="showDetailToggle">
        <button class="detail-panel-toggle" :class="{ collapsed: isDetailCollapsed }" @click="toggleDetail"
          :title="isDetailCollapsed ? '展开详情' : '收起详情'">
          <Icon :name="isDetailCollapsed ? 'chevron-left' : 'chevron-right'" :size="16" />
        </button>
      </div>

      <!-- Right: Playlist detail panel -->
      <div class="playlist-detail" ref="detailPanelRef"
        :class="{ open: !isDetailCollapsed, 'no-transition': isResizing || skipDetailTransition }"
        :style="detailPanelStyle">
        <div class="resize-handle" @mousedown.prevent="onResizeStart"></div>

        <div class="detail-inner">
          <template v-if="selectedPlaylist">
            <div class="detail-nav-bar">
              <button class="detail-nav-btn" :disabled="!canGoDetailBack" @click="goDetailBack" title="上一歌单">
                <Icon name="chevron-left" :size="16" />
              </button>
              <button class="detail-nav-btn" :disabled="!canGoDetailForward" @click="goDetailForward" title="下一歌单">
                <Icon name="chevron-right" :size="16" />
              </button>
            </div>
            <div class="detail-header">
              <div class="detail-cover-wrap" @click="showCoverPanel = true">
                <img class="detail-cover" :src="(selectedPlaylist.coverImgUrl || '') + '?param=300y300'" alt="" />
              </div>
              <input ref="coverInputRef" type="file" accept="image/*" style="display:none" @change="onCoverFileSelected" />

              <div class="detail-info">
                <div v-if="editingName" class="detail-name-edit">
                  <input v-model="editName" type="text" @keydown.enter="saveName" @blur="saveName" ref="nameInputRef" />
                </div>
                <h1 v-else class="detail-name" :class="{ editable: isOwner }" @click="startEditName">
                  {{ selectedPlaylist.name }}
                  <Icon v-if="isOwner" name="edit" :size="16" color="var(--text-tertiary)" class="edit-hint" />
                </h1>

                <div v-if="editingDesc" class="detail-desc-edit">
                  <textarea v-model="editDesc" rows="2" @blur="saveDesc" ref="descInputRef" placeholder="添加描述..."></textarea>
                </div>
                <p v-else class="detail-desc" :class="{ editable: isOwner }" @click="startEditDesc">
                  {{ selectedPlaylist.description || (isOwner ? '点击添加描述' : '暂无描述') }}
                </p>

                <div class="detail-meta">
                  <span>{{ songs.length }} 首歌</span>
                  <span v-if="selectedPlaylist.playCount">· {{ formatCount(selectedPlaylist.playCount) }} 次播放</span>
                  <span v-if="selectedPlaylist.privacy === 10" class="privacy-badge">
                    <Icon name="lock" :size="12" /> 隐私歌单
                  </span>
                </div>
                <div class="detail-actions">
                  <div class="play-split-btn" @click.stop>
                    <button class="play-split-main" @click="playAll"><Icon name="play" :size="16" color="white" /> 播放全部</button>
                    <button class="play-split-more" @click.stop="showPlayMenu = !showPlayMenu">
                      <Icon name="more-vertical" :size="14" color="white" />
                    </button>
                    <Transition name="dropdown-fade">
                      <div v-if="showPlayMenu" class="play-split-dropdown">
                        <button class="play-split-dropdown-item" @click="addAllToQueue">
                          <Icon name="list-plus" :size="16" /> 加入播放队列
                        </button>
                      </div>
                    </Transition>
                  </div>
                  <button class="btn btn-ghost" @click="downloadAll"><Icon name="download" :size="16" /> 下载全部</button>
                  <div class="detail-more-menu" @click.stop>
                    <button class="btn btn-ghost detail-more-trigger" @click.stop="showDetailMenu = !showDetailMenu">
                      <Icon name="more-vertical" :size="16" />
                    </button>
                    <Transition name="dropdown-fade">
                      <div v-if="showDetailMenu" class="detail-more-dropdown">
                        <button class="detail-more-item" @click="copyShareLink(); showDetailMenu = false">
                          <Icon name="link" :size="16" /> 复制链接
                        </button>
                        <button v-if="isOwner && songs.length && !editMode" class="detail-more-item" @click="enterEditMode(); showDetailMenu = false">
                          <Icon name="edit" :size="16" /> 编辑歌单
                        </button>
                        <button v-if="isOwner && selectedPlaylist.privacy === 10 && !privacyConfirmState" class="detail-more-item" @click="privacyConfirmState = 'confirm'">
                          <Icon name="unlock" :size="16" /> 公开歌单
                        </button>
                        <button v-if="privacyConfirmState === 'confirm'" class="detail-more-item privacy-confirm" @click="confirmMakePublic">
                          <Icon name="unlock" :size="16" /> 是否公开歌单？
                        </button>
                        <div v-if="privacyConfirmState === 'done'" class="detail-more-item privacy-done">
                          <Icon name="unlock" :size="16" /> 已公开歌单 ✓
                        </div>
                      </div>
                    </Transition>
                  </div>
                </div>
              </div>
            </div>

            <!-- Cover Info Panel -->
            <Teleport to="body">
              <Transition name="cover-panel">
                <div v-if="showCoverPanel" class="cover-panel-overlay" @click.self="showCoverPanel = false">
                  <div class="cover-panel">
                    <div class="cover-panel-bg" :style="{ backgroundImage: `url(${(selectedPlaylist.coverImgUrl || '') + '?param=300y300'})` }"></div>
                    <button class="cover-panel-close" @click="showCoverPanel = false"><Icon name="x" :size="18" /></button>
                    <div class="cover-panel-body">
                      <div class="cover-panel-left">
                        <div class="cover-panel-img-wrap">
                          <img class="cover-panel-img" :src="(selectedPlaylist.coverImgUrl || '') + '?param=300y300'" alt="" />
                        </div>
                        <button v-if="isOwner" class="cover-panel-change-btn" @click="triggerCoverUpload(); showCoverPanel = false">
                          <Icon name="image" :size="14" /> 更换封面
                        </button>
                      </div>
                      <div class="cover-panel-right">
                        <template v-if="isOwner">
                          <input class="cover-panel-name-input" v-model="panelEditName" @blur="panelSaveName" @keydown.enter="panelSaveName" placeholder="歌单名称" />
                          <textarea class="cover-panel-desc-input" v-model="panelEditDesc" @blur="panelSaveDesc" rows="4" placeholder="添加描述..."></textarea>
                        </template>
                        <template v-else>
                          <h2 class="cover-panel-name">{{ selectedPlaylist.name }}</h2>
                          <p class="cover-panel-desc">{{ selectedPlaylist.description || '暂无描述' }}</p>
                        </template>
                        <div class="cover-panel-divider"></div>
                        <div class="cover-panel-footer">
                          <div class="cover-panel-meta">
                            <span><Icon name="music" :size="12" /> {{ songs.length }} 首</span>
                            <span v-if="selectedPlaylist.playCount"><Icon name="play" :size="10" /> {{ formatCount(selectedPlaylist.playCount) }}</span>
                            <span v-if="selectedPlaylist.privacy === 10" class="cover-panel-privacy">
                              <Icon name="lock" :size="10" /> 隐私
                            </span>
                          </div>
                          <div v-if="selectedPlaylist.creator" class="cover-panel-creator">
                            {{ selectedPlaylist.creator.nickname || '' }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
            </Teleport>

            <div class="detail-songs">
              <!-- Edit mode toolbar -->
              <div v-if="editMode" class="edit-toolbar">
                <label class="edit-select-all" @click.prevent="editToggleSelectAll">
                  <input type="checkbox" :checked="isEditAllSelected" :indeterminate="editSelection.size > 0 && !isEditAllSelected" @click.prevent />
                  <span>{{ isEditAllSelected ? '取消全选' : '全选' }}</span>
                </label>
                <span v-if="editSelection.size" class="edit-count">已选 {{ editSelection.size }} 首</span>
                <div class="edit-toolbar-spacer"></div>
                <button class="btn btn-sm btn-ghost" :disabled="!editSelection.size" @click="editAddToPlaylist">
                  <Icon name="plus-circle" :size="14" /> 收藏到歌单
                </button>
                <button class="btn btn-sm edit-delete-btn" :disabled="!editSelection.size" @click="editRemoveSelected">
                  <Icon name="trash" :size="14" /> 删除{{ editSelection.size ? ` (${editSelection.size})` : '' }}
                </button>
                <button class="btn btn-sm btn-primary" @click="exitEditMode">
                  完成
                </button>
              </div>

              <div v-if="loadingSongs" class="page-loading"><div class="loading-spinner"></div></div>
              <template v-else-if="songs.length">
                <div v-for="(song, idx) in songs" :key="song.id + '-' + idx" class="song-item"
                  :class="{
                    active: !editMode && playerStore.currentSong?.id === song.id,
                    selected: editMode ? editSelection.has(idx) : isSongSelected(idx),
                    dragging: !editMode && dragSongIdx === idx,
                    'transfer-source': !editMode && isSongTransferSource(idx),
                    'edit-mode': editMode
                  }"
                  @click="editMode ? editToggleSelect(idx) : onSongRowClick(idx, $event)"
                  @mousedown="editMode ? null : onSongPointerDown(idx, $event)"
                  @contextmenu.prevent
                  @dragover.prevent="editMode ? null : onDragOverSong(idx)"
                  @drop.prevent="editMode ? null : onDropSong(idx)"
                  @dblclick="editMode ? null : playSong(song, idx)">
                  <!-- Edit mode: checkbox -->
                  <span v-if="editMode" class="edit-checkbox" @click.stop="editToggleSelect(idx)">
                    <input type="checkbox" :checked="editSelection.has(idx)" @click.stop.prevent="editToggleSelect(idx)" />
                  </span>
                  <!-- Normal mode: drag handle + index -->
                  <template v-else>
                    <span class="song-drag-handle"
                      draggable="true"
                      @mousedown.stop
                      @click.stop
                      @dragstart="onDragStartSong(idx, $event)"
                      @dragend="dragSongIdx = null">
                      <Icon name="menu" :size="14" color="var(--text-tertiary)" />
                    </span>
                    <span class="song-index">
                      <template v-if="playerStore.currentSong?.id === song.id"><Icon name="music" :size="14" color="var(--primary)" /></template>
                      <template v-else>{{ idx + 1 }}</template>
                    </span>
                  </template>
                  <div class="song-cover"><img :src="(song.al?.picUrl || '') + '?param=80y80'" alt="" loading="lazy" /></div>
                  <div class="song-info">
                    <div class="song-name">{{ song.name }}</div>
                    <div class="song-artist">{{ formatArtists(song) }} · {{ song.al?.name || '' }}</div>
                  </div>
                  <div v-if="!editMode" class="song-actions">
                    <button class="action-btn" @click.stop="playSong(song, idx)" title="播放"><Icon name="play" :size="14" /></button>
                    <button class="action-btn" :class="{ liked: userStore.isLiked(song.id) }" @click.stop="onLike(song)" title="喜欢">
                      <Icon :name="userStore.isLiked(song.id) ? 'heart-fill' : 'heart'" :size="14" />
                    </button>
                    <button class="action-btn" @click.stop="quickAdd(song)" title="添加到歌单"><Icon name="plus-circle" :size="14" /></button>
                    <button class="action-btn" @click.stop="onDownloadSong(song)" title="下载"><Icon name="download" :size="14" /></button>
                    <button v-if="isOwner" class="action-btn" @click.stop="removeSong(song)" title="移除"><Icon name="trash" :size="14" /></button>
                  </div>
                  <div class="song-duration">{{ formatDuration(song.dt) }}</div>
                </div>
              </template>
              <div v-else class="empty-state" style="padding:40px;">
                <Icon name="music" :size="32" color="var(--text-tertiary)" />
                <div class="empty-text" style="margin-top:12px;">歌单内暂无歌曲</div>
              </div>
            </div>
          </template>

          <div v-else class="empty-state">
            <Icon name="list-music" :size="48" color="var(--text-tertiary)" />
            <div class="empty-text" style="margin-top:16px;">选择一个歌单查看详情</div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showCreateDialog" class="modal-overlay" @click.self="showCreateDialog = false">
        <div class="modal" style="max-width:400px;">
          <div class="modal-header">
            <h2 class="modal-title">新建歌单</h2>
            <button class="modal-close" @click="showCreateDialog = false"><Icon name="x" :size="18" /></button>
          </div>
          <div class="modal-body">
            <div class="form-group"><label>歌单名称</label>
              <input v-model="newName" type="text" placeholder="取个好听的名字" @keydown.enter="onCreate" />
            </div>
            <div class="form-group">
              <label><input type="checkbox" v-model="newPrivacy" style="margin-right:6px;" /> 设为隐私歌单</label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="showCreateDialog = false">取消</button>
            <button class="btn btn-primary" :disabled="!newName.trim()" @click="onCreate">创建</button>
          </div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="songTransferDrag" class="song-transfer-ghost" :style="songTransferGhostStyle">
        <Icon :name="songTransferDrag.mode === 'move' ? 'move' : 'plus-circle'" :size="14" color="white" />
        <span>{{ songTransferDrag.mode === 'move' ? '移动' : '收藏' }} {{ songTransferDrag.songIds.length }} 首</span>
      </div>
    </Teleport>
    <ImageCropper v-if="cropperSrc" :imageSrc="cropperSrc" @close="cropperSrc = null" @confirm="onCropConfirm" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick, inject } from 'vue'
import { useRoute } from 'vue-router'
import { usePlayerStore } from '../stores/player'
import { useUserStore } from '../stores/user'
import { useDownloadStore } from '../stores/download'
import { usePlaylistCache } from '../composables/useCache'
import {
  getPlaylistDetail, getPlaylistAllSongs, createPlaylist,
  addSongToPlaylist, removeSongFromPlaylist, likeSong, getSongUrl,
  updatePlaylistCover, makePlaylistPublic
} from '../api'
import { slimSongs } from '../utils/slimSong'
import Icon from '../components/Icon.vue'
import ImageCropper from '../components/ImageCropper.vue'

import api from '../api'

const quickAdd = inject('quickAdd')
const collapseSidebar = inject('collapseSidebar', null)
const appSidebarCollapsed = inject('sidebarCollapsed', ref(false))
const sidebarFlipCallbacks = inject('sidebarFlipCallbacks', null)
const route = useRoute()
const playerStore = usePlayerStore()
const userStore = useUserStore()
const downloadStore = useDownloadStore()
const plCache = usePlaylistCache()
const DETAIL_INTERACTED_KEY = 'cloudmusic-playlists-detail-interacted'
const DETAIL_LAST_ID_KEY = 'cloudmusic-playlists-detail-last-id'
const DETAIL_COLLAPSED_KEY = 'cloudmusic-playlists-detail-collapsed'
const PLAYLIST_VIEW_KEY = 'cloudmusic-playlists-view'
const PLAYLIST_RECENTS_KEY = 'cloudmusic-playlists-recents'

function readSessionBool(key, fallback = false) {
  if (typeof window === 'undefined') return fallback
  return window.sessionStorage.getItem(key) === 'true'
}

function readSessionNumber(key) {
  if (typeof window === 'undefined') return null
  const value = Number(window.sessionStorage.getItem(key))
  return Number.isFinite(value) && value > 0 ? value : null
}

function readStorageJson(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeSessionValue(key, value) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(key, String(value))
}

function writeStorageValue(key, value) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

const layoutRef = ref(null)
const selectedId = ref(readSessionNumber(DETAIL_LAST_ID_KEY))
const selectedPlaylist = ref(null)
const songs = ref([])
const loadingSongs = ref(false)
const showCreateDialog = ref(false)
const newName = ref('')
const newPrivacy = ref(false)
const activePlaylistView = ref(readStorageJson(PLAYLIST_VIEW_KEY, 'mine'))
const recentPlaylistHistory = ref(readStorageJson(PLAYLIST_RECENTS_KEY, []))

// Detail panel collapse: preserved for the current app session once a playlist was opened.
const hasOpenedPlaylist = ref(readSessionBool(DETAIL_INTERACTED_KEY))
const userCollapsed = ref(readSessionBool(DETAIL_COLLAPSED_KEY))
const detailPanelRef = ref(null)
const showDetailToggle = computed(() => hasOpenedPlaylist.value && !!selectedId.value)
const isDetailCollapsed = computed(() => {
  if (!selectedId.value) return true // no playlist context → always collapsed
  return userCollapsed.value
})
function toggleDetail() {
  if (!selectedId.value) return
  const expanding = userCollapsed.value
  if (expanding) {
    // Before expanding, check if we need to collapse app sidebar for space
    let maxW = computeMaxDetailWidth()
    const desiredW = detailWidth.value || getDefaultHalf()
    if (desiredW > maxW && !appSidebarCollapsed.value && collapseSidebar) {
      collapseSidebar()
      maxW = computeMaxDetailWidth()
    }
  }
  userCollapsed.value = !userCollapsed.value
  writeSessionValue(DETAIL_COLLAPSED_KEY, userCollapsed.value)
  nextTick(() => performFlipToggle(expanding))
}



const playlistViews = [
  { key: 'mine', label: '我的歌单', description: '管理你创建的歌单', icon: 'user', emptyTitle: '还没有自己的歌单', emptyText: '从这里新建并整理你的收藏。' },
  { key: 'subscribed', label: '收藏歌单', description: '查看已收藏的歌单', icon: 'heart', emptyTitle: '还没有收藏歌单', emptyText: '去发现页挑一些喜欢的歌单吧。' },
  { key: 'recent', label: '最近常听', description: '我的与收藏歌单中的近期常用', icon: 'clock', emptyTitle: '还没有最近常听', emptyText: '播放或打开歌单后，会在这里保留常用入口。' }
]
const currentPlaylistView = computed(() => playlistViews.find(view => view.key === activePlaylistView.value) || playlistViews[0])
const allKnownPlaylists = computed(() => [...userStore.myPlaylists, ...userStore.subscribedPlaylists])
const recentPlaylists = computed(() => {
  const recentMap = new Map(recentPlaylistHistory.value.map(item => [String(item.id), item]))
  return [...allKnownPlaylists.value]
    .filter(playlist => recentMap.has(String(playlist.id)))
    .sort((a, b) => (recentMap.get(String(b.id))?.timestamp || 0) - (recentMap.get(String(a.id))?.timestamp || 0))
})
const visiblePlaylists = computed(() => {
  if (activePlaylistView.value === 'subscribed') return userStore.subscribedPlaylists
  if (activePlaylistView.value === 'recent') return recentPlaylists.value
  return userStore.myPlaylists
})

// Grid — same threshold for both states so column count only depends on width
const MIN_CARD = 135
const GRID_GAP = 12
const GRID_PADDING = 28 // sidebar-inner padding: 16 left + 12 right
const DETAIL_MIN_USABLE = 380 // min useful width for detail panel
const APP_SIDEBAR_EXPANDED = 240
const APP_SIDEBAR_COLLAPSED = 64

const gridStyle = computed(() => {
  return { gridTemplateColumns: `repeat(auto-fill, minmax(${MIN_CARD}px, 1fr))`, gap: GRID_GAP + 'px' }
})

// Compute the max detail panel width that still allows ≥2 cards per row in the grid
function computeMaxDetailWidth() {
  const appSidebarW = appSidebarCollapsed.value ? APP_SIDEBAR_COLLAPSED : APP_SIDEBAR_EXPANDED
  const totalW = window.innerWidth
  const mainW = totalW - appSidebarW
  // Grid needs: 2 cards × MIN_CARD + 1 gap + padding
  const minGridW = 2 * MIN_CARD + GRID_GAP + GRID_PADDING
  return mainW - minGridW
}

// ─── Pre-computed grid card animation ───
// Cards are taken out of grid flow (position:absolute) during the animation
// so grid reflow cannot interfere with their positions.

const ANIM_DURATION = '0.4s'
const ANIM_EASING = 'cubic-bezier(.4,0,.2,1)'

function performFlipToggle(expanding) {
  const panel = detailPanelRef.value
  const grid = playlistGridRef.value
  if (!panel || !grid) return

  const gridRect = grid.getBoundingClientRect()

  // 1. Snapshot old card rects (relative to grid)
  const oldMap = new Map()
  for (const card of grid.querySelectorAll('.pl-card[data-playlist-id]')) {
    const r = card.getBoundingClientRect()
    oldMap.set(card.dataset.playlistId, {
      left: r.left - gridRect.left,
      top: r.top - gridRect.top,
      width: r.width,
      height: r.height
    })
  }
  const oldGridH = grid.scrollHeight

  // 2. Jump panel to final size (no transition) to get final layout
  const maxW = computeMaxDetailWidth()
  const desiredW = detailWidth.value || getDefaultHalf()
  const clampedW = Math.max(DETAIL_MIN_USABLE, Math.min(desiredW, maxW))
  const finalBasis = expanding ? clampedW : 0
  const currentBasis = panel.getBoundingClientRect().width

  panel.style.transition = 'none'
  panel.style.flexBasis = finalBasis + 'px'
  panel.offsetHeight // force reflow

  const newGridRect = grid.getBoundingClientRect()
  const newMap = new Map()
  for (const card of grid.querySelectorAll('.pl-card[data-playlist-id]')) {
    const r = card.getBoundingClientRect()
    newMap.set(card.dataset.playlistId, {
      left: r.left - newGridRect.left,
      top: r.top - newGridRect.top,
      width: r.width,
      height: r.height
    })
  }
  const newGridH = grid.scrollHeight

  // 3. Classify cards
  const allIds = new Set([...oldMap.keys(), ...newMap.keys()])
  const moveCards = []   // present in both
  const appearCards = [] // only in new
  const disappearCards = [] // only in old

  for (const id of allIds) {
    const oldR = oldMap.get(id)
    const newR = newMap.get(id)
    const card = grid.querySelector(`.pl-card[data-playlist-id="${id}"]`)
    if (!card) continue
    if (oldR && newR) {
      moveCards.push({ card, oldR, newR })
    } else if (newR) {
      appearCards.push({ card, newR })
    } else if (oldR) {
      disappearCards.push({ card, oldR })
    }
  }

  // 4. Fix grid height so it doesn't collapse when children go absolute
  const fixedH = Math.max(oldGridH, newGridH)
  grid.style.height = fixedH + 'px'
  grid.style.overflow = 'hidden'

  // 5. Position ALL cards at their OLD positions with position:absolute
  // Use newR.width so cleanup doesn't cause a width snap
  for (const { card, oldR, newR } of moveCards) {
    card.style.position = 'absolute'
    card.style.left = oldR.left + 'px'
    card.style.top = oldR.top + 'px'
    card.style.width = newR.width + 'px'
    card.style.transition = 'none'
    card.style.transform = 'none'
    card.style.margin = '0'
  }
  for (const { card, newR } of appearCards) {
    card.style.position = 'absolute'
    card.style.left = newR.left + 'px'
    card.style.top = newR.top + 'px'
    card.style.width = newR.width + 'px'
    card.style.opacity = '0'
    card.style.transition = 'none'
    card.style.margin = '0'
  }
  for (const { card, oldR } of disappearCards) {
    card.style.position = 'absolute'
    card.style.left = oldR.left + 'px'
    card.style.top = oldR.top + 'px'
    card.style.width = oldR.width + 'px'
    card.style.transition = 'none'
    card.style.margin = '0'
  }

  // 6. Reset panel to initial size
  panel.style.flexBasis = currentBasis + 'px'
  panel.offsetHeight // force reflow

  // 7. Start panel transition + card animations simultaneously
  panel.style.transition = ''
  panel.style.flexBasis = finalBasis + 'px'

  const allAnimCards = []
  for (const { card, oldR, newR } of moveCards) {
    // Animate left/top via transform (translate from old to new)
    const dx = newR.left - oldR.left
    const dy = newR.top - oldR.top
    card.style.transition = `transform ${ANIM_DURATION} ${ANIM_EASING}`
    card.style.transform = `translate(${dx}px, ${dy}px)`
    allAnimCards.push(card)
  }
  for (const { card } of appearCards) {
    card.style.transition = `opacity ${ANIM_DURATION} ${ANIM_EASING}`
    card.style.opacity = '1'
    allAnimCards.push(card)
  }
  for (const { card } of disappearCards) {
    card.style.transition = `opacity ${ANIM_DURATION} ${ANIM_EASING}`
    card.style.opacity = '0'
    allAnimCards.push(card)
  }

  // 8. Cleanup after PANEL transition ends (ensures sidebar is at final width)
  let cleaned = false
  function cleanup() {
    if (cleaned) return
    cleaned = true
    // Suppress .pl-card's `transition: all` during style removal
    for (const card of allAnimCards) {
      card.style.transition = 'none'
    }
    // Remove absolute positioning — cards snap to grid instantly (no transition)
    for (const card of allAnimCards) {
      card.style.position = ''
      card.style.left = ''
      card.style.top = ''
      card.style.width = ''
      card.style.transform = ''
      card.style.opacity = ''
      card.style.margin = ''
    }
    grid.style.height = ''
    grid.style.overflow = ''
    // Force reflow so the above takes effect with transition:none
    grid.offsetHeight
    // Restore normal transitions on next frame
    requestAnimationFrame(() => {
      for (const card of allAnimCards) {
        card.style.transition = ''
      }
    })
  }

  // Wait for panel flex-basis transition to complete
  const panelHandler = (e) => {
    if (e.propertyName === 'flex-basis') {
      panel.removeEventListener('transitionend', panelHandler)
      cleanup()
    }
  }
  panel.addEventListener('transitionend', panelHandler)
  setTimeout(cleanup, 600)
}
const DETAIL_WIDTH_KEY = 'cloudmusic-playlists-detail-width'
const detailWidth = ref(readSessionNumber(DETAIL_WIDTH_KEY))
const isResizing = ref(false)

function getDefaultHalf() {
  const layout = layoutRef.value
  return layout ? Math.round(layout.getBoundingClientRect().width / 2) : 600
}

const detailPanelStyle = computed(() => {
  if (isDetailCollapsed.value) return {}
  const maxW = computeMaxDetailWidth()
  const w = detailWidth.value || getDefaultHalf()
  const clamped = Math.max(DETAIL_MIN_USABLE, Math.min(w, maxW))
  return { flexBasis: clamped + 'px' }
})

function onResizeStart(e) {
  isResizing.value = true
  const startX = e.clientX
  const panel = detailPanelRef.value
  if (!panel) return
  const startW = panel.getBoundingClientRect().width
  const maxW = computeMaxDetailWidth()

  // Calculate min width: buttons must stay at least 2 per row
  let minW = DETAIL_MIN_USABLE
  const actionBtns = panel.querySelectorAll('.detail-actions .btn')
  if (actionBtns.length >= 2) {
    const widths = [...actionBtns].map(b => b.getBoundingClientRect().width).sort((a, b) => b - a)
    const overhead = 288 + 24 // padding(64) + cover(200) + header-gap(24) + extra(24)
    minW = Math.max(minW, widths[0] + widths[1] + 12 + overhead)
  }

  function onMove(e) {
    const delta = startX - e.clientX // moving left = wider panel
    const newW = Math.max(minW, Math.min(startW + delta, maxW))
    detailWidth.value = Math.round(newW)
  }
  function onUp() {
    isResizing.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    if (detailWidth.value) writeSessionValue(DETAIL_WIDTH_KEY, detailWidth.value)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const editingName = ref(false); const editName = ref(''); const nameInputRef = ref(null)
const editingDesc = ref(false); const editDesc = ref(''); const descInputRef = ref(null)
const coverInputRef = ref(null); const cropperSrc = ref(null)
const togglingPrivacy = ref(false)
const showCoverPanel = ref(false)
const panelEditName = ref('')
const panelEditDesc = ref('')
const showDetailMenu = ref(false)
const privacyConfirmState = ref(null) // null | 'confirm' | 'done'
const dragPlIdx = ref(null); const dragSongIdx = ref(null)
const selectedPlIdxes = ref(new Set())
let plSelectionAnchor = null
const dropIndicatorStyle = ref(null)
const dropTargetPlId = ref(null)
const dropTargetSide = ref('left')
const playlistGridRef = ref(null)
const selectedSongIndexes = ref([])
const selectionAnchorIdx = ref(null)
const songTransferDrag = ref(null)
const songTransferHoverPlaylistId = ref(null)
const songTransferGhostX = ref(0)
const songTransferGhostY = ref(0)
let dragOverPlIdx = null; let dragOverSongIdx = null
let plDragging = false
let pendingSongPointer = null
let suppressPlaylistSelectionUntil = 0
const skipDetailTransition = ref(false)

// ─── Edit Mode ───
const editMode = ref(false)
const editSelection = ref(new Set())
const isEditAllSelected = computed(() => editSelection.value.size > 0 && editSelection.value.size === songs.value.length)

// ─── Play split-button dropdown ───
const showPlayMenu = ref(false)
function _closePlayMenu() { showPlayMenu.value = false }
function _closeDetailMenu() { showDetailMenu.value = false; privacyConfirmState.value = null }

function enterEditMode() {
  editMode.value = true
  editSelection.value = new Set()
  clearSongSelection()
}
function exitEditMode() {
  editMode.value = false
  editSelection.value = new Set()
}
function editToggleSelect(idx) {
  const next = new Set(editSelection.value)
  if (next.has(idx)) next.delete(idx)
  else next.add(idx)
  editSelection.value = next
}
function editToggleSelectAll() {
  if (isEditAllSelected.value) {
    editSelection.value = new Set()
  } else {
    editSelection.value = new Set(songs.value.map((_, i) => i))
  }
}
async function editRemoveSelected() {
  if (!editSelection.value.size) return
  const count = editSelection.value.size
  if (!confirm(`确定从歌单中删除选中的 ${count} 首歌曲？`)) return
  const idsToRemove = [...editSelection.value].sort((a, b) => a - b).map(i => songs.value[i]?.id).filter(Boolean)
  if (!idsToRemove.length) return
  try {
    await removeSongFromPlaylist(selectedId.value, idsToRemove.join(','))
    const removeSet = new Set(idsToRemove)
    songs.value = songs.value.filter(s => !removeSet.has(s.id))
    plCache.setSongs(selectedId.value, songs.value)
    editSelection.value = new Set()
    syncTrackCount(selectedId.value, songs.value.length)
    window.__toast?.(`已移除 ${count} 首歌曲`, 'success')
    if (!songs.value.length) exitEditMode()
  } catch { window.__toast?.('删除失败', 'error') }
}
function editAddToPlaylist() {
  if (!editSelection.value.size) return
  const selectedSongs = [...editSelection.value].sort((a, b) => a - b).map(i => songs.value[i]).filter(Boolean)
  if (!selectedSongs.length) return
  quickAdd(selectedSongs.length === 1 ? selectedSongs[0] : selectedSongs)
}

// ─── Detail panel playlist history (back/forward) ───
const detailHistory = ref([])   // array of playlist IDs
const detailHistoryIdx = ref(-1) // current position in the history
let _navFromHistory = false      // flag to prevent pushing when navigating via back/forward

const canGoDetailBack = computed(() => detailHistoryIdx.value > 0)
const canGoDetailForward = computed(() => detailHistoryIdx.value < detailHistory.value.length - 1)

function pushDetailHistory(id) {
  if (_navFromHistory) return
  const h = detailHistory.value
  const idx = detailHistoryIdx.value
  // If we're not at the end, truncate forward history
  if (idx < h.length - 1) {
    detailHistory.value = h.slice(0, idx + 1)
  }
  // Don't push duplicate of current
  if (detailHistory.value[detailHistory.value.length - 1] === id) return
  detailHistory.value.push(id)
  detailHistoryIdx.value = detailHistory.value.length - 1
}

function goDetailBack() {
  if (!canGoDetailBack.value) return
  _navFromHistory = true
  detailHistoryIdx.value--
  const id = detailHistory.value[detailHistoryIdx.value]
  loadPlaylistById(id)
  _navFromHistory = false
}

function goDetailForward() {
  if (!canGoDetailForward.value) return
  _navFromHistory = true
  detailHistoryIdx.value++
  const id = detailHistory.value[detailHistoryIdx.value]
  loadPlaylistById(id)
  _navFromHistory = false
}

const isOwner = computed(() => selectedPlaylist.value?.userId === userStore.userId)
const songTransferGhostStyle = computed(() => ({
  left: `${songTransferGhostX.value + 18}px`,
  top: `${songTransferGhostY.value + 18}px`
}))

// ─── Sidebar FLIP: smooth card repositioning when sidebar toggles ───
let _sidebarFlipOldMap = null
let _sidebarFlipOldGridH = 0

function sidebarFlipSnapshot() {
  const grid = playlistGridRef.value
  if (!grid) return
  const gridRect = grid.getBoundingClientRect()
  _sidebarFlipOldMap = new Map()
  for (const card of grid.querySelectorAll('.pl-card[data-playlist-id]')) {
    const r = card.getBoundingClientRect()
    _sidebarFlipOldMap.set(card.dataset.playlistId, {
      left: r.left - gridRect.left,
      top: r.top - gridRect.top,
      width: r.width,
      height: r.height
    })
  }
  _sidebarFlipOldGridH = grid.scrollHeight
}

function sidebarFlipAnimate() {
  const grid = playlistGridRef.value
  if (!grid || !_sidebarFlipOldMap) return
  const oldMap = _sidebarFlipOldMap
  const oldGridH = _sidebarFlipOldGridH
  _sidebarFlipOldMap = null

  const gridRect = grid.getBoundingClientRect()
  const newMap = new Map()
  for (const card of grid.querySelectorAll('.pl-card[data-playlist-id]')) {
    const r = card.getBoundingClientRect()
    newMap.set(card.dataset.playlistId, {
      left: r.left - gridRect.left,
      top: r.top - gridRect.top,
      width: r.width,
      height: r.height
    })
  }
  const newGridH = grid.scrollHeight

  // Classify cards
  const allIds = new Set([...oldMap.keys(), ...newMap.keys()])
  const moveCards = []
  const appearCards = []

  for (const id of allIds) {
    const oldR = oldMap.get(id)
    const newR = newMap.get(id)
    const card = grid.querySelector(`.pl-card[data-playlist-id="${id}"]`)
    if (!card) continue
    if (oldR && newR) {
      moveCards.push({ card, oldR, newR })
    } else if (newR) {
      appearCards.push({ card, newR })
    }
  }

  // Fix grid height
  const fixedH = Math.max(oldGridH, newGridH)
  grid.style.height = fixedH + 'px'
  grid.style.overflow = 'hidden'

  // Position cards at OLD positions
  const allAnimCards = []
  for (const { card, oldR, newR } of moveCards) {
    card.style.position = 'absolute'
    card.style.left = oldR.left + 'px'
    card.style.top = oldR.top + 'px'
    card.style.width = newR.width + 'px'
    card.style.transition = 'none'
    card.style.transform = 'none'
    card.style.margin = '0'
    allAnimCards.push(card)
  }
  for (const { card, newR } of appearCards) {
    card.style.position = 'absolute'
    card.style.left = newR.left + 'px'
    card.style.top = newR.top + 'px'
    card.style.width = newR.width + 'px'
    card.style.opacity = '0'
    card.style.transition = 'none'
    card.style.margin = '0'
    allAnimCards.push(card)
  }

  // Force reflow then animate
  grid.offsetHeight

  for (const { card, oldR, newR } of moveCards) {
    const dx = newR.left - oldR.left
    const dy = newR.top - oldR.top
    card.style.transition = `transform ${ANIM_DURATION} ${ANIM_EASING}`
    card.style.transform = `translate(${dx}px, ${dy}px)`
  }
  for (const { card } of appearCards) {
    card.style.transition = `opacity ${ANIM_DURATION} ${ANIM_EASING}`
    card.style.opacity = '1'
  }

  // Cleanup
  let cleaned = false
  function cleanup() {
    if (cleaned) return
    cleaned = true
    for (const card of allAnimCards) card.style.transition = 'none'
    for (const card of allAnimCards) {
      card.style.position = ''
      card.style.left = ''
      card.style.top = ''
      card.style.width = ''
      card.style.transform = ''
      card.style.opacity = ''
      card.style.margin = ''
    }
    grid.style.height = ''
    grid.style.overflow = ''
    grid.offsetHeight
    requestAnimationFrame(() => {
      for (const card of allAnimCards) card.style.transition = ''
    })
  }
  setTimeout(cleanup, 500)
}

const sidebarFlipCb = { snapshot: sidebarFlipSnapshot, animate: sidebarFlipAnimate }

onMounted(() => {
  sidebarFlipCallbacks?.add(sidebarFlipCb)
  document.addEventListener('click', _closePlayMenu)
  document.addEventListener('click', _closeDetailMenu)

  const routePlaylistId = Number(route.query.id)
  if (Number.isFinite(routePlaylistId) && routePlaylistId > 0) {
    // Coming from another page with a playlist id — expand instantly, no animation
    skipDetailTransition.value = true
    userCollapsed.value = false
    writeSessionValue(DETAIL_COLLAPSED_KEY, false)
    loadPlaylistById(routePlaylistId, { markInteracted: true })
    // Re-enable transitions after layout settles
    nextTick(() => {
      requestAnimationFrame(() => { skipDetailTransition.value = false })
    })
  } else if (selectedId.value) {
    loadPlaylistById(selectedId.value)
  }
  const firstPl = userStore.myPlaylists[0]
  if (firstPl) {
    plCache.preloadSongs(firstPl.id, () => getPlaylistAllSongs(firstPl.id, 200).then(r => r.songs || []))
  }
})

onUnmounted(() => {
  sidebarFlipCallbacks?.delete(sidebarFlipCb)
  teardownSongPointerTracking()
  clearSongTransferDragState()
  document.removeEventListener('click', _closePlayMenu)
  document.removeEventListener('click', _closeDetailMenu)
})

watch(selectedId, () => {
  clearSongSelection()
  teardownSongPointerTracking()
  clearSongTransferDragState()
  if (editMode.value) exitEditMode()
})

watch(() => route.query.id, (newId) => {
  const id = Number(newId)
  if (Number.isFinite(id) && id > 0) {
    // If the detail was collapsed, expand instantly without animation
    if (userCollapsed.value || !hasOpenedPlaylist.value) {
      skipDetailTransition.value = true
      userCollapsed.value = false
      writeSessionValue(DETAIL_COLLAPSED_KEY, false)
      loadPlaylistById(id, { markInteracted: true })
      nextTick(() => {
        requestAnimationFrame(() => { skipDetailTransition.value = false })
      })
    } else {
      loadPlaylistById(id, { markInteracted: true })
    }
  }
})

async function loadPlaylistById(id, options = {}) {
  const { markInteracted = false } = options
  selectedId.value = id
  pushDetailHistory(id)
  writeSessionValue(DETAIL_LAST_ID_KEY, id)
  if (markInteracted) {
    hasOpenedPlaylist.value = true
    writeSessionValue(DETAIL_INTERACTED_KEY, true)
  }
  // Try sync LRU first, then async IDB fallback
  const cachedSync = plCache.getSongsSync(id)
  if (cachedSync) { songs.value = cachedSync; loadingSongs.value = false }
  else {
    const cachedAsync = await plCache.getSongs(id)
    if (cachedAsync) { songs.value = cachedAsync; loadingSongs.value = false }
    else { loadingSongs.value = true; songs.value = [] }
  }

  try {
    const res = await getPlaylistDetail(id)
    selectedPlaylist.value = res.playlist
    if (markInteracted && selectedPlaylist.value) rememberRecentPlaylist(selectedPlaylist.value)
    const songsRes = await getPlaylistAllSongs(id, 500)
    songs.value = slimSongs(songsRes.songs || [])
    plCache.setSongs(id, songs.value)
  } catch (e) {
    console.error('Failed to load playlist:', e)
    // Keep whatever cached data we already have in songs.value
  } finally {
    loadingSongs.value = false
    syncTrackCount(id, songs.value.length)
  }
}

function selectPlaylist(pl) {
  if (Date.now() < suppressPlaylistSelectionUntil) return
  const wasCollapsed = userCollapsed.value || !hasOpenedPlaylist.value
  // Before expanding, check if we need to collapse app sidebar for space
  if (wasCollapsed) {
    let maxW = computeMaxDetailWidth()
    const desiredW = detailWidth.value || getDefaultHalf()
    if (desiredW > maxW && !appSidebarCollapsed.value && collapseSidebar) {
      collapseSidebar()
    }
  }
  hasOpenedPlaylist.value = true
  userCollapsed.value = false
  writeSessionValue(DETAIL_INTERACTED_KEY, true)
  writeSessionValue(DETAIL_COLLAPSED_KEY, false)
  rememberRecentPlaylist(pl)
  loadPlaylistById(pl.id)
  if (wasCollapsed) nextTick(() => performFlipToggle(true))
}
function playSong(song, idx) { playerStore.playSong(song, songs.value, idx) }
function playAll() { if (songs.value.length) playerStore.playSong(songs.value[0], songs.value, 0) }
function addAllToQueue() {
  showPlayMenu.value = false
  if (!songs.value.length) return
  let added = 0
  for (const song of songs.value) {
    if (!playerStore.playlist.find(s => s.id === song.id)) {
      playerStore.addToPlaylist(song)
      added++
    }
  }
  window.__toast?.(`已加入 ${added} 首到播放队列`, 'success')
}
function shufflePlay() {
  if (!songs.value.length) return
  const shuffled = [...songs.value].sort(() => Math.random() - 0.5)
  playerStore.playSong(shuffled[0], shuffled, 0); playerStore.playMode = 'random'
}

async function playPlaylistDirect(pl) {
  try {
    rememberRecentPlaylist(pl)
    window.__toast?.('正在加载歌单...', 'info')
    // Try sync LRU first, then async IDB
    let cached = plCache.getSongsSync(pl.id)
    if (!cached) cached = await plCache.getSongs(pl.id)
    if (cached?.length) { playerStore.playSong(cached[0], cached, 0); window.__toast?.(`正在播放「${pl.name}」`, 'success'); return }
    const res = await getPlaylistAllSongs(pl.id, 200)
    const s = res.songs || []
    if (s.length) { plCache.setSongs(pl.id, s); playerStore.playSong(s[0], s, 0); window.__toast?.(`正在播放「${pl.name}」`, 'success') }
  } catch { window.__toast?.('加载失败', 'error') }
}

function startEditName() { if (!isOwner.value) return; editName.value = selectedPlaylist.value.name; editingName.value = true; nextTick(() => nameInputRef.value?.focus()) }
async function saveName() { editingName.value = false; if (!editName.value.trim() || editName.value === selectedPlaylist.value.name) return; try { await api.get('/playlist/name/update', { params: { id: selectedId.value, name: editName.value.trim(), timestamp: Date.now() } }); selectedPlaylist.value.name = editName.value.trim(); userStore.fetchPlaylists(); window.__toast?.('已更新', 'success') } catch { window.__toast?.('失败', 'error') } }
function startEditDesc() { if (!isOwner.value) return; editDesc.value = selectedPlaylist.value.description || ''; editingDesc.value = true; nextTick(() => descInputRef.value?.focus()) }
async function saveDesc() { editingDesc.value = false; try { await api.get('/playlist/desc/update', { params: { id: selectedId.value, desc: editDesc.value, timestamp: Date.now() } }); selectedPlaylist.value.description = editDesc.value; window.__toast?.('已更新', 'success') } catch { window.__toast?.('失败', 'error') } }

// Cover panel edit
watch(showCoverPanel, (v) => {
  if (v && selectedPlaylist.value) {
    panelEditName.value = selectedPlaylist.value.name || ''
    panelEditDesc.value = selectedPlaylist.value.description || ''
  }
})
async function panelSaveName() {
  const name = panelEditName.value.trim()
  if (!name || name === selectedPlaylist.value.name) return
  try {
    await api.get('/playlist/name/update', { params: { id: selectedId.value, name, timestamp: Date.now() } })
    selectedPlaylist.value.name = name
    userStore.fetchPlaylists()
    window.__toast?.('名称已更新', 'success')
  } catch { window.__toast?.('更新失败', 'error') }
}
async function panelSaveDesc() {
  const desc = panelEditDesc.value
  if (desc === (selectedPlaylist.value.description || '')) return
  try {
    await api.get('/playlist/desc/update', { params: { id: selectedId.value, desc, timestamp: Date.now() } })
    selectedPlaylist.value.description = desc
    window.__toast?.('描述已更新', 'success')
  } catch { window.__toast?.('更新失败', 'error') }
}
function triggerCoverUpload() { if (!isOwner.value) return; coverInputRef.value?.click() }
function onCoverFileSelected(e) { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { cropperSrc.value = r.result }; r.readAsDataURL(f); e.target.value = '' }
async function onCropConfirm(blob) {
  cropperSrc.value = null
  if (!blob || !selectedId.value) return
  try {
    window.__toast?.('正在上传封面...', 'info')
    await updatePlaylistCover(selectedId.value, blob)
    // Refresh playlist detail to get new cover URL
    const res = await getPlaylistDetail(selectedId.value)
    if (res.playlist) {
      selectedPlaylist.value = res.playlist
    }
    await userStore.fetchPlaylists()
    window.__toast?.('封面已更新', 'success')
  } catch (e) {
    console.error('Cover upload failed:', e)
    window.__toast?.('封面上传失败', 'error')
  }
}

function isDraggingPlaylist(idx) { return plDragging && (selectedPlIdxes.value.has(idx) || dragPlIdx.value === idx) }

function onPlaylistClick(pl, plIdx, e) {
  if (Date.now() < suppressPlaylistSelectionUntil) return
  if (activePlaylistView.value === 'mine' && (e.ctrlKey || e.metaKey)) {
    // Ctrl+Click: toggle selection
    const s = new Set(selectedPlIdxes.value)
    if (s.has(plIdx)) s.delete(plIdx); else s.add(plIdx)
    selectedPlIdxes.value = s
    plSelectionAnchor = plIdx
    return
  }
  if (activePlaylistView.value === 'mine' && e.shiftKey && plSelectionAnchor !== null) {
    // Shift+Click: range select
    const s = new Set(selectedPlIdxes.value)
    const from = Math.min(plSelectionAnchor, plIdx)
    const to = Math.max(plSelectionAnchor, plIdx)
    for (let i = from; i <= to; i++) s.add(i)
    selectedPlIdxes.value = s
    return
  }
  // Normal click: clear multi-select, select this playlist
  selectedPlIdxes.value = new Set()
  plSelectionAnchor = plIdx
  selectPlaylist(pl)
}

function onDragStartPlaylist(idx, e) {
  plDragging = true
  dragPlIdx.value = idx
  // If dragged item is not in selection, start fresh
  if (!selectedPlIdxes.value.has(idx)) {
    selectedPlIdxes.value = new Set([idx])
  }
  e.dataTransfer.effectAllowed = 'move'
  // Record no-op neighbor IDs (cards adjacent to the dragged selection)
  const sortedSel = [...selectedPlIdxes.value].sort((a, b) => a - b)
  const vp = visiblePlaylists.value
  noopLeftId = sortedSel[0] > 0 ? vp[sortedSel[0] - 1]?.id : null
  noopRightId = sortedSel[sortedSel.length - 1] < vp.length - 1 ? vp[sortedSel[sortedSel.length - 1] + 1]?.id : null
  const count = selectedPlIdxes.value.size
  if (count > 1) {
    // Show drag count
    const ghost = document.createElement('div')
    ghost.textContent = `${count} 个歌单`
    ghost.style.cssText = 'position:fixed;top:-100px;padding:6px 14px;background:var(--primary,#ec4141);color:white;border-radius:8px;font-size:13px;font-weight:600;pointer-events:none;'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 30, 16)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }
}

let dragOverRaf = null
const reorderRollbackStack = []
let noopLeftId = null  // id of card originally just before dragged selection
let noopRightId = null // id of card originally just after dragged selection

function clearDropIndicator() {
  dropIndicatorStyle.value = null
  dropTargetPlId.value = null
}

function onDragOverGrid(e) {
  if (!plDragging) return
  if (dragOverRaf) return
  const cx = e.clientX, cy = e.clientY
  dragOverRaf = requestAnimationFrame(() => {
    dragOverRaf = null
    const grid = playlistGridRef.value
    if (!grid) return
    const gridRect = grid.getBoundingClientRect()
    const cards = grid.querySelectorAll('.pl-card')

    // Collect non-dragged cards with their rects
    const items = []
    for (const card of cards) {
      const idx = Number(card.dataset.plIdx)
      if (isDraggingPlaylist(idx)) continue
      const rect = card.getBoundingClientRect()
      items.push({ card, rect, id: Number(card.dataset.playlistId) })
    }
    if (!items.length) { clearDropIndicator(); return }

    // Group into rows by top position (tolerance 5px)
    const rows = []
    for (const item of items) {
      let placed = false
      for (const row of rows) {
        if (Math.abs(item.rect.top - row[0].rect.top) < 5) { row.push(item); placed = true; break }
      }
      if (!placed) rows.push([item])
    }
    // Sort rows by Y, sort items within each row by X
    rows.sort((a, b) => a[0].rect.top - b[0].rect.top)
    for (const row of rows) row.sort((a, b) => a.rect.left - b.rect.left)

    // Find the row the cursor is on
    let activeRow = null
    for (const row of rows) {
      const top = row[0].rect.top - 10
      const bottom = row[0].rect.bottom + 10
      if (cy >= top && cy <= bottom) { activeRow = row; break }
    }
    if (!activeRow) { clearDropIndicator(); return }

    // Build gap positions for this row
    // Gaps: before first card, between each pair, after last card
    const gaps = []
    for (let i = 0; i <= activeRow.length; i++) {
      let gapX
      if (i === 0) {
        // Before first card: at its left edge
        gapX = activeRow[0].rect.left
      } else if (i === activeRow.length) {
        // After last card: at its right edge
        gapX = activeRow[activeRow.length - 1].rect.right
      } else {
        // Between card[i-1] and card[i]: midpoint of gap
        gapX = (activeRow[i - 1].rect.right + activeRow[i].rect.left) / 2
      }
      // insertAfterId: the card on the left side of this gap (null if before first)
      gaps.push({
        x: gapX,
        insertAfterId: i > 0 ? activeRow[i - 1].id : null,
        insertBeforeId: i < activeRow.length ? activeRow[i].id : null
      })
    }

    // Find nearest gap to cursor
    let bestGap = gaps[0]
    let bestDist = Infinity
    for (const gap of gaps) {
      const d = Math.abs(cx - gap.x)
      if (d < bestDist) { bestDist = d; bestGap = gap }
    }

    // Suppress indicator if this gap is the dragged card's original position (no-op)
    const isNoopGap = bestGap.insertAfterId === noopLeftId && bestGap.insertBeforeId === noopRightId
    if (isNoopGap) { clearDropIndicator(); return }

    const lineX = bestGap.x - gridRect.left
    const rowRect = activeRow[0].rect

    dropIndicatorStyle.value = {
      left: lineX + 'px',
      top: (rowRect.top - gridRect.top) + 'px',
      height: rowRect.height + 'px'
    }
    // For insert logic: if we have an insertAfterId, insert after that card; else insert before insertBeforeId
    if (bestGap.insertAfterId !== null) {
      dropTargetPlId.value = bestGap.insertAfterId
      dropTargetSide.value = 'right'
    } else {
      dropTargetPlId.value = bestGap.insertBeforeId
      dropTargetSide.value = 'left'
    }
  })
}

function onDragEndPlaylist() {
  plDragging = false
  dragPlIdx.value = null
  clearDropIndicator()
  if (dragOverRaf) { cancelAnimationFrame(dragOverRaf); dragOverRaf = null }
}

async function onDropPlaylist() {
  if (!plDragging || dropTargetPlId.value === null) { onDragEndPlaylist(); return }

  const selected = [...selectedPlIdxes.value].sort((a, b) => a - b)
  if (!selected.length) { onDragEndPlaylist(); return }

  const myPls = userStore.myPlaylists
  const movedItems = selected.map(i => myPls[i])
  const movedIds = new Set(movedItems.map(p => p.id))
  const targetId = dropTargetPlId.value
  const insertAfter = dropTargetSide.value === 'right'

  // Save rollback snapshot BEFORE modifying
  reorderRollbackStack.push([...userStore.playlists])

  // Build new myPlaylists order
  const remaining = myPls.filter(p => !movedIds.has(p.id))
  const targetInRemaining = remaining.findIndex(p => p.id === targetId)
  if (targetInRemaining < 0) { reorderRollbackStack.pop(); onDragEndPlaylist(); return }
  const insertPos = insertAfter ? targetInRemaining + 1 : targetInRemaining
  remaining.splice(insertPos, 0, ...movedItems)

  // Optimistic update: rebuild full playlists array (subscribed playlists stay in place)
  const subscribedPls = userStore.playlists.filter(p => p.userId !== userStore.userId)
  userStore.playlists = [...remaining, ...subscribedPls]

  selectedPlIdxes.value = new Set()
  onDragEndPlaylist()

  // API call in background
  try {
    await api.get('/playlist/order/update', { params: { ids: JSON.stringify(remaining.map(p => p.id)), timestamp: Date.now() } })
    // Success: remove rollback entry (no longer needed)
    // Find and remove the entry we pushed (it's the most recent one for this operation)
    // Don't pop — a newer operation may have pushed after us. Just leave it; stack entries are harmless.
  } catch {
    window.__toast?.('排序失败，已回退', 'error')
    // Pop the most recent snapshot and restore
    const snapshot = reorderRollbackStack.pop()
    if (snapshot) userStore.playlists = snapshot
  }
}
function onDragStartSong(idx, e) { dragSongIdx.value = idx; e.dataTransfer.effectAllowed = 'move' }
function onDragOverSong(idx) { dragOverSongIdx = idx }
async function onDropSong(targetIdx) {
  if (dragSongIdx.value === null || targetIdx === dragSongIdx.value) return
  const [moved] = songs.value.splice(dragSongIdx.value, 1); songs.value.splice(targetIdx, 0, moved)
  plCache.setSongs(selectedId.value, songs.value)
  clearSongSelection()
  if (isOwner.value) { try { await api.get('/song/order/update', { params: { pid: selectedId.value, ids: JSON.stringify(songs.value.map(s => s.id)), timestamp: Date.now() } }) } catch {} }
  dragSongIdx.value = null; dragOverSongIdx = null
}

async function onCreate() { if (!newName.value.trim()) return; try { await createPlaylist(newName.value.trim(), newPrivacy.value); userStore.fetchPlaylists(); showCreateDialog.value = false; newName.value = ''; newPrivacy.value = false; window.__toast?.('创建成功', 'success') } catch { window.__toast?.('创建失败', 'error') } }
async function removeSong(song) { try { await removeSongFromPlaylist(selectedId.value, song.id); songs.value = songs.value.filter(s => s.id !== song.id); plCache.setSongs(selectedId.value, songs.value); clearSongSelection(); syncTrackCount(selectedId.value, songs.value.length); window.__toast?.('已移除', 'success') } catch { window.__toast?.('失败', 'error') } }
async function copyShareLink() {
  const url = `https://music.163.com/playlist?id=${selectedId.value}`
  try {
    await navigator.clipboard.writeText(url)
    window.__toast?.('链接已复制到剪贴板', 'success')
  } catch {
    window.__toast?.(url, 'info')
  }
}

async function confirmMakePublic() {
  if (togglingPrivacy.value) return
  togglingPrivacy.value = true
  try {
    await makePlaylistPublic(selectedId.value)
    selectedPlaylist.value.privacy = 0
    // Sync left sidebar lock icon
    const pl = userStore.playlists.find(p => p.id === selectedId.value)
    if (pl) pl.privacy = 0
    privacyConfirmState.value = 'done'
    // Animate away then close menu
    setTimeout(() => {
      showDetailMenu.value = false
      privacyConfirmState.value = null
    }, 1500)
  } catch { window.__toast?.('操作失败', 'error'); privacyConfirmState.value = null }
  finally { togglingPrivacy.value = false }
}
function syncTrackCount(pid, count) {
  const pl = userStore.playlists.find(p => p.id === pid)
  if (pl) pl.trackCount = count
}
async function togglePlaylistPrivacy() {
  if (!isOwner.value || !selectedPlaylist.value || togglingPrivacy.value) return
  togglingPrivacy.value = true
  try {
    await makePlaylistPublic(selectedId.value)
    selectedPlaylist.value.privacy = 0
    userStore.fetchPlaylists()
    window.__toast?.('歌单已公开', 'success')
  } catch { window.__toast?.('操作失败', 'error') }
  finally { togglingPrivacy.value = false }
}
async function onLike(song) { if (!userStore.isLoggedIn) { userStore.showLoginModal = true; return }; try { const like = !userStore.isLiked(song.id); await likeSong(song.id, like); userStore.fetchLikeList(); window.__toast?.(like ? '已喜欢' : '已取消', 'success') } catch { window.__toast?.('失败', 'error') } }
async function onDownloadSong(song) { const added = downloadStore.addToQueue(song); if (!added) { window.__toast?.('已在列表中', 'info'); return }; window.__toast?.('已添加', 'success'); try { const u = await getSongUrl(song.id, JSON.parse(localStorage.getItem('cloudmusic-settings')||'{}').downloadQuality||'exhigh'); const d = u.data?.[0]; if (d?.url) { downloadStore.updateProgress(song.id,50,'downloading'); setTimeout(()=>downloadStore.completeDownload(song.id,d.url),1500) } } catch { downloadStore.updateProgress(song.id,0,'error') } }
function downloadAll() { let c=0; for (const s of songs.value) { if (downloadStore.addToQueue(s)) c++ }; window.__toast?.(`已添加 ${c} 首`, 'success') }
function formatArtists(song) { return song.ar?.map(a => a.name).join(', ') || '' }
function formatDuration(ms) { if (!ms) return ''; return `${Math.floor(ms/60000)}:${Math.floor((ms%60000)/1000).toString().padStart(2,'0')}` }
function formatCount(n) { if (!n) return '0'; if (n>=1e8) return (n/1e8).toFixed(1)+'亿'; if (n>=1e4) return (n/1e4).toFixed(1)+'万'; return String(n) }
function setActivePlaylistView(viewKey) {
  activePlaylistView.value = viewKey
  writeStorageValue(PLAYLIST_VIEW_KEY, viewKey)
}
function rememberRecentPlaylist(playlist) {
  const timestamp = Date.now()
  const nextHistory = [
    { id: playlist.id, timestamp },
    ...recentPlaylistHistory.value.filter(item => item.id !== playlist.id)
  ].slice(0, 12)
  recentPlaylistHistory.value = nextHistory
  writeStorageValue(PLAYLIST_RECENTS_KEY, nextHistory)
}
function playlistSourceIcon(playlist) {
  if (userStore.myPlaylists.some(item => item.id === playlist.id)) return 'user'
  return 'heart'
}
function normalizeSongIndexes(indexes) {
  return [...new Set(indexes)]
    .filter(index => Number.isInteger(index) && index >= 0 && index < songs.value.length)
    .sort((a, b) => a - b)
}
function clearSongSelection() {
  selectedSongIndexes.value = []
  selectionAnchorIdx.value = null
}
function setSongSelection(indexes, anchorIdx = null) {
  selectedSongIndexes.value = normalizeSongIndexes(indexes)
  if (anchorIdx !== null) selectionAnchorIdx.value = anchorIdx
}
function isSongSelected(idx) {
  return selectedSongIndexes.value.includes(idx)
}
function isSongTransferSource(idx) {
  return !!songTransferDrag.value?.songIndexes.includes(idx)
}
function getSongIndexesForDrag(idx) {
  return isSongSelected(idx) ? [...selectedSongIndexes.value] : [idx]
}
function getSongIdsByIndexes(indexes) {
  return normalizeSongIndexes(indexes)
    .map(index => songs.value[index]?.id)
    .filter(id => Number.isFinite(Number(id)))
}
function isSongInteractiveTarget(target) {
  return target instanceof Element && !!target.closest('button, a, input, textarea, .song-drag-handle')
}
function onSongRowClick(idx, event) {
  if (isSongInteractiveTarget(event.target)) return
  if (event.shiftKey) {
    const anchor = selectionAnchorIdx.value ?? idx
    const start = Math.min(anchor, idx)
    const end = Math.max(anchor, idx)
    setSongSelection(Array.from({ length: end - start + 1 }, (_, offset) => start + offset), anchor)
    return
  }
  if (event.metaKey || event.ctrlKey) {
    const nextSelection = new Set(selectedSongIndexes.value)
    if (nextSelection.has(idx)) nextSelection.delete(idx)
    else nextSelection.add(idx)
    setSongSelection([...nextSelection], idx)
    return
  }
  setSongSelection([idx], idx)
}
function onSongPointerDown(idx, event) {
  if ((event.button !== 0 && event.button !== 2) || isSongInteractiveTarget(event.target)) return
  if (event.shiftKey || event.metaKey || event.ctrlKey) return
  pendingSongPointer = {
    button: event.button,
    idx,
    startX: event.clientX,
    startY: event.clientY
  }
  if (event.button === 2) event.preventDefault()
  window.addEventListener('mousemove', onSongPointerMove)
  window.addEventListener('mouseup', onSongPointerUp)
  window.addEventListener('contextmenu', preventSongPointerContextMenu, true)
}
function preventSongPointerContextMenu(event) {
  if (pendingSongPointer || songTransferDrag.value) event.preventDefault()
}
function teardownSongPointerTracking() {
  pendingSongPointer = null
  window.removeEventListener('mousemove', onSongPointerMove)
  window.removeEventListener('mouseup', onSongPointerUp)
  setTimeout(() => window.removeEventListener('contextmenu', preventSongPointerContextMenu, true), 0)
}
function clearSongTransferDragState() {
  songTransferDrag.value = null
  songTransferHoverPlaylistId.value = null
  document.body.classList.remove('song-transfer-dragging')
}
function onSongPointerMove(event) {
  if (!pendingSongPointer) return
  const distance = Math.hypot(event.clientX - pendingSongPointer.startX, event.clientY - pendingSongPointer.startY)
  if (!songTransferDrag.value) {
    if (distance < 6) return
    const songIndexes = normalizeSongIndexes(getSongIndexesForDrag(pendingSongPointer.idx))
    if (!isSongSelected(pendingSongPointer.idx) || songIndexes.length === 1) {
      setSongSelection(songIndexes, pendingSongPointer.idx)
    }
    songTransferDrag.value = {
      mode: pendingSongPointer.button === 2 ? 'move' : 'copy',
      sourcePlaylistId: selectedId.value,
      songIndexes,
      songIds: getSongIdsByIndexes(songIndexes)
    }
    document.body.classList.add('song-transfer-dragging')
  }
  songTransferGhostX.value = event.clientX
  songTransferGhostY.value = event.clientY
  updateSongTransferHover(event.clientX, event.clientY)
}
function updateSongTransferHover(clientX, clientY) {
  const hoverTarget = document.elementFromPoint(clientX, clientY)
  const playlistCard = hoverTarget instanceof Element ? hoverTarget.closest('.pl-card') : null
  if (!playlistCard) {
    songTransferHoverPlaylistId.value = null
    return
  }
  const playlistId = Number(playlistCard.dataset.playlistId)
  const playlist = visiblePlaylists.value.find(item => item.id === playlistId) || allKnownPlaylists.value.find(item => item.id === playlistId)
  songTransferHoverPlaylistId.value = canAcceptSongTransfer(playlist, songTransferDrag.value?.mode) ? playlistId : null
}
function canAcceptSongTransfer(playlist, mode = songTransferDrag.value?.mode) {
  if (!playlist || !selectedId.value) return false
  if (playlist.userId !== userStore.userId) return false
  if (playlist.id === selectedId.value) return false
  if (mode === 'move' && !isOwner.value) return false
  return true
}
async function onSongPointerUp() {
  const dragState = songTransferDrag.value
  const targetPlaylistId = songTransferHoverPlaylistId.value
  teardownSongPointerTracking()
  clearSongTransferDragState()
  if (!dragState) return
  suppressPlaylistSelectionUntil = Date.now() + 250
  const targetPlaylist = visiblePlaylists.value.find(item => item.id === targetPlaylistId) || allKnownPlaylists.value.find(item => item.id === targetPlaylistId)
  if (!targetPlaylist) return
  await transferSongsToPlaylist(targetPlaylist, dragState)
}
async function transferSongsToPlaylist(targetPlaylist, dragState) {
  if (!dragState.songIds.length) return
  if (!userStore.isLoggedIn) {
    userStore.showLoginModal = true
    return
  }
  if (targetPlaylist.userId !== userStore.userId) {
    window.__toast?.('只能拖到你自己的歌单', 'info')
    return
  }
  if (targetPlaylist.id === dragState.sourcePlaylistId) {
    window.__toast?.('目标歌单与当前歌单相同', 'info')
    return
  }
  if (dragState.mode === 'move' && !isOwner.value) {
    window.__toast?.('右键拖拽移动仅支持自己的歌单', 'info')
    return
  }
  const trackIds = dragState.songIds.join(',')
  try {
    await addSongToPlaylist(targetPlaylist.id, trackIds)
    if (dragState.mode === 'move') {
      await removeSongFromPlaylist(dragState.sourcePlaylistId, trackIds)
      const removedIndexes = new Set(dragState.songIndexes)
      songs.value = songs.value.filter((_, index) => !removedIndexes.has(index))
      plCache.setSongs(dragState.sourcePlaylistId, songs.value)
    }
    clearSongSelection()
    await userStore.fetchPlaylists()
    window.__toast?.(`已${dragState.mode === 'move' ? '移动' : '收藏'} ${dragState.songIds.length} 首到「${targetPlaylist.name}」`, 'success')
  } catch (error) {
    console.error('Failed to transfer songs:', error)
    window.__toast?.(`${dragState.mode === 'move' ? '移动' : '收藏'}失败`, 'error')
  }
}
</script>

<style scoped>
.page.playlists-page {
  padding: 0;
  min-height: 100%;
  height: 100%;
  overflow: hidden;
}
.playlists-layout {
  display: flex; height: 100%;
  position: relative; overflow: hidden;
}

/* ── Sidebar ── */
.playlists-sidebar {
  flex: 1;
  min-width: 280px;
  overflow-y: auto; padding: 0;
  scroll-behavior: smooth;
  scrollbar-gutter: stable;
}
.playlists-sidebar-inner {
  min-height: 100%;
  padding: 16px 12px 19px 16px;
}
.playlists-sidebar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.playlists-sidebar-header h2 { font-size: var(--font-base); font-weight: 700; }
.playlists-sidebar-subtitle { font-size: var(--font-xs); color: var(--text-tertiary); margin-top: 4px; }
.playlists-sidebar-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.playlists-sidebar-meta { font-size: var(--font-xs); color: var(--text-tertiary); }
.playlist-view-switch { display: inline-flex; align-items: center; gap: 6px; padding: 4px; border-radius: 999px; background: var(--bg-card); border: 1px solid var(--border); }
.playlist-view-btn { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); transition: all var(--transition-fast); }
.playlist-view-btn:hover { color: var(--text-primary); background: var(--bg-hover); }
.playlist-view-btn.active { color: white; background: var(--primary); box-shadow: var(--shadow-glow); }

.playlists-grid { display: grid; position: relative; }

/* ── Portrait card: square cover on top + info section below ── */
.pl-card {
  cursor: pointer; border-radius: var(--radius-lg); transition: all var(--transition-fast);
  position: relative; background: var(--bg-card); overflow: hidden;
  border: 1px solid transparent;
}
.pl-card:hover {
  border-color: var(--glass-border); transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.pl-card.song-drop-target {
  border-color: var(--primary);
  transform: translateY(-4px);
  box-shadow: 0 0 0 1px var(--primary), 0 0 0 4px rgba(236,65,65,0.16), var(--shadow-glow);
}
.pl-card.dragging { opacity: 0.4; }
.pl-card-badge {
  position: absolute; top: 8px; left: 8px; z-index: 3;
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: white; background: rgba(0,0,0,0.48); backdrop-filter: blur(8px);
}
.pl-card-cover-wrap { position: relative; overflow: hidden; }
.pl-card-cover-wrap:hover .pl-card-play { opacity: 1; }
.pl-card-cover {
  width: 100%; aspect-ratio: 1;
  object-fit: cover; display: block;
  transition: transform var(--transition-slow);
}
.pl-card:hover .pl-card-cover { transform: scale(1.05); }
.pl-card.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary), var(--shadow-glow);
}
.pl-card.pl-selected {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary), 0 0 8px rgba(236,65,65,0.15);
}
.pl-card.dragging { opacity: 0.35; }
.drop-indicator {
  position: absolute; width: 3px; border-radius: 3px;
  background: linear-gradient(180deg, transparent, var(--primary) 15%, var(--primary) 85%, transparent);
  z-index: 20; pointer-events: none;
  transform: translateX(-1.5px);
}
.drop-dot {
  position: absolute; left: 50%; width: 9px; height: 9px;
  border-radius: 50%; background: var(--primary);
  transform: translateX(-50%);
  box-shadow: 0 0 6px rgba(236,65,65,0.7);
}
.drop-dot.top { top: -3px; }
.drop-dot.bottom { bottom: -3px; }
.pl-card-play {
  position: absolute; bottom: 8px; right: 8px;
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--primary); color: white; display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity var(--transition-fast), transform var(--transition-fast);
  box-shadow: 0 2px 8px rgba(0,0,0,0.3); cursor: pointer; z-index: 2;
}
.pl-card-play:hover { transform: scale(1.1); }
.pl-card-lock {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.25); backdrop-filter: blur(2px);
  z-index: 1; pointer-events: none;
}
.pl-card-info {
  padding: 10px 10px 12px;
}
.pl-card-name {
  font-size: var(--font-sm); font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  line-height: 1.4;
}
.pl-card-count {
  font-size: var(--font-xs); color: var(--text-tertiary); margin-top: 2px;
}
.playlist-tab-empty {
  min-height: 180px; border: 1px dashed var(--border); border-radius: var(--radius-lg);
  background: rgba(255,255,255,0.02);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; text-align: center; color: var(--text-tertiary); padding: 20px;
}
.playlist-tab-empty-title { font-size: var(--font-sm); font-weight: 600; color: var(--text-secondary); }
.playlist-tab-empty-text { font-size: var(--font-xs); max-width: 260px; line-height: 1.6; }

/* ── Toggle button wrapper — zero-width flex item at sidebar/detail boundary ── */
.toggle-wrapper {
  flex: 0 0 0px;
  position: relative;
  z-index: 30;
}
.detail-panel-toggle {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 74px;
  background: linear-gradient(180deg, rgba(236,65,65,0.98), rgba(198,40,40,0.98));
  border: none;
  border-radius: 12px 0 0 12px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: width 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease;
  box-shadow: -8px 12px 28px rgba(236,65,65,0.28);
  color: white;
  padding: 0;
  overflow: hidden;
}
.detail-panel-toggle:hover,
.detail-panel-toggle:focus-visible {
  width: 32px;
  filter: brightness(1.08);
  box-shadow: -12px 18px 36px rgba(236,65,65,0.35);
}
.detail-panel-toggle.collapsed {
  justify-content: flex-start;
  padding-left: 6px;
}
.detail-panel-toggle:focus-visible {
  outline: none;
}

/* ── Detail panel — flex child, expands from right ── */
.playlist-detail {
  flex: 0 0 0%;
  overflow: hidden;
  background: var(--bg-secondary);
  border-left: 1px solid transparent;
  transition: flex-basis 0.4s cubic-bezier(.4,0,.2,1),
              border-color 0.4s ease,
              box-shadow 0.4s ease;
  scroll-behavior: smooth;
  z-index: 20;
  box-shadow: none;
  position: relative;
}
.playlist-detail.no-transition {
  transition: none !important;
}
.playlist-detail.no-transition .detail-inner {
  transition: none !important;
}
.playlist-detail.open {
  flex-basis: 50%;
  overflow-y: auto;
  border-left-color: var(--divider);
  box-shadow: -4px 0 24px rgba(0,0,0,0.3);
}

/* ── Resize handle ── */
.resize-handle {
  position: absolute; left: 0; top: 0; bottom: 0;
  width: 5px; cursor: col-resize; z-index: 30;
  background: transparent;
  transition: background 0.2s ease;
}
.resize-handle:hover,
.resize-handle:active {
  background: var(--primary);
  opacity: 0.5;
}

.detail-inner {
  padding: 24px 32px 27px; min-width: 400px;
  opacity: 0; pointer-events: none;
  transition: opacity 0.15s ease;
}
.detail-songs {
  scroll-behavior: smooth;
}
.playlist-detail.open .detail-inner {
  opacity: 1; pointer-events: auto;
  transition: opacity 0.3s ease 0.15s;
}

/* ── Detail nav bar (back/forward) ── */
.detail-nav-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
}
.detail-nav-btn {
  width: 28px; height: 28px;
  border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: transparent;
}
.detail-nav-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.detail-nav-btn:disabled {
  opacity: 0.25;
  cursor: default;
}

/* ── Edit mode ── */
.edit-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin: -12px -12px 12px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  flex-wrap: wrap;
}
.edit-select-all {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  color: var(--text-secondary);
  font-weight: 500;
}
.edit-select-all input[type="checkbox"] {
  width: 16px; height: 16px;
  accent-color: var(--primary);
  cursor: pointer;
}
.edit-count {
  color: var(--text-tertiary);
  font-size: var(--font-xs);
}
.edit-toolbar-spacer {
  flex: 1;
}
.edit-delete-btn {
  color: var(--danger, #ef4444) !important;
}
.edit-delete-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1) !important;
}
.edit-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  flex-shrink: 0;
}
.edit-checkbox input[type="checkbox"] {
  width: 16px; height: 16px;
  accent-color: var(--primary);
  cursor: pointer;
}
.song-item.edit-mode {
  cursor: pointer;
}
.song-item.edit-mode.selected {
  background: rgba(236, 65, 65, 0.08);
}

.detail-header { display: flex; gap: 24px; margin-bottom: 24px; }

/* ── Play split button ── */
.play-split-btn {
  display: inline-flex;
  align-items: stretch;
  border-radius: var(--radius-md);
  overflow: visible;
  position: relative;
}
.play-split-main {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px;
  background: var(--primary);
  color: white;
  font-weight: 600;
  font-size: var(--font-sm);
  border-radius: var(--radius-md) 0 0 var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.play-split-main:hover { background: var(--primary-dark, #d63636); }
.play-split-more {
  display: flex; align-items: center; justify-content: center;
  width: 32px;
  background: var(--primary);
  border-left: 1px solid rgba(255,255,255,0.25);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.play-split-more:hover { background: var(--primary-dark, #d63636); }
.play-split-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 160px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  z-index: 100;
}
.play-split-dropdown-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%;
  padding: 8px 12px;
  font-size: var(--font-sm);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
  white-space: nowrap;
}
.play-split-dropdown-item:hover {
  background: var(--bg-hover);
}
.dropdown-fade-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.dropdown-fade-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.dropdown-fade-enter-from { opacity: 0; transform: translateY(-4px); }
.dropdown-fade-leave-to { opacity: 0; transform: translateY(-4px); }
.detail-cover-wrap { position: relative; cursor: pointer; flex-shrink: 0; }
.detail-cover { width: 200px; height: 200px; border-radius: var(--radius-lg); object-fit: cover; box-shadow: var(--shadow-md); transition: transform var(--transition-fast), box-shadow var(--transition-fast); }
.detail-cover-wrap:hover .detail-cover { transform: scale(1.03); box-shadow: var(--shadow-lg); }
.detail-info { flex: 1; display: flex; flex-direction: column; justify-content: center; min-width: 0; }
.detail-name { font-size: var(--font-2xl); font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
.detail-name.editable { cursor: pointer; }
.detail-name.editable:hover .edit-hint { opacity: 1; }
.edit-hint { opacity: 0; transition: opacity var(--transition-fast); }
.detail-name-edit input { font-size: var(--font-2xl); font-weight: 700; width: 100%; background: var(--bg-tertiary); margin-bottom: 8px; padding: 4px 8px; }
.detail-desc { font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.detail-desc.editable { cursor: pointer; }
.detail-desc.editable:hover { color: var(--text-primary); }
.detail-desc-edit textarea { width: 100%; background: var(--bg-tertiary); font-size: var(--font-sm); margin-bottom: 12px; resize: vertical; }
.detail-meta { font-size: var(--font-sm); color: var(--text-tertiary); margin-bottom: 16px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.privacy-badge {
  display: inline-flex; align-items: center; gap: 4px;
  margin-left: 4px; padding: 2px 8px; border-radius: 999px;
  background: rgba(245, 158, 11, 0.12); color: var(--warning, #f59e0b);
  font-size: var(--font-xs); font-weight: 500;
}
.detail-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

/* ── Detail more menu ── */
.detail-more-menu {
  position: relative;
}
.detail-more-trigger {
  padding: 8px !important;
  min-width: unset !important;
}
.detail-more-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 160px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  z-index: 100;
}
.detail-more-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%;
  padding: 8px 12px;
  font-size: var(--font-sm);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
  white-space: nowrap;
}
.detail-more-item:hover {
  background: var(--bg-hover);
}
.detail-more-item.privacy-confirm {
  color: var(--warning, #f59e0b);
  font-weight: 600;
}
.detail-more-item.privacy-done {
  color: var(--success, #22c55e);
  font-weight: 600;
  cursor: default;
  animation: privacy-fade 1.5s ease forwards;
}
@keyframes privacy-fade {
  0%, 60% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-4px); }
}

/* ── Cover info panel ── */
.cover-panel-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000;
}
.cover-panel {
  background: var(--bg-card);
  border-radius: 20px;
  max-width: 620px;
  width: 92vw;
  position: relative;
  overflow: hidden;
  box-shadow: 0 30px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06);
}
/* Blurred cover background header */
.cover-panel-bg {
  position: absolute; top: 0; left: 0; right: 0;
  height: 90px;
  background-size: cover; background-position: center;
  filter: blur(40px) saturate(1.2) brightness(0.4);
  transform: scale(1.4);
  opacity: 0.35;
  pointer-events: none;
}
.cover-panel-close {
  position: absolute; top: 14px; right: 14px;
  width: 30px; height: 30px;
  border-radius: var(--radius-full);
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.8);
  cursor: pointer;
  transition: all var(--transition-fast);
  z-index: 2;
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(8px);
}
.cover-panel-close:hover {
  background: rgba(255,255,255,0.2);
  color: white;
}
.cover-panel-body {
  display: flex; gap: 28px;
  padding: 28px;
  position: relative;
  z-index: 1;
}
.cover-panel-left {
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  flex-shrink: 0;
}
.cover-panel-img-wrap {
  position: relative;
  border-radius: 14px;
  overflow: visible;
}
.cover-panel-img-wrap::after {
  content: '';
  position: absolute;
  inset: 8px;
  border-radius: 14px;
  background: inherit;
  filter: blur(20px) saturate(1.5);
  opacity: 0.4;
  z-index: -1;
  transform: translateY(12px);
}
.cover-panel-img {
  width: 220px; height: 220px;
  border-radius: 14px;
  object-fit: cover;
  display: block;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  transition: transform 0.3s ease;
}
.cover-panel-img:hover {
  transform: scale(1.02);
}
.cover-panel-change-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%;
  padding: 8px 0;
  font-size: var(--font-xs);
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: var(--bg-tertiary);
  border: 1px solid transparent;
}
.cover-panel-change-btn:hover {
  color: var(--text-primary);
  border-color: var(--border);
  background: var(--bg-hover);
}
.cover-panel-right {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 10px;
  padding-top: 12px;
}
.cover-panel-name {
  font-size: 20px; font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.01em;
}
.cover-panel-name-input {
  font-size: 20px; font-weight: 700;
  width: 100%;
  background: transparent;
  border: none; border-bottom: 2px solid transparent;
  border-radius: 6px;
  padding: 6px 8px;
  color: var(--text-primary);
  transition: all 0.2s ease;
  letter-spacing: -0.01em;
}
.cover-panel-name-input:hover {
  background: rgba(255,255,255,0.04);
}
.cover-panel-name-input:focus {
  outline: none;
  background: rgba(255,255,255,0.06);
  border-bottom-color: var(--primary);
}
.cover-panel-name-input::placeholder {
  color: var(--text-tertiary);
  font-weight: 400;
}
.cover-panel-desc {
  font-size: var(--font-sm); color: var(--text-secondary);
  line-height: 1.7;
  flex: 1;
}
.cover-panel-desc-input {
  width: 100%;
  background: transparent;
  border: none; border-left: 2px solid transparent;
  border-radius: 0;
  padding: 8px 10px;
  font-size: var(--font-sm);
  color: var(--text-primary);
  resize: none;
  min-height: 72px;
  line-height: 1.7;
  transition: all 0.2s ease;
}
.cover-panel-desc-input:hover {
  background: rgba(255,255,255,0.03);
}
.cover-panel-desc-input:focus {
  outline: none;
  border-left-color: var(--primary);
  background: rgba(255,255,255,0.05);
}
.cover-panel-desc-input::placeholder {
  color: var(--text-tertiary);
}
.cover-panel-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
  opacity: 0.6;
}
.cover-panel-footer {
  display: flex; justify-content: space-between; align-items: center;
}
.cover-panel-meta {
  font-size: var(--font-xs); color: var(--text-tertiary);
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.cover-panel-meta span {
  display: flex; align-items: center; gap: 3px;
}
.cover-panel-privacy {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.1);
  color: var(--warning, #f59e0b);
  font-size: 10px;
}
.cover-panel-creator {
  font-size: var(--font-xs); color: var(--text-tertiary);
  text-align: right;
}
.cover-panel-enter-active { transition: opacity 0.25s ease; }
.cover-panel-enter-active .cover-panel { transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.cover-panel-leave-active { transition: opacity 0.15s ease; }
.cover-panel-leave-active .cover-panel { transition: transform 0.15s ease; }
.cover-panel-enter-from { opacity: 0; }
.cover-panel-enter-from .cover-panel { transform: scale(0.92) translateY(10px); }
.cover-panel-leave-to { opacity: 0; }
.cover-panel-leave-to .cover-panel { transform: scale(0.96); }
.song-drag-handle { cursor: grab; opacity: 0; transition: opacity var(--transition-fast); flex-shrink: 0; width: 20px; display: flex; align-items: center; justify-content: center; }
.song-drag-handle:active { cursor: grabbing; }
.song-item:hover .song-drag-handle { opacity: 1; }
.song-item.selected {
  background: rgba(236,65,65,0.12);
  box-shadow: inset 0 0 0 1px rgba(236,65,65,0.28);
}
.song-item.dragging { opacity: 0.4; background: var(--bg-active); }
.song-item.transfer-source {
  background: rgba(236,65,65,0.14);
  opacity: 0.7;
}
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: var(--font-sm); font-weight: 500; color: var(--text-secondary); margin-bottom: 6px; }
.form-group input[type="text"] { width: 100%; }
</style>

<!-- Global styles for teleported elements -->
<style>
.song-transfer-ghost {
  position: fixed;
  z-index: 10000;
  pointer-events: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 999px;
  background: rgba(18, 18, 22, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.32);
  color: white;
  font-size: var(--font-xs);
  font-weight: 600;
  backdrop-filter: blur(12px);
}
body.song-transfer-dragging {
  user-select: none;
  cursor: grabbing;
}
</style>
