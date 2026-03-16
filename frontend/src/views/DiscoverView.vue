<template>
  <div class="page" @click="showHotSearch = false">
    <!-- Search bar -->
    <div class="discover-search">
      <div class="search-wrapper" @click.stop>
        <Icon name="search" :size="16" color="var(--text-tertiary)" class="search-svg-icon" />
        <input v-model="searchQuery" type="text" :placeholder="searchPlaceholder"
          @keydown.enter="doSearch" @focus.stop="onSearchFocus" @input="onSearchInput" class="search-input" />
        <button v-if="searchQuery" class="search-clear" @click="clearSearch"><Icon name="x" :size="14" /></button>
      </div>
      <!-- Hot search (when focused, no query) -->
      <div v-if="showHotSearch && !searchQuery && hotSearches.length" class="hot-search-dropdown" @click.stop>
        <h4>热门搜索</h4>
        <div class="hot-tags">
          <span v-for="(item, idx) in hotSearches.slice(0, 12)" :key="idx" class="tag"
            @click="searchQuery = item.searchWord; doSearch(); showHotSearch = false">
            <span class="hot-rank" :class="{ top: idx < 3 }">{{ idx + 1 }}</span>
            {{ item.searchWord }}
          </span>
        </div>
      </div>
      <!-- Search suggestions (when typing) -->
      <div v-if="searchQuery && suggestVisible && (suggestions.songs?.length || suggestions.artists?.length || suggestions.albums?.length || suggestions.playlists?.length)" class="suggest-dropdown" @click.stop>
        <div v-if="suggestions.artists?.length" class="suggest-group">
          <div class="suggest-group-title">歌手</div>
          <div v-for="a in suggestions.artists.slice(0, 4)" :key="a.id" class="suggest-item" @click="searchQuery = a.name; doSearch(); suggestVisible = false">
            <img v-if="a.img1v1Url" :src="a.img1v1Url + '?param=40y40'" class="suggest-avatar" />
            <span>{{ a.name }}</span>
          </div>
        </div>
        <div v-if="suggestions.songs?.length" class="suggest-group">
          <div class="suggest-group-title">单曲</div>
          <div v-for="s in suggestions.songs.slice(0, 5)" :key="s.id" class="suggest-item" @click="searchQuery = s.name; doSearch(); suggestVisible = false">
            <Icon name="music" :size="14" color="var(--text-tertiary)" />
            <span>{{ s.name }} - {{ s.artists?.map(a => a.name).join(', ') }}</span>
          </div>
        </div>
        <div v-if="suggestions.albums?.length" class="suggest-group">
          <div class="suggest-group-title">专辑</div>
          <div v-for="al in suggestions.albums.slice(0, 3)" :key="al.id" class="suggest-item" @click="searchQuery = al.name; doSearch(); suggestVisible = false">
            <Icon name="disc" :size="14" color="var(--text-tertiary)" />
            <span>{{ al.name }} - {{ al.artist?.name }}</span>
          </div>
        </div>
        <div v-if="suggestions.playlists?.length" class="suggest-group">
          <div class="suggest-group-title">歌单</div>
          <div v-for="pl in suggestions.playlists.slice(0, 3)" :key="pl.id" class="suggest-item" @click="searchQuery = pl.name; doSearch(); suggestVisible = false">
            <Icon name="list-music" :size="14" color="var(--text-tertiary)" />
            <span>{{ pl.name }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Search Results -->
    <div v-if="showResults" class="search-results">
      <div class="section-header">
        <h2 class="section-title">搜索结果: "{{ lastQuery }}"</h2>
        <button class="btn btn-ghost btn-sm" @click="clearSearch">返回</button>
      </div>

      <!-- Search type tabs -->
      <div class="search-tabs">
        <button v-for="tab in searchTabs" :key="tab.type" class="search-tab"
          :class="{ active: searchType === tab.type }" @click="switchSearchType(tab.type)">
          {{ tab.label }}
        </button>
      </div>

      <!-- Best match card (from multimatch) -->
      <div v-if="bestMatch && searchType === 1" class="best-match">
        <div class="best-match-label">最佳匹配</div>
        <div v-if="bestMatch.artist" class="best-match-card" @click="searchQuery = bestMatch.artist.name; doSearch()">
          <img v-if="bestMatch.artist.img1v1Url" :src="bestMatch.artist.img1v1Url + '?param=80y80'" class="best-match-avatar" />
          <div class="best-match-info">
            <div class="best-match-name">{{ bestMatch.artist.name }}</div>
            <div class="best-match-meta">歌手 · {{ bestMatch.artist.albumSize || 0 }} 张专辑</div>
          </div>
        </div>
        <div v-if="bestMatch.album" class="best-match-card" @click="searchQuery = bestMatch.album.name; switchSearchType(10)">
          <img v-if="bestMatch.album.picUrl" :src="bestMatch.album.picUrl + '?param=80y80'" class="best-match-avatar" style="border-radius: var(--radius-md)" />
          <div class="best-match-info">
            <div class="best-match-name">{{ bestMatch.album.name }}</div>
            <div class="best-match-meta">专辑 · {{ bestMatch.album.artist?.name }}</div>
          </div>
        </div>
      </div>

      <div v-if="searchLoading" class="page-loading"><div class="loading-spinner"></div></div>
      <div v-else>
        <!-- Songs (type=1) -->
        <template v-if="searchType === 1">
          <div v-for="(song, idx) in searchResults" :key="song.id" class="song-item" @dblclick="playSong(song, searchResults, idx)">
            <span class="song-index">{{ idx + 1 }}</span>
            <div class="song-cover" v-if="song.al?.picUrl"><img :src="song.al.picUrl + '?param=80y80'" alt="" /></div>
            <div class="song-info">
              <div class="song-name">{{ song.name }}</div>
              <div class="song-artist">{{ song.ar?.map(a => a.name).join(', ') }}</div>
            </div>
            <div class="song-duration">{{ formatDuration(song.dt) }}</div>
            <div class="song-actions">
              <button class="action-btn" @click.stop="playSong(song, searchResults, idx)" title="播放"><Icon name="play" :size="14" /></button>
              <button class="action-btn" :class="{ liked: userStore.isLiked(song.id) }" @click.stop="onLike(song)" title="喜欢">
                <Icon :name="userStore.isLiked(song.id) ? 'heart-fill' : 'heart'" :size="14" />
              </button>
              <button class="action-btn" @click.stop="quickAdd(song)" title="添加到歌单"><Icon name="plus-circle" :size="14" /></button>
              <button class="action-btn" @click.stop="onDownloadSong(song)" title="下载"><Icon name="download" :size="14" /></button>
            </div>
          </div>
        </template>

        <!-- Albums (type=10) -->
        <template v-if="searchType === 10">
          <div class="search-grid" ref="searchGridRef">
            <div v-for="album in searchResults" :key="album.id" class="result-card" @click="searchQuery = album.name; switchSearchType(1)">
              <div class="result-card-cover"><img v-if="album.picUrl" :src="album.picUrl + '?param=200y200'" alt="" /></div>
              <div class="result-card-name">{{ album.name }}</div>
              <div class="result-card-meta">{{ album.artist?.name }} · {{ album.publishTime ? new Date(album.publishTime).getFullYear() : '' }}</div>
            </div>
          </div>
        </template>

        <!-- Artists (type=100) -->
        <template v-if="searchType === 100">
          <div class="search-grid" ref="searchGridRef">
            <div v-for="artist in searchResults" :key="artist.id" class="result-card" @click="searchQuery = artist.name; switchSearchType(1)">
              <div class="result-card-cover round"><img v-if="artist.img1v1Url" :src="artist.img1v1Url + '?param=200y200'" alt="" /></div>
              <div class="result-card-name">{{ artist.name }}</div>
              <div class="result-card-meta">{{ artist.albumSize || 0 }} 张专辑 · {{ artist.musicSize || 0 }} 首歌</div>
            </div>
          </div>
        </template>

        <!-- Playlists (type=1000) -->
        <template v-if="searchType === 1000">
          <div class="search-grid" ref="searchGridRef">
            <div v-for="pl in searchResults" :key="pl.id" class="result-card" @click="goToPlaylist(pl)">
              <div class="result-card-cover"><img v-if="pl.coverImgUrl" :src="pl.coverImgUrl + '?param=200y200'" alt="" />
                <span class="card-playcount"><Icon name="play" :size="10" color="white" />{{ formatCount(pl.playCount) }}</span>
              </div>
              <div class="result-card-name">{{ pl.name }}</div>
              <div class="result-card-meta">{{ pl.trackCount }} 首</div>
            </div>
          </div>
        </template>

        <!-- Users (type=1002) -->
        <template v-if="searchType === 1002">
          <div v-for="u in searchResults" :key="u.userId" class="user-result-item">
            <img v-if="u.avatarUrl" :src="u.avatarUrl + '?param=80y80'" class="user-result-avatar" />
            <div class="user-result-info">
              <div class="user-result-name">{{ u.nickname }}</div>
              <div class="user-result-sig">{{ u.signature || '' }}</div>
            </div>
          </div>
        </template>

        <div v-if="!searchLoading && searchResults.length === 0" class="search-empty">
          <Icon name="search" :size="32" color="var(--text-tertiary)" />
          <div>未找到相关结果</div>
        </div>
      </div>
    </div>

    <template v-if="!showResults">
      <!-- Banner Carousel -->
      <div v-if="banners.length" class="banner-section">
        <div class="banner-track">
          <div v-for="(b, idx) in banners" :key="idx" class="banner-slide"
            :class="bannerSlideClass(idx)"
            @click="onBannerClick(b, idx)">
            <img :src="b.imageUrl + '?param=1000y400'" alt="" />
            <span v-if="b.typeTitle" class="banner-type-tag">{{ b.typeTitle }}</span>
          </div>
        </div>
        <div class="banner-dots">
          <span v-for="(_, idx) in banners" :key="idx" class="dot" :class="{ active: idx === bannerIndex }" @click="bannerIndex = idx; restartBannerTimer()"></span>
        </div>
        <button class="banner-arrow banner-arrow-left" @click="bannerPrev"><Icon name="chevron-left" :size="20" color="white" /></button>
        <button class="banner-arrow banner-arrow-right" @click="bannerNext"><Icon name="chevron-left" :size="20" color="white" style="transform:rotate(180deg)" /></button>
      </div>
      <div v-else-if="loading" class="banner-section">
        <div class="skeleton" style="width:100%;height:200px;border-radius:var(--radius-xl)"></div>
      </div>

      <!-- Daily Recommend -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title"><Icon name="calendar" :size="20" color="var(--primary-light)" /> 每日推荐</h2>
          <template v-if="dailySongs.length">
            <div class="daily-nav">
              <button class="btn btn-ghost btn-sm" @click="goHistoryPrev" :disabled="!canGoPrev" :title="canGoPrev ? '前一天 ' + historyDates[dailyDateIndex + 1] : historyNoMsg || '没有更早的推荐'">
                <Icon name="chevron-left" :size="16" /> 前一天{{ canGoPrev ? ' (' + historyDates[dailyDateIndex + 1] + ')' : '' }}
              </button>
              <button v-if="dailyDateIndex !== -1" class="btn btn-ghost btn-sm" @click="goHistoryToday" title="回到今天">回到今天</button>
              <button v-if="dailyDateIndex > 0" class="btn btn-ghost btn-sm" @click="goHistoryNext" :title="'后一天 ' + historyDates[dailyDateIndex - 1]">
                后一天 ({{ historyDates[dailyDateIndex - 1] }}) <Icon name="chevron-left" :size="16" style="transform:rotate(180deg)" />
              </button>
              <button class="btn btn-primary btn-sm" @click="playDailyAll" title="播放全部每日推荐">
                <Icon name="play" :size="14" color="white" /> 播放全部
              </button>
            </div>
          </template>
        </div>
        <template v-if="dailySongs.length">
          <div class="daily-scroll-wrap">
            <button class="scroll-arrow scroll-arrow-left" @click="scrollDaily(-1, { source: 'manual', wrap: true })"><Icon name="chevron-left" :size="18" /></button>
            <div class="daily-scroll" ref="dailyScrollRef">
              <div v-for="(song, idx) in dailySongs" :key="song.id" class="song-card" :class="{ visible: dailyCardsVisible }" @click="playSong(song, dailySongs, idx)">
                <div class="song-card-cover">
                  <img :src="song.coverUrl" alt="" loading="lazy" />
                  <div class="play-overlay"><div class="play-btn"><Icon name="play" :size="18" color="white" /></div></div>
                </div>
                <div class="song-card-info">
                  <div class="song-card-name">{{ song.name }}</div>
                  <div class="song-card-artist">{{ song.artistText }}</div>
                </div>
                <div class="song-card-actions">
                  <button class="action-btn-sm" :class="{ liked: userStore.isLiked(song.id) }" @click.stop="onLike(song)">
                    <Icon :name="userStore.isLiked(song.id) ? 'heart-fill' : 'heart'" :size="14" />
                  </button>
                  <button class="action-btn-sm" @click.stop="quickAdd(song)" title="添加到歌单"><Icon name="plus" :size="14" /></button>
                </div>
              </div>
            </div>
            <button class="scroll-arrow scroll-arrow-right" @click="scrollDaily(1, { source: 'manual', wrap: true })"><Icon name="chevron-left" :size="18" style="transform:rotate(180deg)" /></button>
          </div>
        </template>
        <div v-else-if="loading" class="skel-daily-scroll">
          <div v-for="i in 6" :key="i" class="skel-song-card">
            <div class="skeleton" style="aspect-ratio:1;border-radius:var(--radius-lg)"></div>
            <div class="skeleton skeleton-text" style="width:80%;margin-top:10px"></div>
            <div class="skeleton skeleton-text-sm" style="width:55%;margin-top:6px"></div>
          </div>
        </div>
      </div>

      <!-- 歌单广场 (Category Playlists) -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title"><Icon name="list-music" :size="20" color="var(--primary-light)" /> 歌单广场</h2>
        </div>
        <div class="cat-chips-wrap">
          <div class="cat-chips">
            <button class="cat-chip" :class="{ active: plCat === '精品', premium: true }" @click="switchPlCat('精品')"><Icon name="crown" :size="14" /> 精品</button>
            <button class="cat-chip" :class="{ active: plCat === '全部' }" @click="switchPlCat('全部')">全部</button>
            <button v-for="tag in hotCatTags" :key="tag.name" class="cat-chip" :class="{ active: plCat === tag.name }" @click="switchPlCat(tag.name)">{{ tag.name }}</button>
          </div>
        </div>
        <template v-if="catPlaylists.length">
          <transition name="fade" mode="out-in">
            <div class="grid-cards" :key="plCat" ref="catGridRef">
              <div v-for="pl in catPlaylists" :key="pl.id" class="card" :data-pl-id="pl.id" @click="goToPlaylist(pl)">
                <div class="card-cover">
                  <img :src="(pl.coverImgUrl || pl.picUrl || '') + '?param=300y300'" alt="" loading="lazy" />
                  <div class="play-overlay"><div class="play-btn" @click.stop="playPlaylistDirect(pl)"><Icon name="play" :size="18" color="white" /></div></div>
                  <div class="card-playcount" v-if="pl.playCount || pl.playcount">
                    <Icon name="play" :size="10" color="white" /> {{ formatCount(pl.playCount || pl.playcount) }}
                  </div>
                </div>
                <div class="card-body"><div class="card-title">{{ pl.name }}</div></div>
              </div>
            </div>
          </transition>
          <div v-if="catPlaylists.length >= 18" class="load-more-wrap">
            <button class="btn btn-ghost" @click="loadMoreCatPlaylists" :disabled="catLoading">{{ catLoading ? '加载中...' : '加载更多' }}</button>
          </div>
        </template>
        <div v-else class="grid-cards">
          <div v-for="i in 6" :key="i" class="skel-card">
            <div class="skeleton" style="aspect-ratio:1;border-radius:var(--radius-lg) var(--radius-lg) 0 0"></div>
            <div style="padding:12px">
              <div class="skeleton skeleton-text" style="width:85%"></div>
              <div class="skeleton skeleton-text-sm" style="width:50%;margin-top:8px"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 曲风探索 (Genre Bubbles) -->
      <div v-if="genreTags.length" class="section genre-section">
        <div class="section-header">
          <h2 class="section-title"><Icon name="radio" :size="20" color="var(--primary-light)" /> 曲风探索</h2>
        </div>
        <div class="genre-bubbles">
          <button v-for="tag in genreTags" :key="tag.tagId" class="genre-bubble" :style="genreBubbleStyle(tag)" @click="router.push('/genre/' + tag.tagId)">
            {{ tag.tagName }}
          </button>
        </div>
        <div v-if="genrePreference.length" class="genre-pref">
          <span class="genre-pref-label">✨ 你的偏好:</span>
          <button v-for="p in genrePreference" :key="p.tagId" class="genre-pref-tag" @click="router.push('/genre/' + p.tagId)">{{ p.tagName }}</button>
        </div>
      </div>

      <!-- New Songs -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title"><Icon name="disc" :size="20" color="var(--primary-light)" /> 推荐新音乐</h2>
        </div>
        <template v-if="newSongs.length">
          <div class="grid-songs">
            <div v-for="(item, idx) in newSongs.slice(0, 12)" :key="item.id" class="song-item" @dblclick="playNewSong(item, idx)">
              <div class="song-cover"><img :src="(item.picUrl || item.song?.album?.picUrl || '') + '?param=80y80'" alt="" loading="lazy" /></div>
              <div class="song-info">
                <div class="song-name">{{ item.name || item.song?.name }}</div>
                <div class="song-artist">{{ (item.song?.artists || []).map(a => a.name).join(', ') }}</div>
              </div>
              <div class="song-actions">
                <button class="action-btn" @click.stop="playNewSong(item, idx)" title="播放"><Icon name="play" :size="14" /></button>
                <button class="action-btn" @click.stop="quickAddNewSong(item)" title="添加到歌单"><Icon name="plus-circle" :size="14" /></button>
                <button class="action-btn" @click.stop="onDownloadSong(item.song || item)" title="下载"><Icon name="download" :size="14" /></button>
              </div>
            </div>
          </div>
        </template>
        <div v-else-if="loading" class="grid-songs">
          <div v-for="i in 6" :key="i" class="skel-song-item">
            <div class="skeleton" style="width:44px;height:44px;border-radius:var(--radius-sm);flex-shrink:0"></div>
            <div style="flex:1;min-width:0">
              <div class="skeleton skeleton-text" style="width:70%"></div>
              <div class="skeleton skeleton-text-sm" style="width:40%;margin-top:6px"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Toplists -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title"><Icon name="bar-chart" :size="20" color="var(--primary-light)" /> 排行榜</h2>
        </div>
        <template v-if="toplists.length">
          <div class="grid-cards" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
            <div v-for="tl in toplists.slice(0, 8)" :key="tl.id" class="card" @click="goToPlaylist(tl)">
              <div class="card-cover">
                <img :src="(tl.coverImgUrl || '') + '?param=300y300'" alt="" loading="lazy" />
                <div class="play-overlay"><div class="play-btn" @click.stop="playPlaylistDirect(tl)"><Icon name="play" :size="18" color="white" /></div></div>
              </div>
              <div class="card-body">
                <div class="card-title">{{ tl.name }}</div>
                <div class="card-subtitle">{{ tl.updateFrequency }}</div>
              </div>
            </div>
          </div>
        </template>
        <div v-else-if="loading" class="grid-cards" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
          <div v-for="i in 4" :key="i" class="skel-card">
            <div class="skeleton" style="aspect-ratio:1;border-radius:var(--radius-lg) var(--radius-lg) 0 0"></div>
            <div style="padding:12px">
              <div class="skeleton skeleton-text" style="width:75%"></div>
              <div class="skeleton skeleton-text-sm" style="width:45%;margin-top:8px"></div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-if="loading && !showResults && !banners.length && !dailySongs.length" class="page-loading"><div class="loading-spinner"></div></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'
import { useUserStore } from '../stores/user'
import { useDownloadStore } from '../stores/download'
import { useCache } from '../composables/useCache'
import {
  getBanner, getPersonalized, getPersonalizedNewSong,
  getRecommendSongs, getHistoryRecommendDates, getHistoryRecommendDetail,
  searchHotDetail, search as apiSearch,
  getToplist, likeSong, getSongUrl, getPlaylistAllSongs,
  searchSuggest, searchMultimatch,
  getPlaylistHotTags, getTopPlaylist, getTopPlaylistHighquality,
  getStyleList, getStylePreference,
  dbAddSearch, getSongDetail, getAlbumDetail
} from '../api'
import { slimSongs } from '../utils/slimSong'
import Icon from '../components/Icon.vue'

const quickAdd = inject('quickAdd')
const sidebarFlipCallbacks = inject('sidebarFlipCallbacks', null)
const router = useRouter()
const playerStore = usePlayerStore()
const userStore = useUserStore()
const downloadStore = useDownloadStore()
const cache = useCache()

const loading = ref(true)
const banners = ref([])
const bannerIndex = ref(0)
const dailySongs = ref([])
// History daily recommend: -1 = today, 0..N = index into historyDates
const dailyDateIndex = ref(-1)
const historyDates = ref([]) // sorted newest-first, e.g. ['2026-03-16', '2026-03-15', ...]
const canGoPrev = computed(() => dailyDateIndex.value < historyDates.value.length - 1)
const historyNoMsg = ref('')
const dailyLoading = ref(false)
const catGridRef = ref(null)
const searchGridRef = ref(null)
const dailyScrollRef = ref(null)
const dailyCardsVisible = ref(false)
const recPlaylists = ref([])
const newSongs = ref([])
const toplists = ref([])
const hotSearches = ref([])
const searchQuery = ref('')
const searchPlaceholder = ref('搜索歌曲、歌手、歌单...')
const showHotSearch = ref(false)
const showResults = ref(false)
const searchResults = ref([])
const searchLoading = ref(false)
const lastQuery = ref('')
const searchType = ref(1)
const suggestions = ref({})
const suggestVisible = ref(false)
const bestMatch = ref(null)
let suggestTimer = null
const searchTabs = [
  { type: 1, label: '单曲' },
  { type: 10, label: '专辑' },
  { type: 100, label: '歌手' },
  { type: 1000, label: '歌单' },
  { type: 1002, label: '用户' },
]
const searchCache = {}

// ─── Category Playlists ───
const hotCatTags = ref([])
const plCat = ref(cache.get('plCat') || '全部')
const catPlaylists = ref([])
const catLoading = ref(false)
let catOffset = 0

const CAT_PL_TTL = 10 * 60 * 1000 // 10 min TTL for category playlists

// ─── Genre Exploration ───
const genreTags = ref([])
const genrePreference = ref([])

const AUTO_ADVANCE_MS = 3000
const BANNER_TRANSITION_MS = 500
const DAILY_SCROLL_CARD_WIDTH = 172
const DAILY_PRELOAD_BATCH = 4

let bannerTimer = null
let dailyAutoTimer = null
let dailyScrollAnimationFrame = null
let dailyPreloadTimer = null
let dailyTargetIndex = 0
let pauseDailyAutoUntil = 0

// ─── Image preload pool (reuses a fixed number of Image objects) ───
function toPreloadUrl(url, sizeSuffix = '') {
  if (!url) return ''
  return sizeSuffix ? `${url}${sizeSuffix}` : url
}

const PRELOAD_POOL_SIZE = 4
const _imagePool = []
const _preloadQueue = []
let _preloadActive = 0

function initImagePool() {
  for (let i = _imagePool.length; i < PRELOAD_POOL_SIZE; i++) {
    const img = new Image()
    img.decoding = 'async'
    img.onload = img.onerror = () => {
      _preloadActive--
      pumpPreloadQueue()
    }
    _imagePool.push(img)
  }
}

function pumpPreloadQueue() {
  while (_preloadActive < PRELOAD_POOL_SIZE && _preloadQueue.length > 0) {
    const url = _preloadQueue.shift()
    const img = _imagePool[_preloadActive]
    _preloadActive++
    img.src = url
  }
}

function preloadImage(url) {
  if (!url || typeof window === 'undefined') return
  initImagePool()
  _preloadQueue.push(url)
  pumpPreloadQueue()
}

function preloadBannerNeighbors(index = bannerIndex.value) {
  if (!banners.value.length) return
  const indexes = [
    index,
    (index + 1) % banners.value.length,
    (index - 1 + banners.value.length) % banners.value.length
  ]
  indexes.forEach((bannerIdx) => {
    const banner = banners.value[bannerIdx]
    preloadImage(toPreloadUrl(banner?.imageUrl, '?param=1000y400'))
  })
}

function normalizeDailySongs(songs = []) {
  return songs.map((song) => ({
    ...song,
    coverUrl: toPreloadUrl(song?.al?.picUrl, '?param=200y200'),
    artistText: song?.ar?.map((artist) => artist.name).join(', ') || ''
  }))
}

function preloadDailySongCovers(startIndex = 0, count = DAILY_PRELOAD_BATCH, list = dailySongs.value) {
  const songs = list.slice(startIndex, startIndex + count)
  songs.forEach((song) => preloadImage(song.coverUrl || toPreloadUrl(song?.al?.picUrl, '?param=200y200')))
}

function scheduleDailySongAssetPreload(list = dailySongs.value) {
  if (dailyPreloadTimer) clearTimeout(dailyPreloadTimer)
  const queue = list.map((song) => song.coverUrl || toPreloadUrl(song?.al?.picUrl, '?param=200y200')).filter(Boolean)
  let pointer = 0

  const pump = () => {
    const batch = queue.slice(pointer, pointer + DAILY_PRELOAD_BATCH)
    batch.forEach((url) => preloadImage(url))
    pointer += DAILY_PRELOAD_BATCH
    if (pointer < queue.length) {
      dailyPreloadTimer = setTimeout(pump, 200)
    } else {
      dailyPreloadTimer = null
    }
  }

  pump()
}

function getDailyMaxIndex(element) {
  return Math.max(0, Math.ceil((element.scrollWidth - element.clientWidth) / DAILY_SCROLL_CARD_WIDTH))
}

function getDailyBaseIndex(element) {
  if (dailyScrollAnimationFrame) return dailyTargetIndex
  return Math.round(element.scrollLeft / DAILY_SCROLL_CARD_WIDTH)
}

function pauseDailyAutoScroll() {
  pauseDailyAutoUntil = Date.now() + AUTO_ADVANCE_MS
}

function stopDailyScrollAnimation() {
  if (dailyScrollAnimationFrame) {
    cancelAnimationFrame(dailyScrollAnimationFrame)
    dailyScrollAnimationFrame = null
  }
}

function animateHorizontalScroll(element, targetLeft, duration = BANNER_TRANSITION_MS) {
  stopDailyScrollAnimation()
  const maxLeft = Math.max(0, element.scrollWidth - element.clientWidth)
  const startLeft = element.scrollLeft
  const nextLeft = Math.max(0, Math.min(targetLeft, maxLeft))
  if (Math.abs(nextLeft - startLeft) < 1) {
    element.scrollLeft = nextLeft
    return
  }

  // Temporarily disable scroll-snap so it doesn't fight the animation
  const prevSnap = element.style.scrollSnapType
  element.style.scrollSnapType = 'none'

  const startTime = performance.now()
  const easeInOutCubic = (progress) => (
    progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2
  )

  const step = (currentTime) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = easeInOutCubic(progress)
    element.scrollLeft = startLeft + (nextLeft - startLeft) * eased
    if (progress < 1) {
      dailyScrollAnimationFrame = requestAnimationFrame(step)
    } else {
      dailyScrollAnimationFrame = null
      dailyTargetIndex = Math.round(nextLeft / DAILY_SCROLL_CARD_WIDTH)
      // Restore scroll-snap after animation completes
      element.style.scrollSnapType = prevSnap
    }
  }

  dailyScrollAnimationFrame = requestAnimationFrame(step)
}

function bannerSlideClass(idx) {
  const diff = idx - bannerIndex.value
  if (diff === 0) return 'active'
  if (diff === 1 || (diff === -(banners.value.length - 1))) return 'next'
  if (diff === -1 || (diff === banners.value.length - 1)) return 'prev'
  return 'hidden'
}
function bannerPrev() {
  bannerIndex.value = (bannerIndex.value - 1 + banners.value.length) % banners.value.length
  restartBannerTimer()
}
function bannerNext() {
  bannerIndex.value = (bannerIndex.value + 1) % banners.value.length
  restartBannerTimer()
}

async function onBannerClick(b, idx) {
  // If not the active slide, just switch to it
  if (idx !== bannerIndex.value) {
    bannerIndex.value = idx
    restartBannerTimer()
    return
  }
  // Active slide: navigate based on targetType
  const id = b.targetId
  if (!id) return
  switch (b.targetType) {
    case 1: // Song
      try {
        window.__toast?.('正在加载歌曲...', 'info')
        const res = await getSongDetail(String(id))
        const song = res.songs?.[0]
        if (!song) { window.__toast?.('歌曲不可用', 'warning'); break }
        if (song.fee === 1) window.__toast?.('此歌曲为 VIP 专享，可能无法完整播放', 'warning')
        else if (song.fee === 4) window.__toast?.('此歌曲需付费购买，可能无法播放', 'warning')
        playerStore.playSong(song)
      } catch { window.__toast?.('加载失败', 'error') }
      break
    case 10: // Album — fetch album detail and play
      try {
        window.__toast?.('正在加载专辑...', 'info')
        const albumRes = await getAlbumDetail(id)
        const allSongs = albumRes.songs || []
        const freeSongs = allSongs.filter(s => s.fee !== 1 && s.fee !== 4)
        if (!allSongs.length) {
          window.__toast?.('专辑暂无可播放歌曲', 'warning')
        } else if (!freeSongs.length) {
          window.__toast?.('此专辑为付费专辑，所有歌曲均需 VIP 或购买', 'warning')
        } else {
          if (freeSongs.length < allSongs.length)
            window.__toast?.(`专辑含 ${allSongs.length - freeSongs.length} 首付费歌曲已跳过`, 'info')
          playerStore.playSong(freeSongs[0], freeSongs, 0)
          window.__toast?.(`正在播放专辑: ${albumRes.album?.name || ''}`, 'success')
        }
      } catch { window.__toast?.('加载专辑失败', 'error') }
      break
    case 1000: // Playlist
      router.push({ path: '/playlists', query: { id } })
      break
    default:
      window.__toast?.(b.typeTitle || '暂不支持此类型', 'info')
  }
}

function revealDailyCards() {
  dailyCardsVisible.value = false
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      dailyCardsVisible.value = true
    })
  })
}

// ─── Sidebar FLIP: smooth card repositioning when sidebar toggles ───
const FLIP_DUR = '0.4s'
const FLIP_EASE = 'cubic-bezier(.4,0,.2,1)'
let _sidebarFlipOldMap = null
let _sidebarFlipOldGridH = 0
let _searchFlipOldMap = null
let _searchFlipOldGridH = 0

function sidebarFlipSnapshot() {
  // Snapshot category grid
  const grid = catGridRef.value
  if (grid) {
    const gridRect = grid.getBoundingClientRect()
    _sidebarFlipOldMap = new Map()
    for (const card of grid.querySelectorAll('.card[data-pl-id]')) {
      const r = card.getBoundingClientRect()
      _sidebarFlipOldMap.set(card.dataset.plId, {
        left: r.left - gridRect.left,
        top: r.top - gridRect.top,
        width: r.width,
        height: r.height
      })
    }
    _sidebarFlipOldGridH = grid.scrollHeight
  }
  // Snapshot search grid
  const sg = searchGridRef.value
  if (sg) {
    const sgRect = sg.getBoundingClientRect()
    _searchFlipOldMap = new Map()
    const cards = sg.querySelectorAll('.result-card')
    cards.forEach((card, idx) => {
      const r = card.getBoundingClientRect()
      _searchFlipOldMap.set(String(idx), {
        left: r.left - sgRect.left,
        top: r.top - sgRect.top,
        width: r.width,
        height: r.height
      })
    })
    _searchFlipOldGridH = sg.scrollHeight
  }
}

function sidebarFlipAnimate() {
  const grid = catGridRef.value
  if (!grid || !_sidebarFlipOldMap) return
  const oldMap = _sidebarFlipOldMap
  const oldGridH = _sidebarFlipOldGridH
  _sidebarFlipOldMap = null

  const gridRect = grid.getBoundingClientRect()
  const newMap = new Map()
  for (const card of grid.querySelectorAll('.card[data-pl-id]')) {
    const r = card.getBoundingClientRect()
    newMap.set(card.dataset.plId, {
      left: r.left - gridRect.left,
      top: r.top - gridRect.top,
      width: r.width,
      height: r.height
    })
  }
  const newGridH = grid.scrollHeight

  const allIds = new Set([...oldMap.keys(), ...newMap.keys()])
  const moveCards = []
  const appearCards = []
  for (const id of allIds) {
    const oldR = oldMap.get(id)
    const newR = newMap.get(id)
    const card = grid.querySelector(`.card[data-pl-id="${id}"]`)
    if (!card) continue
    if (oldR && newR) moveCards.push({ card, oldR, newR })
    else if (newR) appearCards.push({ card, newR })
  }

  const fixedH = Math.max(oldGridH, newGridH)
  grid.style.height = fixedH + 'px'
  grid.style.overflow = 'hidden'

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

  grid.offsetHeight

  for (const { card, oldR, newR } of moveCards) {
    const dx = newR.left - oldR.left
    const dy = newR.top - oldR.top
    card.style.transition = `transform ${FLIP_DUR} ${FLIP_EASE}`
    card.style.transform = `translate(${dx}px, ${dy}px)`
  }
  for (const { card } of appearCards) {
    card.style.transition = `opacity ${FLIP_DUR} ${FLIP_EASE}`
    card.style.opacity = '1'
  }

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

function flipSearchGrid() {
  const sg = searchGridRef.value
  if (!sg || !_searchFlipOldMap) return
  const oldMap = _searchFlipOldMap
  const oldGridH = _searchFlipOldGridH
  _searchFlipOldMap = null

  const sgRect = sg.getBoundingClientRect()
  const newMap = new Map()
  const cards = sg.querySelectorAll('.result-card')
  cards.forEach((card, idx) => {
    const r = card.getBoundingClientRect()
    newMap.set(String(idx), {
      left: r.left - sgRect.left,
      top: r.top - sgRect.top,
      width: r.width,
      height: r.height
    })
  })
  const newGridH = sg.scrollHeight

  const allIds = new Set([...oldMap.keys(), ...newMap.keys()])
  const moveCards = []
  for (const id of allIds) {
    const oldR = oldMap.get(id)
    const newR = newMap.get(id)
    if (!oldR || !newR) continue
    const card = cards[Number(id)]
    if (card) moveCards.push({ card, oldR, newR })
  }
  if (!moveCards.length) return

  const fixedH = Math.max(oldGridH, newGridH)
  sg.style.height = fixedH + 'px'
  sg.style.overflow = 'hidden'

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

  sg.offsetHeight

  for (const { card, oldR, newR } of moveCards) {
    const dx = newR.left - oldR.left
    const dy = newR.top - oldR.top
    card.style.transition = `transform ${FLIP_DUR} ${FLIP_EASE}`
    card.style.transform = `translate(${dx}px, ${dy}px)`
  }

  let cleaned2 = false
  function cleanup2() {
    if (cleaned2) return
    cleaned2 = true
    for (const card of allAnimCards) card.style.transition = 'none'
    for (const card of allAnimCards) {
      card.style.position = ''
      card.style.left = ''
      card.style.top = ''
      card.style.width = ''
      card.style.transform = ''
      card.style.margin = ''
    }
    sg.style.height = ''
    sg.style.overflow = ''
    sg.offsetHeight
    requestAnimationFrame(() => {
      for (const card of allAnimCards) card.style.transition = ''
    })
  }
  setTimeout(cleanup2, 500)
}

const sidebarFlipCb = {
  snapshot: sidebarFlipSnapshot,
  animate() {
    sidebarFlipAnimate()
    flipSearchGrid()
  }
}

onMounted(async () => {
  sidebarFlipCallbacks?.add(sidebarFlipCb)

  try {
    banners.value = cache.get('banners') || []
    recPlaylists.value = cache.get('recPlaylists') || []
    newSongs.value = cache.get('newSongs') || []
    toplists.value = cache.get('toplists') || []
    hotSearches.value = cache.get('hotSearches') || []
    dailySongs.value = normalizeDailySongs(cache.get('dailySongs') || [])
    hotCatTags.value = cache.get('hotCatTags') || []
    const savedCat = cache.get('plCat') || '全部'
    plCat.value = savedCat
    catPlaylists.value = cache.get('catPl_' + savedCat) || []
    genreTags.value = cache.get('genreTags') || []
    genrePreference.value = cache.get('genrePreference') || []

    const hasCached = banners.value.length || recPlaylists.value.length
    if (hasCached) loading.value = false
    if (banners.value.length) {
      preloadBannerNeighbors()
      startBannerTimer()
    }
    if (dailySongs.value.length) {
      preloadDailySongCovers()
      scheduleDailySongAssetPreload()
    }

    const [bannerRes, recRes, newRes, topRes, hotRes] = await Promise.allSettled([
      getBanner(), getPersonalized(12), getPersonalizedNewSong(12), getToplist(), searchHotDetail()
    ])
    if (bannerRes.status === 'fulfilled' && bannerRes.value.banners) {
      banners.value = bannerRes.value.banners; cache.set('banners', banners.value)
      preloadBannerNeighbors()
      if (!bannerTimer) startBannerTimer()
    }
    if (recRes.status === 'fulfilled') { recPlaylists.value = recRes.value.result || []; cache.set('recPlaylists', recPlaylists.value) }
    if (newRes.status === 'fulfilled') { newSongs.value = newRes.value.result || []; cache.set('newSongs', newSongs.value) }
    if (topRes.status === 'fulfilled') { toplists.value = topRes.value.list || []; cache.set('toplists', toplists.value) }
    if (hotRes.status === 'fulfilled') { hotSearches.value = hotRes.value.data || []; cache.set('hotSearches', hotSearches.value) }

    if (userStore.isLoggedIn) {
      await loadDailySongs()
      // Load available history dates (non-blocking)
      loadHistoryDates()
    }

    // Load new features (non-blocking)
    loadCatPlaylists()
    loadGenreTags()
  } catch (e) { console.error('Failed to load discover:', e) }
  finally { loading.value = false }

  await nextTick()
  revealDailyCards()

  // Auto-scroll daily songs
  dailyAutoTimer = setInterval(() => {
    if (Date.now() < pauseDailyAutoUntil) return
    scrollDaily(1, { source: 'auto', wrap: true })
  }, AUTO_ADVANCE_MS)
})



onUnmounted(() => {
  sidebarFlipCallbacks?.delete(sidebarFlipCb)
  if (bannerTimer) clearInterval(bannerTimer)
  if (dailyAutoTimer) clearInterval(dailyAutoTimer)
  if (dailyPreloadTimer) clearTimeout(dailyPreloadTimer)
  stopDailyScrollAnimation()
})

watch(dailySongs, async () => {
  await nextTick()
  revealDailyCards()
  preloadDailySongCovers()
  scheduleDailySongAssetPreload()
  dailyTargetIndex = 0
})

watch(bannerIndex, (index) => {
  preloadBannerNeighbors(index)
})

async function loadDailySongs() {
  try {
    // No hard-coded limit — fetch ALL daily songs
    const dailyRes = await getRecommendSongs()
    dailySongs.value = normalizeDailySongs(dailyRes.data?.dailySongs || dailyRes.recommend || [])
    cache.set('dailySongs', dailySongs.value, 15 * 60 * 1000)
  } catch {}
}

async function loadHistoryDates() {
  try {
    const res = await getHistoryRecommendDates()
    // API returns { data: { dates: [...], noHistoryMessage: '...' } }
    historyDates.value = res.data?.dates || []
    historyNoMsg.value = res.data?.noHistoryMessage || ''
  } catch { historyDates.value = [] }
}

async function loadHistoryDetail(date) {
  dailyLoading.value = true
  try {
    const res = await getHistoryRecommendDetail(date)
    const songs = res.data?.songs || []
    if (songs.length) {
      dailySongs.value = normalizeDailySongs(songs)
    } else {
      window.__toast?.('该日期无推荐数据', 'warning')
    }
  } catch {
    window.__toast?.('获取历史推荐失败', 'error')
  } finally {
    dailyLoading.value = false
  }
}

function goHistoryPrev() {
  if (!canGoPrev.value) return
  dailyDateIndex.value++
  loadHistoryDetail(historyDates.value[dailyDateIndex.value])
}
function goHistoryNext() {
  if (dailyDateIndex.value <= 0) { goHistoryToday(); return }
  dailyDateIndex.value--
  loadHistoryDetail(historyDates.value[dailyDateIndex.value])
}
function goHistoryToday() {
  dailyDateIndex.value = -1
  loadDailySongs()
}

function startBannerTimer() {
  if (bannerTimer || !banners.value.length) return
  bannerTimer = setInterval(() => {
    bannerIndex.value = (bannerIndex.value + 1) % banners.value.length
  }, AUTO_ADVANCE_MS)
}
function restartBannerTimer() {
  if (bannerTimer) { clearInterval(bannerTimer); bannerTimer = null }
  startBannerTimer()
}

function scrollDaily(dir, options = {}) {
  const { source = 'manual', wrap = false } = options
  const el = dailyScrollRef.value
  if (!el) return
  if (source === 'manual') {
    // Reset daily auto-scroll timer so full interval restarts from now
    if (dailyAutoTimer) { clearInterval(dailyAutoTimer); dailyAutoTimer = null }
    dailyAutoTimer = setInterval(() => {
      scrollDaily(1, { source: 'auto', wrap: true })
    }, AUTO_ADVANCE_MS)
  }

  const currentIndex = getDailyBaseIndex(el)
  const maxIndex = getDailyMaxIndex(el)
  let targetIndex = currentIndex + dir

  if (wrap) {
    // Wrap right→start: if going right and at or past the last position
    if (dir > 0 && currentIndex >= maxIndex) {
      dailyTargetIndex = 0
      stopDailyScrollAnimation()
      el.style.scrollSnapType = 'none'
      el.scrollLeft = 0
      requestAnimationFrame(() => { el.style.scrollSnapType = '' })
      preloadDailySongCovers(0, DAILY_PRELOAD_BATCH)
      return
    }
    // Wrap left→end: if going left and at or before the first position
    if (dir < 0 && currentIndex <= 0) {
      dailyTargetIndex = maxIndex
      const targetLeft = maxIndex * DAILY_SCROLL_CARD_WIDTH
      stopDailyScrollAnimation()
      el.style.scrollSnapType = 'none'
      el.scrollLeft = targetLeft
      requestAnimationFrame(() => { el.style.scrollSnapType = '' })
      preloadDailySongCovers(Math.max(0, maxIndex), DAILY_PRELOAD_BATCH)
      return
    }
  }

  targetIndex = Math.max(0, Math.min(maxIndex, targetIndex))
  dailyTargetIndex = targetIndex
  const targetLeft = targetIndex * DAILY_SCROLL_CARD_WIDTH
  animateHorizontalScroll(el, targetLeft)
  preloadDailySongCovers(Math.max(0, targetIndex), DAILY_PRELOAD_BATCH)
}

function playDailyAll() {
  if (dailySongs.value.length) playerStore.playSong(dailySongs.value[0], dailySongs.value, 0)
}

async function playPlaylistDirect(pl) {
  // Directly play the playlist without navigating
  try {
    window.__toast?.('正在加载歌单...', 'info')
    const res = await getPlaylistAllSongs(pl.id, 200)
    const songs = res.songs || []
    if (songs.length) {
      playerStore.playSong(songs[0], songs, 0)
      window.__toast?.(`正在播放「${pl.name}」`, 'success')
    }
  } catch { window.__toast?.('加载失败', 'error') }
}

async function doSearch() {
  if (!searchQuery.value.trim()) return
  searchLoading.value = true; showResults.value = true; showHotSearch.value = false; suggestVisible.value = false
  lastQuery.value = searchQuery.value; searchType.value = 1
  // Record search to DB (fire-and-forget)
  try { dbAddSearch(searchQuery.value.trim()) } catch {}
  // Clear cache for new query
  for (const k of Object.keys(searchCache)) delete searchCache[k]
  bestMatch.value = null

  try {
    const [searchRes, multiRes] = await Promise.allSettled([
      apiSearch(searchQuery.value, 1, 50),
      searchMultimatch(searchQuery.value)
    ])
    if (searchRes.status === 'fulfilled') {
      searchResults.value = slimSongs(searchRes.value.result?.songs || [])
      searchCache[1] = searchResults.value
    } else { searchResults.value = [] }

    // Best match
    if (multiRes.status === 'fulfilled') {
      const r = multiRes.value.result || multiRes.value
      bestMatch.value = null
      if (r?.artist?.[0] || r?.album?.[0]) {
        bestMatch.value = { artist: r.artist?.[0] || null, album: r.album?.[0] || null }
      }
    }
  } catch { searchResults.value = [] }
  finally { searchLoading.value = false }
}

async function switchSearchType(type) {
  searchType.value = type
  if (!lastQuery.value) return
  // Use cache if available
  if (searchCache[type]) { searchResults.value = searchCache[type]; return }
  searchLoading.value = true; searchResults.value = []
  try {
    const res = await apiSearch(lastQuery.value, type, 50)
    const r = res.result || {}
    const resultMap = { 1: slimSongs(r.songs || []), 10: r.albums, 100: r.artists, 1000: r.playlists, 1002: r.userprofiles }
    searchResults.value = resultMap[type] || []
    searchCache[type] = searchResults.value
  } catch { searchResults.value = [] }
  finally { searchLoading.value = false }
}

function onSearchFocus() { showHotSearch.value = true; if (searchQuery.value) suggestVisible.value = true }

function onSearchInput() {
  suggestVisible.value = true; showHotSearch.value = false
  clearTimeout(suggestTimer)
  const q = searchQuery.value.trim()
  if (!q) { suggestions.value = {}; return }
  suggestTimer = setTimeout(async () => {
    try {
      const res = await searchSuggest(q)
      suggestions.value = res.result || {}
    } catch { suggestions.value = {} }
  }, 300)
}

function clearSearch() {
  searchQuery.value = ''; showResults.value = false; searchResults.value = []
  searchType.value = 1; bestMatch.value = null; suggestions.value = {}; suggestVisible.value = false
  for (const k of Object.keys(searchCache)) delete searchCache[k]
  // Restore main data from sessionStorage on return
  if (!banners.value.length) banners.value = cache.get('banners') || []
  if (!recPlaylists.value.length) recPlaylists.value = cache.get('recPlaylists') || []
  if (!newSongs.value.length) newSongs.value = cache.get('newSongs') || []
  if (!toplists.value.length) toplists.value = cache.get('toplists') || []
}
function playSong(song, list, idx) { playerStore.playSong(song, list, idx) }
function playNewSong(item, idx) {
  const list = newSongs.value.map(i => {
    const s = i.song || i
    // Ensure album has picUrl (API sometimes puts it on the outer wrapper)
    if (s.album && !s.album.picUrl && i.picUrl) s.album.picUrl = i.picUrl
    if (s.al && !s.al.picUrl && i.picUrl) s.al.picUrl = i.picUrl
    return s
  })
  playerStore.playSong(list[idx] || item.song || item, list, idx)
}
function quickAddNewSong(item) { quickAdd(item.song || item) }
function goToPlaylist(pl) { router.push({ path: '/playlists', query: { id: pl.id } }) }
async function onLike(song) {
  if (!userStore.isLoggedIn) { userStore.showLoginModal = true; return }
  try { const like = !userStore.isLiked(song.id); await likeSong(song.id, like); userStore.fetchLikeList(); window.__toast?.(like ? '已添加到喜欢' : '已取消喜欢', 'success') }
  catch { window.__toast?.('操作失败', 'error') }
}
async function onDownloadSong(song) {
  if (!song?.id) return
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
function formatDuration(ms) { if (!ms) return ''; const m = Math.floor(ms / 60000); const s = Math.floor((ms % 60000) / 1000); return `${m}:${s.toString().padStart(2, '0')}` }
function formatCount(n) { if (!n) return '0'; if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿'; if (n >= 10000) return (n / 10000).toFixed(1) + '万'; return n.toString() }

// ─── Category Playlists functions ───
async function loadCatPlaylists() {
  // Load hot tags (use cache, refresh in background)
  const cachedTags = cache.get('hotCatTags')
  if (cachedTags?.length) hotCatTags.value = cachedTags
  try {
    const res = await getPlaylistHotTags()
    hotCatTags.value = (res.tags || []).slice(0, 15)
    cache.set('hotCatTags', hotCatTags.value, CAT_PL_TTL)
  } catch {}
  // Load initial playlists for the current category
  // If we already have cached data from onMounted restore, only do a background refresh
  if (!catPlaylists.value.length) {
    await switchPlCat(plCat.value)
  } else {
    // Background refresh: don't show loading, just silently update
    refreshCatPlaylists(plCat.value)
  }
}
async function refreshCatPlaylists(cat) {
  try {
    let pls
    if (cat === '精品') {
      const res = await getTopPlaylistHighquality(18)
      pls = res.playlists || []
    } else {
      const res = await getTopPlaylist(18, 'hot', cat === '全部' ? '全部' : cat)
      pls = res.playlists || []
    }
    // Only update if user is still on this category
    if (plCat.value === cat) {
      catPlaylists.value = pls
      cache.set('catPl_' + cat, pls, CAT_PL_TTL)
    }
  } catch {}
}
async function switchPlCat(cat) {
  plCat.value = cat
  catOffset = 0
  cache.set('plCat', cat, 30 * 60 * 1000) // remember selected category

  // Check cache first for instant display
  const cached = cache.get('catPl_' + cat)
  if (cached?.length) {
    catPlaylists.value = cached
    // Background refresh
    refreshCatPlaylists(cat)
    return
  }

  catLoading.value = true
  try {
    let pls
    if (cat === '精品') {
      const res = await getTopPlaylistHighquality(18)
      pls = res.playlists || []
    } else {
      const res = await getTopPlaylist(18, 'hot', cat === '全部' ? '全部' : cat)
      pls = res.playlists || []
    }
    catPlaylists.value = pls
    cache.set('catPl_' + cat, pls, CAT_PL_TTL)
  } catch { catPlaylists.value = [] }
  finally { catLoading.value = false }
}
async function loadMoreCatPlaylists() {
  catOffset += 18
  catLoading.value = true
  try {
    let newPls
    if (plCat.value === '精品') {
      const last = catPlaylists.value[catPlaylists.value.length - 1]
      const res = await getTopPlaylistHighquality(18, plCat.value === '精品' ? '全部' : plCat.value)
      newPls = res.playlists || []
    } else {
      const res = await getTopPlaylist(18, 'hot', plCat.value === '全部' ? '全部' : plCat.value)
      newPls = res.playlists || []
    }
    // Simple dedup by id
    const existing = new Set(catPlaylists.value.map(p => p.id))
    catPlaylists.value.push(...newPls.filter(p => !existing.has(p.id)))
    // Update cache with appended data
    cache.set('catPl_' + plCat.value, catPlaylists.value, CAT_PL_TTL)
  } catch {}
  finally { catLoading.value = false }
}

// ─── Genre Exploration functions ───
const GENRE_COLORS = [
  ['#ff6b6b','#ee5a24'], ['#a29bfe','#6c5ce7'], ['#fd79a8','#e84393'],
  ['#00cec9','#00b894'], ['#fdcb6e','#f39c12'], ['#74b9ff','#0984e3'],
  ['#55efc4','#00b894'], ['#fab1a0','#e17055'], ['#81ecec','#00cec9'],
  ['#dfe6e9','#b2bec3'], ['#ffeaa7','#fdcb6e'], ['#ff7675','#d63031'],
]
function genreBubbleStyle(tag) {
  const idx = (tag.tagId || 0) % GENRE_COLORS.length
  const [c1, c2] = GENRE_COLORS[idx]
  return { background: `linear-gradient(135deg, ${c1}, ${c2})` }
}
async function loadGenreTags() {
  // Use cache for instant display, refresh in background
  const cachedGenre = cache.get('genreTags')
  if (cachedGenre?.length) genreTags.value = cachedGenre
  const cachedPref = cache.get('genrePreference')
  if (cachedPref?.length) genrePreference.value = cachedPref

  try {
    const res = await getStyleList()
    // Filter to top-level tags (parentTagId === 0 or -1)
    const all = res.data || []
    genreTags.value = all.filter(t => !t.parentTagId || t.parentTagId === -1 || t.parentTagId === 0).slice(0, 20)
    if (!genreTags.value.length) genreTags.value = all.slice(0, 20)
    cache.set('genreTags', genreTags.value, CAT_PL_TTL)
  } catch {}
  // Load user preference
  if (userStore.isLoggedIn) {
    try {
      const pres = await getStylePreference()
      genrePreference.value = (pres.data?.tags || pres.data || []).slice(0, 5)
      cache.set('genrePreference', genrePreference.value, CAT_PL_TTL)
    } catch {}
  }
}
</script>

<style scoped>
.discover-search { position: relative; margin-bottom: 24px; }
.search-wrapper { position: relative; display: flex; align-items: center; }
.search-svg-icon { position: absolute; left: 16px; pointer-events: none; z-index: 1; }
.search-input { width: 100%; padding: 12px 40px 12px 44px; border-radius: var(--radius-full); background: var(--bg-tertiary); border: 1px solid var(--border); font-size: var(--font-base); transition: all var(--transition-fast); }
.search-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(236,65,65,0.1); }
.search-clear { position: absolute; right: 12px; color: var(--text-tertiary); cursor: pointer; }
.hot-search-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 16px; margin-top: 8px; z-index: 50; box-shadow: var(--shadow-lg); }
.hot-search-dropdown h4 { font-size: var(--font-sm); color: var(--text-tertiary); margin-bottom: 12px; }
.hot-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.hot-rank { font-size: var(--font-xs); font-weight: 700; margin-right: 4px; color: var(--text-tertiary); }
.hot-rank.top { color: var(--primary); }

/* Search suggestions dropdown */
.suggest-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 8px 0; margin-top: 8px; z-index: 50; box-shadow: var(--shadow-lg); max-height: 400px; overflow-y: auto; }
.suggest-group { padding: 4px 0; }
.suggest-group + .suggest-group { border-top: 1px solid var(--border); }
.suggest-group-title { font-size: var(--font-xs); color: var(--text-tertiary); padding: 6px 16px 4px; font-weight: 600; }
.suggest-item { display: flex; align-items: center; gap: 10px; padding: 8px 16px; cursor: pointer; font-size: var(--font-sm); transition: background var(--transition-fast); }
.suggest-item:hover { background: var(--bg-hover); }
.suggest-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.suggest-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }

/* Search tabs */
.search-tabs { display: flex; gap: 4px; margin-bottom: 16px; padding: 4px; background: var(--bg-tertiary); border-radius: var(--radius-full); width: fit-content; }
.search-tab { padding: 6px 16px; border-radius: var(--radius-full); font-size: var(--font-sm); font-weight: 500; color: var(--text-secondary); transition: all var(--transition-fast); cursor: pointer; }
.search-tab:hover { color: var(--text-primary); }
.search-tab.active { background: var(--bg-card); color: var(--text-primary); box-shadow: var(--shadow-sm); }

/* Best match */
.best-match { margin-bottom: 20px; padding: 16px; background: var(--bg-tertiary); border-radius: var(--radius-lg); }
.best-match-label { font-size: var(--font-xs); color: var(--text-tertiary); font-weight: 600; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
.best-match-card { display: flex; align-items: center; gap: 14px; padding: 10px; border-radius: var(--radius-md); cursor: pointer; transition: background var(--transition-fast); }
.best-match-card:hover { background: var(--bg-hover); }
.best-match-card + .best-match-card { margin-top: 6px; }
.best-match-avatar { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.best-match-name { font-weight: 600; font-size: var(--font-base); }
.best-match-meta { font-size: var(--font-xs); color: var(--text-tertiary); margin-top: 2px; }

/* Search result grid (albums, artists, playlists) */
.search-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; position: relative; }
.result-card { cursor: pointer; transition: transform var(--transition-fast); }
.result-card:hover { transform: translateY(-2px); }
.result-card-cover { position: relative; aspect-ratio: 1; border-radius: var(--radius-lg); overflow: hidden; background: var(--bg-tertiary); }
.result-card-cover.round { border-radius: 50%; }
.result-card-cover img { width: 100%; height: 100%; object-fit: cover; }
.result-card-name { font-size: var(--font-sm); font-weight: 600; margin-top: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.result-card-meta { font-size: var(--font-xs); color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* User result */
.user-result-item { display: flex; align-items: center; gap: 14px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.user-result-avatar { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.user-result-name { font-weight: 600; font-size: var(--font-sm); }
.user-result-sig { font-size: var(--font-xs); color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 400px; }

/* Search empty state */
.search-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 0; color: var(--text-tertiary); font-size: var(--font-sm); }

/* Banner: stacked carousel */
.banner-section { position: relative; margin-bottom: 24px; height: 240px; perspective: 800px; overflow: visible; }
.banner-track { position: relative; width: 100%; height: 100%; }
.banner-slide {
  position: absolute; top: 0; left: 50%; width: 70%; max-width: 800px; height: 100%;
  transform: translateX(-50%); transition: all 0.5s cubic-bezier(.4,0,.2,1);
  border-radius: var(--radius-xl); overflow: hidden; cursor: pointer; box-shadow: var(--shadow-md);
}
.banner-slide img { width: 100%; height: 100%; object-fit: cover; }
.banner-type-tag {
  position: absolute; bottom: 12px; right: 16px;
  padding: 4px 12px; border-radius: 20px;
  background: rgba(0,0,0,0.45); backdrop-filter: blur(8px);
  color: white; font-size: var(--font-xs); font-weight: 500;
  pointer-events: none;
}
.banner-slide.active { z-index: 3; transform: translateX(-50%) scale(1); opacity: 1; }
.banner-slide.prev { z-index: 2; transform: translateX(-90%) scale(0.88); opacity: 0.6; filter: brightness(0.7); }
.banner-slide.next { z-index: 2; transform: translateX(-10%) scale(0.88); opacity: 0.6; filter: brightness(0.7); }
.banner-slide.hidden { z-index: 1; transform: translateX(-50%) scale(0.75); opacity: 0; pointer-events: none; }
.banner-dots { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 10; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.4); cursor: pointer; transition: all var(--transition-fast); }
.dot.active { width: 20px; border-radius: 4px; background: white; }
.banner-arrow { position: absolute; top: 50%; transform: translateY(-50%); z-index: 10; width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity var(--transition-fast); }
.banner-section:hover .banner-arrow { opacity: 1; }
.banner-arrow-left { left: 12px; }
.banner-arrow-right { right: 12px; }

/* Small viewport: hide side-peek banners, widen active */
@media (max-width: 1100px) {
  .banner-slide { width: 88%; }
  .banner-slide.prev, .banner-slide.next {
    opacity: 0; pointer-events: none;
  }
}

/* Daily recommend */
.daily-nav { display: flex; align-items: center; gap: 8px; }
.daily-scroll-wrap { position: relative; }
.daily-scroll { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; padding: 4px 0; }
.daily-scroll::-webkit-scrollbar { display: none; }
.daily-scroll .song-card { scroll-snap-align: start; flex-shrink: 0; }
.scroll-arrow { position: absolute; top: 80px; transform: translateY(-50%); z-index: 5; width: 32px; height: 32px; border-radius: 50%; background: var(--bg-card); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm); opacity: 0; transition: opacity var(--transition-fast); color: var(--text-primary); }
.daily-scroll-wrap:hover .scroll-arrow { opacity: 1; }
.scroll-arrow-left { left: -16px; }
.scroll-arrow-right { right: -16px; }

.section { margin-bottom: 32px; }
.song-card { width: 160px; cursor: pointer; position: relative; flex-shrink: 0; }
.song-card-cover { position: relative; width: 160px; height: 160px; border-radius: var(--radius-lg); overflow: hidden; }
.song-card-cover img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--transition-slow); }
.song-card:hover .song-card-cover img { transform: scale(1.05); }
.song-card-cover .play-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity var(--transition-base); }
.song-card:hover .play-overlay { opacity: 1; }
.song-card-cover .play-btn, .card-cover .play-btn { width: 40px; height: 40px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 12px rgba(236,65,65,0.5); transition: transform var(--transition-fast); color: white; }
.song-card-cover .play-btn:hover, .card-cover .play-btn:hover { transform: scale(1.1); }
.song-card-info { padding: 8px 4px; }
.song-card-name { font-size: var(--font-sm); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.song-card-artist { font-size: var(--font-xs); color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.song-card-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; opacity: 0; transition: opacity var(--transition-fast); }
.song-card:hover .song-card-actions { opacity: 1; }
.action-btn-sm { width: 28px; height: 28px; border-radius: 50%; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; color: white; transition: transform var(--transition-fast); }
.action-btn-sm:hover { transform: scale(1.1); }
.action-btn-sm.liked { color: var(--primary-light); }
.card-playcount { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.5); color: white; font-size: var(--font-xs); padding: 2px 8px; border-radius: var(--radius-full); backdrop-filter: blur(4px); display: flex; align-items: center; gap: 4px; }

/* Playlist card: play btn click ≠ card click */
.card-cover .play-overlay { pointer-events: none; }
.card-cover .play-btn { pointer-events: auto; }

/* Daily scroll card entrance animations */
.daily-scroll .song-card {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
  transition: opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}
.daily-scroll .song-card.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}
/* Staggered delays for cards appearing in sequence */
.daily-scroll .song-card:nth-child(1) { transition-delay: 0s; }
.daily-scroll .song-card:nth-child(2) { transition-delay: 0.04s; }
.daily-scroll .song-card:nth-child(3) { transition-delay: 0.08s; }
.daily-scroll .song-card:nth-child(4) { transition-delay: 0.12s; }
.daily-scroll .song-card:nth-child(5) { transition-delay: 0.16s; }
.daily-scroll .song-card:nth-child(6) { transition-delay: 0.20s; }
.daily-scroll .song-card:nth-child(7) { transition-delay: 0.24s; }
.daily-scroll .song-card:nth-child(8) { transition-delay: 0.28s; }
.daily-scroll .song-card:nth-child(9) { transition-delay: 0.32s; }
.daily-scroll .song-card:nth-child(10) { transition-delay: 0.36s; }
.daily-scroll .song-card:nth-child(n+11) { transition-delay: 0.40s; }
</style>

<style scoped>
/* ─── Category Chips ─── */
.cat-chips-wrap { margin-bottom: 16px; overflow-x: auto; scrollbar-width: none; }
.cat-chips-wrap::-webkit-scrollbar { display: none; }
.cat-chips { display: flex; gap: 8px; padding: 2px 0; }
.cat-chip {
  padding: 6px 16px; border-radius: var(--radius-full); font-size: var(--font-sm); font-weight: 500;
  background: var(--bg-tertiary); color: var(--text-secondary); white-space: nowrap;
  transition: all var(--transition-fast); cursor: pointer; border: 1px solid transparent;
}
.cat-chip:hover { background: var(--bg-hover); color: var(--text-primary); }
.cat-chip.active {
  background: var(--primary); color: white; border-color: var(--primary);
  box-shadow: 0 2px 8px rgba(236,65,65,0.3);
}
.cat-chip.premium { font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.cat-chip.premium.active {
  background: linear-gradient(135deg, #f6d365, #fda085);
  border-color: #f6d365; color: #333;
  box-shadow: 0 2px 8px rgba(246,211,101,0.4);
}
.load-more-wrap {
  display: flex; justify-content: center; padding: 16px 0;
}

/* ─── Genre Bubbles ─── */
.genre-section { position: relative; }
.genre-bubbles {
  display: flex; flex-wrap: wrap; gap: 10px; padding: 4px 0;
}
.genre-bubble {
  padding: 8px 18px; border-radius: var(--radius-full);
  font-size: var(--font-sm); font-weight: 600; color: white;
  cursor: pointer; transition: all var(--transition-fast);
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
  border: none; white-space: nowrap;
}
.genre-bubble:hover { transform: scale(1.08); box-shadow: 0 4px 16px rgba(0,0,0,0.25); filter: brightness(1.1); }
.genre-pref {
  display: flex; align-items: center; gap: 10px; margin-top: 14px;
  padding: 10px 14px; background: rgba(255,255,255,0.04); border-radius: var(--radius-md);
}
.genre-pref-label { font-size: var(--font-xs); color: var(--text-tertiary); white-space: nowrap; }
.genre-pref-tag {
  padding: 4px 12px; border-radius: var(--radius-full);
  font-size: var(--font-xs); font-weight: 600;
  background: rgba(236,65,65,0.15); color: var(--primary-light);
  cursor: pointer; transition: all var(--transition-fast);
}
.genre-pref-tag:hover { background: rgba(236,65,65,0.3); }

/* ── Skeleton Placeholders ── */
.skel-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.skel-daily-scroll {
  display: flex;
  gap: 12px;
  overflow: hidden;
  padding: 4px 0;
}
.skel-song-card {
  width: 156px;
  flex-shrink: 0;
}
.skel-song-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
}
</style>
