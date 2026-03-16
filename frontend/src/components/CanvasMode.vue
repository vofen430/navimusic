<template>
  <div class="canvas-mode" ref="canvasRef" @mousemove="onCanvasMouseMove" @mouseleave="edgeDir = ''">
    <!-- Background: thumbnail placeholder (instant, blurred) -->
    <img v-if="canvasStore.currentWallpaper?.thumb_data"
      :key="'thumb-' + canvasStore.currentWallpaper?.id"
      class="canvas-bg canvas-bg-thumb" :src="canvasStore.currentWallpaper.thumb_data" alt="" />
    <!-- Background: full-res wallpaper (crossfade in) -->
    <Transition name="canvas-bg-fade">
      <img v-if="canvasStore.currentFull" :key="canvasStore.currentWallpaper?.id"
        class="canvas-bg" :src="canvasStore.currentFull" alt="" />
    </Transition>
    <div class="canvas-bg-fallback" v-if="!canvasStore.currentFull && !canvasStore.currentWallpaper?.thumb_data"></div>

    <!-- Snap guide lines -->
    <div class="snap-line snap-h" v-show="snapH" :style="{ top: snapH + '%' }"></div>
    <div class="snap-line snap-v" v-show="snapV" :style="{ left: snapV + '%' }"></div>

    <!-- Draggable text elements -->
    <div v-for="key in elementKeys" :key="key"
      class="canvas-el" :class="{ selected: canvasStore.selectedElement === key && !layoutLocked, dragging: draggingKey === key }"
      :style="elStyle(key)"
      @mousedown.prevent="!layoutLocked && startDrag($event, key)"
      @dblclick="!layoutLocked && key === 'custom' && startEdit()"
      @click.stop="!layoutLocked && (canvasStore.selectedElement = key)">
      <!-- Content -->
      <template v-if="key === 'lyric'">
        <div class="lyric-container">
          <div class="lyric-slot" :class="{ visible: lyricSlot === 0 }">
            <span>{{ lyricSlots[0].text }}</span>
            <span v-if="lyricSlots[0].trans" class="lyric-trans-canvas">{{ lyricSlots[0].trans }}</span>
          </div>
          <div class="lyric-slot" :class="{ visible: lyricSlot === 1 }">
            <span>{{ lyricSlots[1].text }}</span>
            <span v-if="lyricSlots[1].trans" class="lyric-trans-canvas">{{ lyricSlots[1].trans }}</span>
          </div>
        </div>
      </template>
      <template v-else-if="key === 'title'">{{ playerStore.currentSong?.name || '未播放' }}</template>
      <template v-else-if="key === 'artist'">{{ artistName }}</template>
      <template v-else-if="key === 'custom'">
        <input v-if="editingCustom" ref="customInputRef" class="custom-edit-input"
          v-model="canvasStore.customText" @blur="endEdit" @keydown.enter="endEdit"
          :style="{ fontSize: canvasStore.elements.custom.size + 'px', color: canvasStore.elements.custom.color }" />
        <span v-else>{{ canvasStore.customText }}</span>
      </template>

      <!-- Floating toolbar (selected, unlocked) -->
      <Transition name="toolbar-pop">
        <div v-if="canvasStore.selectedElement === key && !draggingKey && !layoutLocked" class="el-toolbar" @mousedown.stop>
          <button class="tb-btn" @click="changeAlign(key, 'left')" :class="{ active: el(key).align === 'left' }">
            <Icon name="align-left" :size="13" />
          </button>
          <button class="tb-btn" @click="changeAlign(key, 'center')" :class="{ active: el(key).align === 'center' }">
            <Icon name="align-center" :size="13" />
          </button>
          <button class="tb-btn" @click="changeAlign(key, 'right')" :class="{ active: el(key).align === 'right' }">
            <Icon name="align-right" :size="13" />
          </button>
          <div class="tb-sep"></div>
          <button class="tb-btn" @click="adjustSize(key, -2)"><Icon name="minus" :size="13" /></button>
          <span v-if="editingSizeKey !== key" class="tb-size" @dblclick.stop="startSizeEdit(key)">{{ el(key).size }}</span>
          <input v-else class="tb-size-input" type="number" :value="el(key).size"
            @keydown.enter="commitSizeEdit(key, $event)" @blur="commitSizeEdit(key, $event)"
            ref="sizeInputRef" min="10" max="120" @mousedown.stop />
          <button class="tb-btn" @click="adjustSize(key, 2)"><Icon name="plus" :size="13" /></button>
        </div>
      </Transition>

      <!-- Edge resize handles -->
      <template v-if="canvasStore.selectedElement === key && !draggingKey && !layoutLocked">
        <div class="resize-handle resize-r" @mousedown.prevent.stop="startResize($event, key, 'r')"></div>
        <div class="resize-handle resize-l" @mousedown.prevent.stop="startResize($event, key, 'l')"></div>
        <div class="resize-handle resize-b" @mousedown.prevent.stop="startResize($event, key, 'b')"></div>
        <div class="resize-handle resize-t" @mousedown.prevent.stop="startResize($event, key, 't')"></div>
      </template>
    </div>

    <!-- Color palette (bottom-left) -->
    <div class="color-palette" @mousedown.stop>
      <div v-for="(c, i) in paletteColors" :key="i"
        class="palette-dot" :class="{ active: canvasStore.selectedElement && el(canvasStore.selectedElement).color === c }"
        :style="{ background: c }"
        @click="applyColor(c)"></div>
      <div class="palette-dot palette-custom-dot"
        @click="showColorPicker = !showColorPicker">
      </div>
      <!-- Color picker panel -->
      <Transition name="picker-pop">
        <div v-if="showColorPicker" class="color-picker-panel">
          <div class="picker-sv-area">
            <canvas ref="svCanvasRef" class="picker-sv-canvas" width="200" height="140"
              @mousedown="onSvDown"></canvas>
            <div class="picker-sv-cursor" :style="svCursorStyle"></div>
            <div ref="hueBarRef" class="picker-hue-bar" @mousedown="onHueDown">
              <div class="picker-hue-thumb" :style="{ top: hue / 360 * 100 + '%' }"></div>
            </div>
          </div>
          <div class="picker-hex-bar">
            <span class="picker-hex-prefix">#</span>
            <input class="picker-hex-field" maxlength="6" :value="hexDisplay"
              @input="onHexInput($event)" @keydown.enter="applyCustomColor"
              placeholder="FF5500" spellcheck="false" />
            <div class="picker-swatch" :style="{ background: customColor }"></div>
          </div>
          <button class="picker-apply-btn" @click="applyCustomColor">
            <span>应用颜色</span>
          </button>
        </div>
      </Transition>
    </div>

    <!-- Top-right toolbar -->
    <div class="canvas-top-bar" @mousedown.stop>
      <button class="top-btn" :class="{ active: layoutLocked }" @click="toggleLock" :title="layoutLocked ? '解锁布局' : '锁定布局'">
        <Icon :name="layoutLocked ? 'lock' : 'unlock'" :size="16" />
      </button>
      <button class="top-btn" @click="showGallery = !showGallery; showSettingsMenu = false; showFontMenu = false" title="图库">
        <Icon name="image" :size="18" />
      </button>
      <button class="top-btn" @click="showSettingsMenu = !showSettingsMenu; showGallery = false; showFontMenu = false" title="设置">
        <Icon name="more-vertical" :size="18" />
      </button>
      <!-- Settings dropdown -->
      <Transition name="panel-slide">
        <div v-if="showSettingsMenu" class="settings-dropdown">
          <div class="settings-item" @click="showFontMenu = !showFontMenu; showSettingsMenu = false; showGallery = false">
            <Icon name="type" :size="14" /><span>字体设置</span>
          </div>
          <div class="settings-item" @click="toggleDesktopMode">
            <Icon name="monitor" :size="14" /><span>{{ desktopMode ? '退出桌面壁纸' : '桌面壁纸模式' }}</span>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Bottom-right exit button -->
    <button class="canvas-exit-btn" @click="$emit('exit')" title="退出画境">
      <Icon name="log-out" :size="18" />
    </button>

    <!-- Font menu -->
    <Transition name="panel-slide">
      <div v-if="showFontMenu" class="font-panel" @mousedown.stop>
        <h4 class="panel-title">字体设置</h4>
        <div v-for="key in elementKeys" :key="key" class="font-row">
          <span class="font-label-tag">{{ elLabels[key] }}</span>
          <div class="font-row-controls">
            <button class="shadow-toggle" :class="{ off: !el(key).shadow }" @click="canvasStore.updateElement(key, { shadow: !el(key).shadow })" :title="el(key).shadow ? '关闭阴影' : '开启阴影'">
              <Icon :name="el(key).shadow ? 'sun' : 'moon'" :size="12" />
            </button>
            <div class="font-dropdown-wrap">
              <button class="font-current" @click="toggleFontDropdown(key)" :style="{ fontFamily: el(key).font }">
                {{ fontDisplayName(el(key).font) }}
                <Icon name="chevron-down" :size="10" />
              </button>
              <Transition name="panel-slide">
                <div v-if="openFontDropdown === key" class="font-dropdown">
                  <div class="font-opt" :class="{ active: el(key).font === 'inherit' }" @click="pickFont(key, 'inherit')">默认</div>
                  <div class="font-group-label">内置字体</div>
                  <div v-for="bf in builtinFonts" :key="bf.value" class="font-opt"
                    :class="{ active: el(key).font === bf.value }"
                    :style="{ fontFamily: bf.family }"
                    @click="pickFont(key, bf.value)">{{ bf.label }}</div>
                  <div class="font-group-label">系统字体</div>
                  <div v-for="f in systemFonts" :key="f" class="font-opt"
                    :class="{ active: el(key).font === f }"
                    :style="{ fontFamily: f }"
                    @click="pickFont(key, f)">{{ f }}</div>
                </div>
              </Transition>
            </div>
          </div>
        </div>
        <button class="reset-btn" @click="canvasStore.resetLayout()">重置布局</button>
      </div>
    </Transition>

        <!-- Gallery panel -->
    <Transition name="panel-slide">
      <div v-if="showGallery" class="gallery-panel" @mousedown.stop>
        <h4 class="panel-title">图库
          <button class="top-btn" @click="randomSwitch" title="随机"><Icon name="shuffle" :size="16" /></button>
        </h4>
        <div class="gallery-grid">
          <div v-for="(wp, i) in galleryPageItems" :key="wp.id"
            class="gallery-item" :class="{ active: canvasStore.currentIndex === (galleryPage * 9 + i) }"
            @click="canvasStore.selectWallpaper(galleryPage * 9 + i)">
            <img :src="wp.thumb_data" alt="" />
            <button class="gallery-del" @click.stop="canvasStore.deleteWallpaper(wp.id)">
              <Icon name="x" :size="10" />
            </button>
          </div>
        </div>
        <div v-if="galleryTotalPages > 1" class="gallery-pager">
          <button class="gallery-pager-btn" @click="galleryPage = Math.max(0, galleryPage - 1)" :disabled="galleryPage === 0">
            <Icon name="chevron-left" :size="14" />
          </button>
          <span class="gallery-pager-num">{{ galleryPage + 1 }} / {{ galleryTotalPages }}</span>
          <button class="gallery-pager-btn" @click="galleryPage = Math.min(galleryTotalPages - 1, galleryPage + 1)" :disabled="galleryPage >= galleryTotalPages - 1">
            <Icon name="chevron-right" :size="14" />
          </button>
        </div>
        <label class="import-btn">
          <Icon name="plus" :size="16" /> 导入壁纸
          <input type="file" accept="image/*" multiple class="hidden-file" @change="importWallpapers" />
        </label>
      </div>
    </Transition>

    <!-- Edge navigation arrows -->
    <Transition name="edge-fade">
      <button v-if="edgeDir === 'left'" class="edge-arrow edge-left" @click="canvasStore.prevWallpaper()">
        <Icon name="chevron-left" :size="28" />
      </button>
    </Transition>
    <Transition name="edge-fade">
      <button v-if="edgeDir === 'right'" class="edge-arrow edge-right" @click="canvasStore.nextWallpaper()">
        <Icon name="chevron-right" :size="28" />
      </button>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useCanvasStore } from '../stores/canvas'
import Icon from './Icon.vue'

defineEmits(['exit'])
const playerStore = usePlayerStore()
const canvasStore = useCanvasStore()

const canvasRef = ref(null)
const customInputRef = ref(null)
const svCanvasRef = ref(null)
const hueBarRef = ref(null)
const showGallery = ref(false)
const showFontMenu = ref(false)
const showColorPicker = ref(false)
const showSettingsMenu = ref(false)
const desktopMode = ref(false)
function toggleDesktopMode() {
  desktopMode.value = !desktopMode.value
  if (window.electronAPI?.setDesktopMode) {
    window.electronAPI.setDesktopMode(desktopMode.value)
  }
  showSettingsMenu.value = false
}
const layoutLocked = ref(localStorage.getItem('canvas-layout-locked') === 'true')
function toggleLock() {
  layoutLocked.value = !layoutLocked.value
  localStorage.setItem('canvas-layout-locked', layoutLocked.value)
  if (layoutLocked.value) canvasStore.selectedElement = null
}
const editingCustom = ref(false)
const edgeDir = ref('')
const draggingKey = ref(null)
const snapH = ref(0)
const snapV = ref(0)

// System font detection
const systemFonts = ref([])
const openFontDropdown = ref(null) // which element key's dropdown is open

const builtinFonts = [
  { value: "'TGS Perfect Condensed'", family: 'TGS Perfect Condensed', label: 'TGS Perfect' },
  { value: "'Franklin Gothic Medium'", family: 'Franklin Gothic Medium', label: 'Franklin Gothic' },
]

function toggleFontDropdown(key) {
  openFontDropdown.value = openFontDropdown.value === key ? null : key
}
function pickFont(key, fontValue) {
  canvasStore.updateElement(key, { font: fontValue })
  openFontDropdown.value = null
}
function fontDisplayName(fontVal) {
  if (fontVal === 'inherit') return '默认'
  const bf = builtinFonts.find(f => f.value === fontVal)
  if (bf) return bf.label
  return fontVal
}

async function detectFonts() {
  if ('queryLocalFonts' in window) {
    try {
      const fonts = await window.queryLocalFonts()
      const families = new Set()
      for (const f of fonts) families.add(f.family)
      systemFonts.value = [...families].sort((a, b) => a.localeCompare(b)).slice(0, 100)
      return
    } catch (e) {
      console.warn('Font access denied:', e)
    }
  }
  // Fallback: common fonts
  systemFonts.value = [
    'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana',
    'Trebuchet MS', 'Impact', 'Comic Sans MS', 'Palatino',
    'Microsoft YaHei', 'SimSun', 'KaiTi', 'FangSong',
    'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', 'Noto Serif SC',
  ]
}

const elementKeys = ['title', 'artist', 'custom', 'lyric']
const elLabels = { title: '歌名', artist: '歌手', custom: '自定义', lyric: '歌词' }
const el = (key) => canvasStore.elements[key]

const artistName = computed(() => playerStore.currentSong?.ar?.map(a => a.name).join(', ') || '')

// Lyrics cross-fade — dual-slot approach for rock-solid positioning
const lyricSlot = ref(0)  // 0 or 1 — which slot is visible
const lyricSlots = ref([
  { text: '', trans: '' },
  { text: '', trans: '' },
])

watch(() => playerStore.currentLyricIndex, (idx) => {
  const text = playerStore.lyrics[idx]?.text || ''
  const trans = playerStore.lyrics[idx]?.tText || ''
  // Write into the HIDDEN slot, then flip visibility
  const nextSlot = lyricSlot.value === 0 ? 1 : 0
  lyricSlots.value[nextSlot] = { text, trans }
  lyricSlot.value = nextSlot
}, { immediate: true })

// Palette colors (4 from wallpaper + white)
const paletteColors = computed(() => {
  const pal = canvasStore.currentPalette.map(c => `rgb(${c})`)
  while (pal.length < 4) pal.push('#ffffff')
  return pal.slice(0, 4)
})

function applyColor(color) {
  const key = canvasStore.selectedElement
  if (key) canvasStore.updateElement(key, { color })
}
function applyCustomColor() {
  applyColor(customColor.value)
  showColorPicker.value = false
}

// ─── HSV Color picker ───
const hue = ref(0)
const sat = ref(1)
const val = ref(1)

function hsvToHex(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
  }
  return '#' + [f(5), f(3), f(1)].map(x => x.toString(16).padStart(2, '0')).join('')
}
function hexToHsv(hex) {
  const r = parseInt(hex.slice(1,3), 16) / 255
  const g = parseInt(hex.slice(3,5), 16) / 255
  const b = parseInt(hex.slice(5,7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

const customColor = computed(() => hsvToHex(hue.value, sat.value, val.value))
const hexDisplay = computed(() => customColor.value.replace('#', '').toUpperCase())

const svCursorStyle = computed(() => ({
  left: sat.value * 100 + '%',
  top: (1 - val.value) * 100 + '%',
}))

function drawSvCanvas() {
  const cvs = svCanvasRef.value
  if (!cvs) return
  const ctx = cvs.getContext('2d')
  const w = cvs.width, h = cvs.height
  // Base hue fill
  ctx.fillStyle = `hsl(${hue.value}, 100%, 50%)`
  ctx.fillRect(0, 0, w, h)
  // White→transparent gradient (left→right = saturation)
  const gW = ctx.createLinearGradient(0, 0, w, 0)
  gW.addColorStop(0, '#ffffff')
  gW.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gW
  ctx.fillRect(0, 0, w, h)
  // Transparent→black gradient (top→bottom = value)
  const gB = ctx.createLinearGradient(0, 0, 0, h)
  gB.addColorStop(0, 'rgba(0,0,0,0)')
  gB.addColorStop(1, '#000000')
  ctx.fillStyle = gB
  ctx.fillRect(0, 0, w, h)
}

watch([hue, () => showColorPicker.value], () => {
  if (showColorPicker.value) nextTick(drawSvCanvas)
})

// SV drag
function onSvDown(e) {
  updateSvFromEvent(e)
  const onMove = (ev) => updateSvFromEvent(ev)
  const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
function updateSvFromEvent(e) {
  const cvs = svCanvasRef.value
  if (!cvs) return
  const rect = cvs.getBoundingClientRect()
  sat.value = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  val.value = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height))
}

// Hue drag
function onHueDown(e) {
  updateHueFromBar(e)
  const onMove = (ev) => updateHueFromBar(ev)
  const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
function updateHueFromBar(e) {
  const bar = hueBarRef.value
  if (!bar) return
  const rect = bar.getBoundingClientRect()
  hue.value = Math.max(0, Math.min(360, (e.clientY - rect.top) / rect.height * 360))
}

function onHexInput(e) {
  let v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
  if (v.length === 6) {
    const hsv = hexToHsv('#' + v)
    hue.value = hsv.h
    sat.value = hsv.s
    val.value = hsv.v
  }
}
function changeAlign(key, align) { canvasStore.updateElement(key, { align }) }
function adjustSize(key, delta) {
  const cur = el(key).size
  canvasStore.updateElement(key, { size: Math.max(10, Math.min(120, cur + delta)) })
}

// ─── Element style ───
function elStyle(key) {
  const e = el(key)
  return {
    left: e.x + '%', top: e.y + '%',
    fontSize: e.size + 'px',
    color: e.color,
    fontFamily: e.font,
    textAlign: e.align,
    transform: e.align === 'center' ? 'translateX(-50%)' : e.align === 'right' ? 'translateX(-100%)' : 'none',
    textShadow: e.shadow ? '0 2px 12px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4)' : 'none',
  }
}

// ─── Drag system with snap ───
let dragStart = null
function startDrag(e, key) {
  canvasStore.selectedElement = key
  draggingKey.value = key
  const rect = canvasRef.value.getBoundingClientRect()
  dragStart = {
    mx: e.clientX, my: e.clientY,
    ox: el(key).x, oy: el(key).y,
    rw: rect.width, rh: rect.height,
  }
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', endDrag)
}
function onDrag(e) {
  if (!dragStart || !draggingKey.value) return
  const dx = (e.clientX - dragStart.mx) / dragStart.rw * 100
  const dy = (e.clientY - dragStart.my) / dragStart.rh * 100
  let nx = dragStart.ox + dx
  let ny = dragStart.oy + dy
  nx = Math.max(0, Math.min(100, nx))
  ny = Math.max(0, Math.min(100, ny))

  // Snap to center lines
  const SNAP = 1.5
  snapH.value = 0; snapV.value = 0
  if (Math.abs(ny - 50) < SNAP) { ny = 50; snapH.value = 50 }
  if (Math.abs(nx - 50) < SNAP) { nx = 50; snapV.value = 50 }

  // Snap to other elements
  for (const ok of elementKeys) {
    if (ok === draggingKey.value) continue
    const oe = el(ok)
    if (Math.abs(ny - oe.y) < SNAP) { ny = oe.y; snapH.value = oe.y }
    if (Math.abs(nx - oe.x) < SNAP) { nx = oe.x; snapV.value = oe.x }
  }

  canvasStore.updateElement(draggingKey.value, { x: nx, y: ny })
}
function endDrag() {
  draggingKey.value = null
  snapH.value = 0; snapV.value = 0
  dragStart = null
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', endDrag)
}

// ─── Custom text edit ───
function startEdit() {
  editingCustom.value = true
  nextTick(() => customInputRef.value?.[0]?.focus())
}
function endEdit() {
  editingCustom.value = false
  canvasStore.saveLayout()
}

// ─── Inline size editing ───
const editingSizeKey = ref(null)
const sizeInputRef = ref(null)
function startSizeEdit(key) {
  editingSizeKey.value = key
  nextTick(() => {
    const inp = Array.isArray(sizeInputRef.value) ? sizeInputRef.value[0] : sizeInputRef.value
    if (inp) { inp.focus(); inp.select() }
  })
}
function commitSizeEdit(key, e) {
  const v = parseInt(e.target.value)
  if (!isNaN(v)) canvasStore.updateElement(key, { size: Math.max(10, Math.min(120, v)) })
  editingSizeKey.value = null
}

// ─── Edge resize ───
let resizeStart = null
function startResize(e, key, dir) {
  resizeStart = { mx: e.clientX, my: e.clientY, size: el(key).size, key, dir }
  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', endResize)
}
function onResize(e) {
  if (!resizeStart) return
  const { mx, my, size, key, dir } = resizeStart
  let delta = 0
  if (dir === 'r') delta = e.clientX - mx
  else if (dir === 'l') delta = mx - e.clientX
  else if (dir === 'b') delta = e.clientY - my
  else if (dir === 't') delta = my - e.clientY
  const newSize = Math.max(10, Math.min(120, Math.round(size + delta * 0.3)))
  canvasStore.updateElement(key, { size: newSize })
}
function endResize() {
  resizeStart = null
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', endResize)
}

// ─── Edge arrows ───
function onCanvasMouseMove(e) {
  if (draggingKey.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const px = (e.clientX - rect.left) / rect.width
  if (px < 0.05) edgeDir.value = 'left'
  else if (px > 0.95) edgeDir.value = 'right'
  else edgeDir.value = ''
}
function randomSwitch() { canvasStore.randomWallpaper() }

// ─── Gallery pagination ───
const galleryPage = ref(0)
const galleryTotalPages = computed(() => Math.max(1, Math.ceil(canvasStore.wallpapers.length / 9)))
const galleryPageItems = computed(() => {
  const start = galleryPage.value * 9
  return canvasStore.wallpapers.slice(start, start + 9)
})

// ─── Import wallpapers (multi-select) ───
async function importWallpapers(e) {
  const files = Array.from(e.target.files || [])
  if (!files.length) return
  for (const file of files) {
    await importSingleWallpaper(file)
  }
  e.target.value = ''
  // Jump to last page to show newly added
  galleryPage.value = galleryTotalPages.value - 1
}
function importSingleWallpaper(file) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = () => {
      const imageData = reader.result
      const img = new Image()
      img.src = imageData
      img.onload = async () => {
        const canvas = document.createElement('canvas')
        const scale = 200 / Math.max(img.width, img.height)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const thumbData = canvas.toDataURL('image/jpeg', 0.7)
        const palette = extractPalette(ctx, canvas.width, canvas.height)
        await canvasStore.uploadWallpaper(file.name, imageData, thumbData, palette)
        resolve()
      }
    }
    reader.readAsDataURL(file)
  })
}

function extractPalette(ctx, w, h) {
  const data = ctx.getImageData(0, 0, w, h).data
  const buckets = []
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i], g = data[i+1], b = data[i+2]
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const l = (max + min) / 2
    if (l < 25 || l > 235) continue
    const sat = max === 0 ? 0 : (max - min) / max
    buckets.push({ r, g, b, sat, l })
  }
  // Sort by saturation, pick top 4 distinct colors
  buckets.sort((a, b) => b.sat - a.sat)
  const result = []
  for (const c of buckets) {
    if (result.length >= 4) break
    const dup = result.some(e => Math.abs(e.r - c.r) + Math.abs(e.g - c.g) + Math.abs(e.b - c.b) < 80)
    if (!dup) result.push(c)
  }
  while (result.length < 4) result.push({ r: 255, g: 255, b: 255 })
  return result.map(c => `${c.r}, ${c.g}, ${c.b}`)
}

// ─── Lifecycle ───
onMounted(async () => {
  await canvasStore.loadLayout()
  detectFonts()
  await canvasStore.init()
})
onUnmounted(() => {
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', endDrag)
})

// Click away to deselect
function onCanvasClick(e) {
  if (e.target === canvasRef.value || e.target.classList.contains('canvas-bg'))
    canvasStore.selectedElement = null
}
watch(canvasRef, (el) => { if (el) el.addEventListener('click', onCanvasClick) })
</script>

<style scoped>
.canvas-mode {
  position: fixed; inset: 0; z-index: 150;
  background: #0a0a0f; overflow: hidden; cursor: default;
  user-select: none;
}
.canvas-bg {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; z-index: 0;
}
.canvas-bg-thumb {
  filter: blur(8px); transform: scale(1.05); z-index: -1;
}
.canvas-bg-fallback {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}
.canvas-bg-fade-enter-active { transition: opacity 0.8s ease; }
.canvas-bg-fade-leave-active { transition: opacity 0.6s ease; position: absolute; }
.canvas-bg-fade-enter-from { opacity: 0; }
.canvas-bg-fade-leave-to { opacity: 0; }

/* ─── Canvas elements ─── */
.canvas-el {
  position: absolute; z-index: 10;
  cursor: grab; padding: 4px 8px;
  border-radius: 6px; border: 2px solid transparent;
  transition: border-color 0.2s, text-shadow 0.3s;
  white-space: nowrap; line-height: 1.3;
  font-weight: 700;
}
.canvas-el.selected { border-color: rgba(255,255,255,0.3); }
.canvas-el.dragging { cursor: grabbing; border-color: rgba(255,255,255,0.5); }

/* ─── Lyrics cross-fade (grid stacking — no position changes) ─── */
.lyric-container {
  display: grid;
  min-width: 120px;
}
.lyric-slot {
  grid-area: 1 / 1;
  display: flex; flex-direction: column; gap: 2px;
  opacity: 0;
  transition: opacity 0.6s ease;
  pointer-events: none;
}
.lyric-slot.visible {
  opacity: 1;
  pointer-events: auto;
}
.lyric-trans-canvas { font-size: 0.75em; opacity: 0.6; }

/* ─── Floating toolbar ─── */
.el-toolbar {
  position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 2px;
  padding: 4px 6px; border-radius: 10px;
  background: rgba(0,0,0,0.7); backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.1);
  white-space: nowrap; z-index: 20;
}
.tb-btn {
  width: 28px; height: 28px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.6); cursor: pointer;
  transition: all 0.15s;
}
.tb-btn:hover { background: rgba(255,255,255,0.1); color: white; }
.tb-btn.active { color: white; background: rgba(255,255,255,0.15); }
.tb-sep { width: 1px; height: 18px; background: rgba(255,255,255,0.1); margin: 0 4px; }
.tb-size {
  font-size: 11px; color: rgba(255,255,255,0.5); min-width: 24px; text-align: center;
  cursor: text; user-select: none;
}
.tb-size-input {
  width: 36px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
  border-radius: 4px; color: white; font-size: 11px; text-align: center; padding: 1px 2px;
  outline: none; -moz-appearance: textfield;
}
.tb-size-input::-webkit-inner-spin-button,
.tb-size-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

/* Edge resize handles */
.resize-handle {
  position: absolute; z-index: 12;
}
.resize-r { right: -4px; top: 0; width: 8px; height: 100%; cursor: ew-resize; }
.resize-l { left: -4px; top: 0; width: 8px; height: 100%; cursor: ew-resize; }
.resize-b { bottom: -4px; left: 0; width: 100%; height: 8px; cursor: ns-resize; }
.resize-t { top: -4px; left: 0; width: 100%; height: 8px; cursor: ns-resize; }
.toolbar-pop-enter-active { transition: opacity 0.2s, transform 0.2s; }
.toolbar-pop-leave-active { transition: opacity 0.15s; }
.toolbar-pop-enter-from { opacity: 0; transform: translateX(-50%) translateY(4px); }
.toolbar-pop-leave-to { opacity: 0; }

/* ─── Color palette ─── */
.color-palette {
  position: absolute; bottom: 24px; left: 24px; z-index: 20;
  display: flex; gap: 6px; align-items: flex-end;
  padding: 5px 8px; border-radius: 22px;
  background: rgba(0,0,0,0.45); backdrop-filter: blur(14px);
  border: 1px solid rgba(255,255,255,0.06);
}
.palette-dot {
  width: 24px; height: 24px; border-radius: 50%;
  cursor: pointer; border: 2px solid rgba(255,255,255,0.12);
  transition: all 0.2s; flex-shrink: 0;
}
.palette-dot:hover { transform: scale(1.15); border-color: rgba(255,255,255,0.35); }
.palette-dot.active {
  border-color: white;
  box-shadow: 0 0 0 2px rgba(255,255,255,0.15), 0 0 8px rgba(255,255,255,0.3);
  transform: scale(1.1);
}
.palette-custom-dot {
  background: radial-gradient(circle at 30% 30%,
    #f7b2d9, #b794f6 40%, #7dd3fc 70%, #86efac) !important;
  position: relative;
}
.palette-custom-dot:hover { transform: scale(1.2); }

/* Color picker panel */
.color-picker-panel {
  position: absolute; bottom: calc(100% + 10px); left: 0;
  width: 230px;
  background: rgba(18,18,30,0.95); backdrop-filter: blur(24px);
  border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset;
}
.picker-sv-area {
  position: relative; display: flex; padding: 10px 10px 8px;
}
.picker-sv-canvas {
  flex: 1; height: 140px; border-radius: 8px; cursor: crosshair;
  display: block;
}
.picker-sv-cursor {
  position: absolute; width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid white; box-shadow: 0 0 0 1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.2);
  pointer-events: none; transform: translate(-50%, -50%);
  margin-left: 10px; margin-top: 10px;
}
.picker-hue-bar {
  width: 14px; height: 140px; margin-left: 8px; flex-shrink: 0;
  border-radius: 7px; cursor: pointer; position: relative;
  overflow: hidden;
  background: linear-gradient(to bottom,
    hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%),
    hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%)
  );
}
.picker-hue-thumb {
  position: absolute; left: 50%; width: 10px; height: 10px;
  border-radius: 50%; border: 2px solid white;
  box-shadow: 0 0 3px rgba(0,0,0,0.5);
  transform: translate(-50%, -50%); pointer-events: none;
}
.picker-hex-bar {
  display: flex; align-items: center; gap: 0;
  margin: 8px 10px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; overflow: hidden;
}
.picker-hex-prefix {
  padding: 7px 0 7px 10px; color: rgba(255,255,255,0.25);
  font-size: 13px; font-family: 'Courier New', monospace; font-weight: 700;
  user-select: none;
}
.picker-hex-field {
  flex: 1; background: transparent; border: none; outline: none;
  color: rgba(255,255,255,0.9); font-size: 13px; padding: 7px 6px 7px 2px;
  font-family: 'Courier New', monospace; font-weight: 600;
  letter-spacing: 1.5px; text-transform: uppercase;
  min-width: 0;
}
.picker-hex-field::placeholder { color: rgba(255,255,255,0.15); }
.picker-swatch {
  width: 28px; height: 28px; margin: 3px;
  border-radius: 7px; flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.1);
  transition: background 0.1s;
}
.picker-apply-btn {
  display: flex; align-items: center; justify-content: center;
  width: calc(100% - 20px); margin: 0 10px 10px; padding: 8px;
  border-radius: 10px; cursor: pointer;
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.65); font-size: 12px; font-weight: 600;
  transition: all 0.2s; border: 1px solid rgba(255,255,255,0.05);
}
.picker-apply-btn:hover { background: rgba(255,255,255,0.12); color: white; }
.picker-pop-enter-active { transition: opacity 0.2s, transform 0.2s cubic-bezier(0.34,1.56,0.64,1); }
.picker-pop-leave-active { transition: opacity 0.12s, transform 0.12s; }
.picker-pop-enter-from { opacity: 0; transform: translateY(6px) scale(0.95); }
.picker-pop-leave-to { opacity: 0; transform: translateY(6px) scale(0.95); }

/* ─── Top bar ─── */
.canvas-top-bar {
  position: absolute; top: 16px; right: 16px; z-index: 20;
  display: flex; gap: 6px;
}
.top-btn {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.4); backdrop-filter: blur(12px);
  color: rgba(255,255,255,0.7); cursor: pointer;
  border: 1px solid rgba(255,255,255,0.08);
  transition: all 0.2s;
}
.top-btn:hover { background: rgba(0,0,0,0.6); color: white; }
.top-btn.active { background: rgba(255,255,255,0.15); color: rgba(255,200,100,0.9); }

/* Settings dropdown */
.settings-dropdown {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 30;
  min-width: 140px; padding: 4px;
  background: rgba(18,18,30,0.92); backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.settings-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 8px;
  font-size: 12px; color: rgba(255,255,255,0.7);
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.settings-item:hover {
  background: rgba(255,255,255,0.08); color: white;
}

/* Exit button (bottom-right) */
.canvas-exit-btn {
  position: absolute; bottom: 24px; right: 24px; z-index: 20;
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.4); backdrop-filter: blur(14px);
  color: rgba(255,255,255,0.6); cursor: pointer;
  border: 1px solid rgba(255,255,255,0.08);
  transition: all 0.25s;
}
.canvas-exit-btn:hover {
  background: rgba(0,0,0,0.6); color: white;
  box-shadow: 0 0 20px rgba(255,255,255,0.1);
  transform: scale(1.08);
}

/* ─── Panels (gallery + font) ─── */
.gallery-panel, .font-panel {
  position: absolute; top: 60px; right: 16px; z-index: 25;
  width: 260px; max-height: 70vh; overflow-y: auto;
  background: rgba(15,15,25,0.92); backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;
  padding: 16px;
}
.panel-title {
  font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.8);
  margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;
}
.panel-slide-enter-active { transition: opacity 0.25s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1); }
.panel-slide-leave-active { transition: opacity 0.15s, transform 0.15s; }
.panel-slide-enter-from { opacity: 0; transform: translateY(-8px) scale(0.95); }
.panel-slide-leave-to { opacity: 0; transform: translateY(-8px) scale(0.95); }

/* Gallery grid */
.gallery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px; }
.gallery-item {
  aspect-ratio: 16/9; border-radius: 8px; overflow: hidden;
  cursor: pointer; position: relative; border: 2px solid transparent;
  transition: all 0.2s;
}
.gallery-item img { width: 100%; height: 100%; object-fit: cover; }
.gallery-item:hover { border-color: rgba(255,255,255,0.3); }
.gallery-item.active { border-color: var(--primary); }
.gallery-del {
  position: absolute; top: 2px; right: 2px;
  width: 18px; height: 18px; border-radius: 50%;
  background: rgba(0,0,0,0.6); color: white;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.2s; cursor: pointer;
}
.gallery-item:hover .gallery-del { opacity: 1; }
/* Gallery pager */
.gallery-pager {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 6px 0;
}
.gallery-pager-btn {
  width: 24px; height: 24px; border-radius: 6px; border: none;
  background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.15s;
}
.gallery-pager-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12); color: white; }
.gallery-pager-btn:disabled { opacity: 0.3; cursor: default; }
.gallery-pager-num { font-size: 11px; color: rgba(255,255,255,0.4); }

.import-btn {
  display: flex; align-items: center; gap: 6px; justify-content: center;
  width: 100%; padding: 8px; border-radius: 8px;
  background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6);
  font-size: 12px; cursor: pointer; transition: all 0.2s;
}
.import-btn:hover { background: rgba(255,255,255,0.1); color: white; }
.hidden-file { display: none; }

/* Font panel */
.font-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0; gap: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.font-row:last-of-type { border-bottom: none; }
.font-label-tag {
  font-size: 11px; color: rgba(255,255,255,0.5); white-space: nowrap;
  background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 10px;
  font-weight: 600; letter-spacing: 0.5px; flex-shrink: 0;
}
.font-row-controls { display: flex; align-items: center; gap: 6px; }
.shadow-toggle {
  width: 26px; height: 26px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.1);
  cursor: pointer; transition: all 0.2s; flex-shrink: 0;
}
.shadow-toggle.off { color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.04); }
.shadow-toggle:hover { background: rgba(255,255,255,0.18); }

/* Custom font dropdown */
.font-dropdown-wrap { position: relative; }
.font-current {
  display: flex; align-items: center; gap: 4px;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.85); border-radius: 8px; padding: 5px 10px;
  font-size: 12px; cursor: pointer; transition: all 0.2s;
  max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.font-current:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); }
.font-dropdown {
  position: absolute; top: calc(100% + 4px); right: 0; z-index: 30;
  width: 180px; max-height: 240px; overflow-y: auto;
  background: rgba(20,20,35,0.96); backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
  padding: 4px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.font-dropdown::-webkit-scrollbar { width: 4px; }
.font-dropdown::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
.font-opt {
  padding: 6px 10px; border-radius: 6px; cursor: pointer;
  font-size: 13px; color: rgba(255,255,255,0.7);
  transition: all 0.15s; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.font-opt:hover { background: rgba(255,255,255,0.08); color: white; }
.font-opt.active { background: rgba(var(--primary-rgb, 236,65,65), 0.2); color: white; }
.font-group-label {
  padding: 6px 10px 3px; font-size: 10px; font-weight: 700;
  color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 1px;
}
.reset-btn {
  width: 100%; margin-top: 12px; padding: 8px; border-radius: 8px;
  background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5);
  font-size: 12px; cursor: pointer; transition: all 0.2s;
}
.reset-btn:hover { background: rgba(255,255,255,0.1); color: white; }

/* ─── Edge arrows ─── */
.edge-arrow {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 15;
  width: 40px; height: 80px; border-radius: 8px;
  background: rgba(0,0,0,0.3); backdrop-filter: blur(8px);
  color: rgba(255,255,255,0.6); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.edge-arrow:hover { background: rgba(0,0,0,0.5); color: white; }
.edge-left { left: 8px; }
.edge-right { right: 8px; }
.edge-fade-enter-active { transition: opacity 0.25s; }
.edge-fade-leave-active { transition: opacity 0.2s; }
.edge-fade-enter-from, .edge-fade-leave-to { opacity: 0; }

/* ─── Snap guides ─── */
.snap-line {
  position: absolute; z-index: 5; pointer-events: none;
}
.snap-h { left: 0; right: 0; height: 1px; background: rgba(255,100,100,0.5); }
.snap-v { top: 0; bottom: 0; width: 1px; background: rgba(255,100,100,0.5); }

/* ─── Custom text edit ─── */
.custom-edit-input {
  background: transparent; border: none; outline: none;
  color: inherit; font: inherit; width: 100%; min-width: 100px;
  border-bottom: 1px solid rgba(255,255,255,0.3);
}
</style>
