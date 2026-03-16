<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal crop-modal" :style="modalStyle">
        <div class="modal-header">
          <h2 class="modal-title">裁剪封面</h2>
          <button class="modal-close" @click="$emit('close')">
            <Icon name="x" :size="18" />
          </button>
        </div>
        <div class="modal-body crop-body">
          <!-- Extreme ratio warning -->
          <div v-if="extremeRatioWarning" class="crop-warning">
            <Icon name="alert-triangle" :size="14" color="var(--warning, #f59e0b)" />
            <span>{{ extremeRatioWarning }}</span>
          </div>

          <div
            class="crop-area"
            ref="cropAreaRef"
            :style="cropAreaStyle"
            @mousedown="startDrag"
            @wheel.prevent="onWheel"
          >
            <img
              ref="imgRef"
              :src="imageSrc"
              :style="imgStyle"
              draggable="false"
              @load="onImgLoad"
            />
            <div class="crop-overlay">
              <div class="crop-frame" :style="cropFrameStyle"></div>
            </div>
          </div>

          <!-- Zoom slider -->
          <div class="crop-zoom" v-if="ready">
            <Icon name="zoom-in" :size="16" color="var(--text-tertiary)" />
            <input
              type="range"
              min="100"
              max="300"
              :value="scale"
              @input="scale = Number($event.target.value)"
              class="zoom-slider"
            />
            <span class="zoom-label">{{ scale }}%</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="$emit('close')">取消</button>
          <button class="btn btn-primary" @click="confirm" :disabled="!ready">确认</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  imageSrc: { type: String, required: true }
})

const emit = defineEmits(['close', 'confirm'])

const cropAreaRef = ref(null)
const imgRef = ref(null)
const scale = ref(100)
const offsetX = ref(0)
const offsetY = ref(0)
const imgNatW = ref(0)
const imgNatH = ref(0)
const ready = ref(false)
let dragging = false
let dragStartX = 0
let dragStartY = 0
let startOffX = 0
let startOffY = 0

// ─── Elastic bounds constants ───
const DAMPING_K = 0.015       // drag resistance growth factor
const SPRING_STIFFNESS = 0.12 // snap-back speed (0–1, higher = faster)
const SNAP_THRESHOLD = 0.5    // px threshold to snap to exact boundary
let snapBackRaf = null

// ─── Layout constants ───
const MAX_DISPLAY_W = 500 // max displayed width (px)
const MAX_DISPLAY_H = 420 // max displayed height (px)
const MODAL_PAD = 40       // horizontal padding inside modal
const EXTREME_RATIO = 3    // warn if aspect ratio exceeds this

// ─── Computed layout dimensions ───
// The displayed image size (fits within MAX bounds, preserving aspect)
const displayW = computed(() => {
  if (!imgNatW.value || !imgNatH.value) return MAX_DISPLAY_W
  const aspect = imgNatW.value / imgNatH.value
  let w = MAX_DISPLAY_W
  let h = w / aspect
  if (h > MAX_DISPLAY_H) { h = MAX_DISPLAY_H; w = h * aspect }
  return Math.round(w)
})

const displayH = computed(() => {
  if (!imgNatW.value || !imgNatH.value) return MAX_DISPLAY_H
  const aspect = imgNatW.value / imgNatH.value
  let w = MAX_DISPLAY_W
  let h = w / aspect
  if (h > MAX_DISPLAY_H) { h = MAX_DISPLAY_H; w = h * aspect }
  return Math.round(h)
})

// Crop frame = square whose side = the shorter displayed dimension
const cropFrameSize = computed(() => Math.min(displayW.value, displayH.value))

const extremeRatioWarning = computed(() => {
  if (!imgNatW.value || !imgNatH.value) return ''
  const ratio = Math.max(imgNatW.value / imgNatH.value, imgNatH.value / imgNatW.value)
  if (ratio >= EXTREME_RATIO) {
    return `图片比例为 ${imgNatW.value}×${imgNatH.value}（${ratio.toFixed(1)}:1），裁剪区域较小，建议使用更接近正方形的图片`
  }
  return ''
})

// ─── Styles ───
const modalStyle = computed(() => ({
  maxWidth: `${displayW.value + MODAL_PAD * 2}px`,
  width: 'auto',
}))

const cropAreaStyle = computed(() => ({
  width: `${displayW.value}px`,
  height: `${displayH.value}px`,
}))

const cropFrameStyle = computed(() => ({
  width: `${cropFrameSize.value}px`,
  height: `${cropFrameSize.value}px`,
}))

const imgStyle = computed(() => ({
  width: `${displayW.value}px`,
  height: `${displayH.value}px`,
  transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value / 100})`,
  transformOrigin: 'center center',
  cursor: dragging ? 'grabbing' : 'grab',
}))

// ─── Boundary overflow detection ───
// Returns how far each axis is beyond the allowed range.
// Positive value = overflow in that direction, 0 = within bounds.
// The image is scaled from its center, so the scaled image extends
// (scaledW - displayW) / 2 beyond the base position on each side.
function getOverflow(ox = offsetX.value, oy = offsetY.value, s = scale.value) {
  const scaleFactor = s / 100
  const scaledW = displayW.value * scaleFactor
  const scaledH = displayH.value * scaleFactor
  const frame = cropFrameSize.value

  // Max allowed offset: the image edges must cover the crop frame.
  // Crop frame is centered in the crop-area, so frame offset from center = 0.
  // Image offset from its natural center = ox, oy.
  // The image's left edge (in crop-area coords) = (displayW - scaledW) / 2 + ox
  // The crop frame's left edge = (displayW - frame) / 2
  // Constraint: image left edge <= frame left edge  →  ox <= (scaledW - frame) / 2
  // Similarly: image right edge >= frame right edge →  ox >= -(scaledW - frame) / 2
  const maxOx = Math.max(0, (scaledW - frame) / 2)
  const maxOy = Math.max(0, (scaledH - frame) / 2)

  return {
    // How much ox is beyond the allowed range (signed: positive = too far right/down)
    overX: ox > maxOx ? ox - maxOx : ox < -maxOx ? ox + maxOx : 0,
    overY: oy > maxOy ? oy - maxOy : oy < -maxOy ? oy + maxOy : 0,
    // The clamped values (where the image should snap to)
    clampX: Math.max(-maxOx, Math.min(maxOx, ox)),
    clampY: Math.max(-maxOy, Math.min(maxOy, oy)),
  }
}

function onImgLoad() {
  if (imgRef.value) {
    imgNatW.value = imgRef.value.naturalWidth
    imgNatH.value = imgRef.value.naturalHeight
    scale.value = 100
    offsetX.value = 0
    offsetY.value = 0
    ready.value = true
  }
}

function startDrag(e) {
  cancelSnapBack()
  dragging = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  startOffX = offsetX.value
  startOffY = offsetY.value
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
}

function onDrag(e) {
  if (!dragging) return

  // Raw desired position
  const rawX = startOffX + (e.clientX - dragStartX)
  const rawY = startOffY + (e.clientY - dragStartY)

  // Check overflow at the raw position
  const { overX, overY } = getOverflow(rawX, rawY)

  // Apply damping: the further past the boundary, the more resistance
  // damped offset = clamped + overflow / (1 + k * |overflow|)
  offsetX.value = overX !== 0
    ? rawX - overX + overX / (1 + DAMPING_K * Math.abs(overX))
    : rawX
  offsetY.value = overY !== 0
    ? rawY - overY + overY / (1 + DAMPING_K * Math.abs(overY))
    : rawY
}

function stopDrag() {
  dragging = false
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
  animateSnapBack()
}

function onWheel(e) {
  const delta = e.deltaY > 0 ? -5 : 5
  scale.value = Math.max(100, Math.min(300, scale.value + delta))
}

// Snap back after zoom changes (slider or wheel)
watch(scale, () => {
  if (!dragging) animateSnapBack()
})

// ─── Spring snap-back animation ───
function cancelSnapBack() {
  if (snapBackRaf !== null) {
    cancelAnimationFrame(snapBackRaf)
    snapBackRaf = null
  }
}

function animateSnapBack() {
  cancelSnapBack()
  const { overX, overY } = getOverflow()
  if (Math.abs(overX) < SNAP_THRESHOLD && Math.abs(overY) < SNAP_THRESHOLD) {
    // Already within bounds – just snap precisely
    if (overX !== 0 || overY !== 0) {
      const { clampX, clampY } = getOverflow()
      offsetX.value = clampX
      offsetY.value = clampY
    }
    return
  }

  function tick() {
    const { overX, overY, clampX, clampY } = getOverflow()
    const absX = Math.abs(overX)
    const absY = Math.abs(overY)

    if (absX < SNAP_THRESHOLD && absY < SNAP_THRESHOLD) {
      // Done – snap to exact boundary
      offsetX.value = clampX
      offsetY.value = clampY
      snapBackRaf = null
      return
    }

    // Critically-damped spring: move a fraction of remaining distance each frame
    if (absX >= SNAP_THRESHOLD) {
      offsetX.value -= overX * SPRING_STIFFNESS
    } else {
      offsetX.value = clampX
    }
    if (absY >= SNAP_THRESHOLD) {
      offsetY.value -= overY * SPRING_STIFFNESS
    } else {
      offsetY.value = clampY
    }

    snapBackRaf = requestAnimationFrame(tick)
  }

  snapBackRaf = requestAnimationFrame(tick)
}

onUnmounted(() => {
  cancelSnapBack()
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
})

function confirm() {
  const img = imgRef.value
  if (!img) return

  // Output canvas = square at native resolution of the crop frame
  const frameDisplayPx = cropFrameSize.value
  const nativeScale = imgNatW.value / displayW.value
  const outputSize = Math.round(frameDisplayPx * nativeScale)

  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')

  const areaRect = cropAreaRef.value.getBoundingClientRect()
  const imgRect = img.getBoundingClientRect()

  // Frame center in viewport
  const frameCX = areaRect.left + areaRect.width / 2
  const frameCY = areaRect.top + areaRect.height / 2

  // Source coordinates in native image pixels
  const scaleRatio = imgNatW.value / imgRect.width
  const sx = (frameCX - frameDisplayPx / 2 - imgRect.left) * scaleRatio
  const sy = (frameCY - frameDisplayPx / 2 - imgRect.top) * scaleRatio
  const sSize = frameDisplayPx * scaleRatio

  ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, outputSize, outputSize)

  canvas.toBlob(blob => {
    emit('confirm', blob)
  }, 'image/jpeg', 0.92)
}
</script>

<style scoped>
.crop-modal {
  transition: max-width 0.2s ease;
}

.crop-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px;
}

.crop-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: var(--radius-md);
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  font-size: var(--font-xs);
  color: var(--warning, #f59e0b);
  line-height: 1.5;
  width: 100%;
}

.crop-area {
  border-radius: var(--radius-md);
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}

.crop-area img {
  display: block;
  object-fit: cover;
  user-select: none;
  pointer-events: none;
}

.crop-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.crop-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 2px solid var(--primary);
  border-radius: var(--radius-md);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
}

.crop-zoom {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.zoom-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--bg-tertiary);
  border-radius: 2px;
  outline: none;
  border: none;
  padding: 0;
}

.zoom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
}

.zoom-label {
  font-size: var(--font-xs);
  color: var(--text-tertiary);
  min-width: 40px;
  text-align: right;
}
</style>
