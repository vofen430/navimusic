/**
 * useFlipGrid — reusable FLIP animation for CSS grid cards.
 *
 * Usage:
 *   const { snapshot, animate } = useFlipGrid(gridRef, '.card')
 *   // Before layout change:
 *   snapshot()
 *   // After layout has reached final size:
 *   animate()
 */

const ANIM_DURATION = '0.4s'
const ANIM_EASING = 'cubic-bezier(.4,0,.2,1)'

/**
 * @param {import('vue').Ref<HTMLElement|null>} gridRef - ref to the grid container
 * @param {string} cardSelector - CSS selector for cards
 * @param {object} [options]
 * @param {string} [options.idAttr] - data attribute name for card identity. If omitted, uses index.
 */
export function useFlipGrid(gridRef, cardSelector, options = {}) {
  const { idAttr } = options
  let savedPositions = null
  let savedGridH = 0

  function getCardId(card, idx) {
    if (idAttr) return card.dataset[idAttr] || String(idx)
    return String(idx)
  }

  function snapshot() {
    const grid = gridRef.value
    if (!grid) return
    const gridRect = grid.getBoundingClientRect()
    const cards = grid.querySelectorAll(cardSelector)
    const map = new Map()
    cards.forEach((card, idx) => {
      const r = card.getBoundingClientRect()
      map.set(getCardId(card, idx), {
        el: card,
        left: r.left - gridRect.left,
        top: r.top - gridRect.top,
        width: r.width,
        height: r.height
      })
    })
    savedPositions = map
    savedGridH = grid.scrollHeight
  }

  function animate() {
    const grid = gridRef.value
    if (!grid || !savedPositions) return
    const oldMap = savedPositions
    savedPositions = null

    // Ensure grid is a positioning context for absolute children
    const origPosition = grid.style.position
    if (getComputedStyle(grid).position === 'static') {
      grid.style.position = 'relative'
    }

    const gridRect = grid.getBoundingClientRect()
    const cards = grid.querySelectorAll(cardSelector)

    // Build new position map
    const newMap = new Map()
    cards.forEach((card, idx) => {
      const r = card.getBoundingClientRect()
      newMap.set(getCardId(card, idx), {
        el: card,
        left: r.left - gridRect.left,
        top: r.top - gridRect.top,
        width: r.width,
        height: r.height
      })
    })

    const newGridH = grid.scrollHeight

    // Classify cards
    const allIds = new Set([...oldMap.keys(), ...newMap.keys()])
    const moveCards = []
    const appearCards = []

    for (const id of allIds) {
      const oldR = oldMap.get(id)
      const newR = newMap.get(id)
      if (!newR) continue
      const card = newR.el
      if (oldR) {
        moveCards.push({ card, oldR, newR })
      } else {
        appearCards.push({ card, newR })
      }
    }

    if (!moveCards.length && !appearCards.length) return

    // Fix grid height so it doesn't collapse
    const fixedH = Math.max(savedGridH, newGridH)
    grid.style.height = fixedH + 'px'
    grid.style.overflow = 'hidden'

    // Position all cards at their OLD positions with position:absolute
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

    // Force reflow
    grid.offsetHeight

    // Animate to NEW positions
    const allAnimCards = []
    for (const { card, oldR, newR } of moveCards) {
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

    // Cleanup after animation
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
      grid.style.position = origPosition
      grid.offsetHeight
      requestAnimationFrame(() => {
        for (const card of allAnimCards) card.style.transition = ''
      })
    }

    setTimeout(cleanup, 500)
  }

  return { snapshot, animate }
}
