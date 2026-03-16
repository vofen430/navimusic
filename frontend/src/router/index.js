import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'discover',
    component: () => import('../views/DiscoverView.vue'),
    meta: { title: '发现', icon: 'compass' }
  },
  {
    path: '/playlists',
    name: 'playlists',
    component: () => import('../views/PlaylistsView.vue'),
    meta: { title: '歌单', icon: 'list-music' }
  },
  {
    path: '/downloads',
    name: 'downloads',
    component: () => import('../views/DownloadsView.vue'),
    meta: { title: '下载', icon: 'download' }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { title: '设置', icon: 'settings' }
  },
  {
    path: '/genre/:tagId',
    name: 'genre',
    component: () => import('../views/GenreView.vue'),
    meta: { title: '曲风' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
