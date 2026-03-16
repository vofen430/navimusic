<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal comment-modal">
        <div class="modal-header">
          <h2 class="modal-title">评论 ({{ total }})</h2>
          <button class="modal-close" @click="$emit('close')">
            <Icon name="x" :size="18" />
          </button>
        </div>

        <div class="modal-body comment-body">
          <!-- Hot comments -->
          <div v-if="hotComments.length" class="comment-section">
            <h3 class="comment-section-title">精彩评论</h3>
            <div v-for="c in hotComments" :key="c.commentId" class="comment-item">
              <img class="comment-avatar" :src="c.user?.avatarUrl + '?param=60y60'" alt="" />
              <div class="comment-content">
                <div class="comment-user">{{ c.user?.nickname }}</div>
                <div class="comment-text">{{ c.content }}</div>
                <div class="comment-meta">
                  <span>{{ formatDate(c.time) }}</span>
                  <span>{{ c.likedCount }} 赞</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Latest comments -->
          <div class="comment-section">
            <h3 class="comment-section-title">最新评论</h3>
            <div v-if="loading" class="page-loading"><div class="loading-spinner"></div></div>
            <div v-for="c in comments" :key="c.commentId" class="comment-item">
              <img class="comment-avatar" :src="c.user?.avatarUrl + '?param=60y60'" alt="" />
              <div class="comment-content">
                <div class="comment-user">{{ c.user?.nickname }}</div>
                <div class="comment-text">{{ c.content }}</div>
                <div class="comment-meta">
                  <span>{{ formatDate(c.time) }}</span>
                  <span>{{ c.likedCount }} 赞</span>
                </div>
              </div>
            </div>
            <button v-if="hasMore" class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px;" @click="loadMore">
              加载更多
            </button>
          </div>

          <div v-if="!loading && !comments.length && !hotComments.length" class="empty-state">
            <div class="empty-text">暂无评论</div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Icon from './Icon.vue'
import api from '../api'

const props = defineProps({
  songId: { type: Number, required: true }
})

defineEmits(['close'])

const total = ref(0)
const hotComments = ref([])
const comments = ref([])
const loading = ref(true)
const hasMore = ref(false)
const page = ref(1)

onMounted(() => loadComments())

async function loadComments() {
  loading.value = true
  try {
    const res = await api.get('/comment/new', {
      params: { type: 0, id: props.songId, sortType: 1, pageSize: 20, pageNo: page.value }
    })
    const data = res.data || res
    total.value = data.totalCount || 0
    if (page.value === 1) {
      hotComments.value = data.hotComments || []
    }
    comments.value = [...comments.value, ...(data.comments || [])]
    hasMore.value = data.hasMore || false
  } catch (e) {
    console.error('Failed to load comments:', e)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  page.value++
  loadComments()
}

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`
}
</script>

<style scoped>
.comment-modal {
  max-width: 560px;
  max-height: 80vh;
}

.comment-body {
  padding: 0 24px 20px;
}

.comment-section {
  margin-bottom: 12px;
}

.comment-section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-tertiary);
  margin-bottom: 10px;
  padding-top: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.comment-item {
  display: flex;
  gap: 12px;
  padding: 14px 8px;
  border-radius: 12px;
  transition: background 0.2s ease;
  margin-bottom: 2px;
}
.comment-item:hover {
  background: var(--bg-hover);
}

.comment-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid var(--border);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.comment-content { flex: 1; min-width: 0; }

.comment-user {
  font-size: 12px;
  font-weight: 700;
  color: var(--primary-light);
  margin-bottom: 4px;
}

.comment-text {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.6;
  word-break: break-word;
}

.comment-meta {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-tertiary);
}
</style>
