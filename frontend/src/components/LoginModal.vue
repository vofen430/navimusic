<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal login-modal">
        <div class="modal-header">
          <h2 class="modal-title">登录网易云音乐</h2>
          <button class="modal-close" @click="$emit('close')"><Icon name="x" :size="18" /></button>
        </div>
        <div class="modal-body">
          <div class="login-tabs">
            <button class="login-tab" :class="{ active: tab === 'qr' }" @click="tab = 'qr'; initQR()">扫码登录</button>
            <button class="login-tab" :class="{ active: tab === 'phone' }" @click="tab = 'phone'">手机登录</button>
          </div>
          <div v-if="tab === 'qr'" class="qr-section">
            <div class="qr-container">
              <img v-if="qrImg" :src="qrImg" alt="QR Code" class="qr-image" />
              <div v-else class="qr-placeholder"><div class="loading-spinner"></div></div>
            </div>
            <p class="qr-hint">{{ qrStatus }}</p>
            <button v-if="qrExpired" class="btn btn-ghost btn-sm" @click="initQR()">刷新二维码</button>
          </div>
          <div v-if="tab === 'phone'" class="phone-section">
            <div class="form-group"><label>手机号</label><input v-model="phone" type="tel" placeholder="请输入手机号" /></div>
            <div class="form-group"><label>密码</label><input v-model="password" type="password" placeholder="请输入密码" /></div>
            <button class="btn btn-primary" style="width:100%;margin-top:16px;" :disabled="!phone || !password || isLoading" @click="loginByPhoneAction">
              {{ isLoading ? '登录中...' : '登录' }}
            </button>
          </div>
          <p v-if="errorMsg" class="login-error">{{ errorMsg }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '../stores/user'
import { loginByPhone, getQRKey, createQR, checkQR, getLoginStatus } from '../api'
import Icon from './Icon.vue'

const emit = defineEmits(['close'])
const userStore = useUserStore()
const tab = ref('qr')
const phone = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMsg = ref('')
const qrImg = ref('')
const qrKey = ref('')
const qrStatus = ref('请使用网易云音乐APP扫码登录')
const qrExpired = ref(false)
let qrTimer = null

onMounted(() => initQR())
onUnmounted(() => { if (qrTimer) clearInterval(qrTimer) })

async function initQR() {
  qrExpired.value = false; qrStatus.value = '正在生成二维码...'; qrImg.value = ''
  if (qrTimer) clearInterval(qrTimer)
  try {
    const keyRes = await getQRKey(); qrKey.value = keyRes.data?.unikey
    if (!qrKey.value) { qrStatus.value = '获取二维码失败'; return }
    const qrRes = await createQR(qrKey.value); qrImg.value = qrRes.data?.qrimg
    qrStatus.value = '请使用网易云音乐APP扫码登录'
    qrTimer = setInterval(async () => {
      try {
        const checkRes = await checkQR(qrKey.value)
        if (checkRes.code === 800) { qrStatus.value = '二维码已过期'; qrExpired.value = true; clearInterval(qrTimer) }
        else if (checkRes.code === 801) { qrStatus.value = '等待扫码...' }
        else if (checkRes.code === 802) { qrStatus.value = '请在手机上确认登录' }
        else if (checkRes.code === 803) {
          qrStatus.value = '登录成功！'; clearInterval(qrTimer)
          const statusRes = await getLoginStatus()
          if (statusRes.data?.profile) { userStore.onLoginSuccess(statusRes.data.profile); window.__toast?.('登录成功', 'success'); emit('close') }
        }
      } catch {}
    }, 2000)
  } catch (e) { qrStatus.value = '二维码生成失败' }
}

async function loginByPhoneAction() {
  isLoading.value = true; errorMsg.value = ''
  try {
    const res = await loginByPhone(phone.value, password.value)
    if (res.code === 200 && res.profile) { userStore.onLoginSuccess(res.profile); window.__toast?.('登录成功', 'success'); emit('close') }
    else { errorMsg.value = res.message || '登录失败' }
  } catch (e) { errorMsg.value = e.response?.data?.message || '登录失败，请检查账号密码' }
  finally { isLoading.value = false }
}
</script>

<style scoped>
.login-modal { max-width: 400px; }
.login-tabs { display: flex; gap: 0; margin-bottom: 24px; border-radius: var(--radius-md); background: var(--bg-tertiary); padding: 4px; }
.login-tab { flex: 1; padding: 10px; border-radius: var(--radius-sm); font-weight: 600; font-size: var(--font-sm); color: var(--text-secondary); transition: all var(--transition-fast); }
.login-tab.active { background: var(--bg-card); color: var(--text-primary); box-shadow: var(--shadow-sm); }
.qr-section { display: flex; flex-direction: column; align-items: center; padding: 16px 0; }
.qr-container { width: 200px; height: 200px; background: white; border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
.qr-image { width: 180px; height: 180px; }
.qr-placeholder { display: flex; align-items: center; justify-content: center; }
.qr-hint { color: var(--text-secondary); font-size: var(--font-sm); margin-bottom: 12px; }
.phone-section { padding: 8px 0; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: var(--font-sm); font-weight: 500; color: var(--text-secondary); margin-bottom: 6px; }
.form-group input { width: 100%; }
.login-error { color: var(--error); font-size: var(--font-sm); text-align: center; margin-top: 12px; }
</style>
