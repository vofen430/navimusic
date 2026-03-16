import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getLoginStatus, getUserAccount, getUserPlaylists, getLikeList, logout as apiLogout } from '../api'

export const useUserStore = defineStore('user', () => {
  const isLoggedIn = ref(false)
  const profile = ref(null)
  const userId = ref(null)
  const playlists = ref([])
  const likeList = ref([])  // liked song IDs
  const showLoginModal = ref(false)

  const myPlaylists = computed(() =>
    playlists.value.filter(p => p.userId === userId.value)
  )

  const subscribedPlaylists = computed(() =>
    playlists.value.filter(p => p.userId !== userId.value)
  )

  async function checkLoginStatus() {
    try {
      const res = await getLoginStatus()
      if (res.data?.profile) {
        isLoggedIn.value = true
        profile.value = res.data.profile
        userId.value = res.data.profile.userId
        await fetchPlaylists()
        await fetchLikeList()
      }
    } catch (e) {
      console.warn('Not logged in')
    }
  }

  async function fetchPlaylists() {
    if (!userId.value) return
    try {
      const res = await getUserPlaylists(userId.value, 100)
      playlists.value = res.playlist || []
    } catch (e) {
      console.error('Failed to fetch playlists:', e)
    }
  }

  async function fetchLikeList() {
    if (!userId.value) return
    try {
      const res = await getLikeList(userId.value)
      likeList.value = res.ids || []
    } catch (e) {
      console.error('Failed to fetch like list:', e)
    }
  }

  function isLiked(songId) {
    return likeList.value.includes(songId)
  }

  async function onLoginSuccess(profileData) {
    isLoggedIn.value = true
    profile.value = profileData
    userId.value = profileData.userId
    showLoginModal.value = false
    await fetchPlaylists()
    await fetchLikeList()
  }

  async function logout() {
    try {
      await apiLogout()
    } catch {}
    isLoggedIn.value = false
    profile.value = null
    userId.value = null
    playlists.value = []
    likeList.value = []
  }

  return {
    isLoggedIn, profile, userId, playlists, likeList, showLoginModal,
    myPlaylists, subscribedPlaylists,
    checkLoginStatus, fetchPlaylists, fetchLikeList, isLiked,
    onLoginSuccess, logout
  }
})
