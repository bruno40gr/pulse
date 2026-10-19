/** Shared ownership of modal focus, inertness and scroll locking. No React dependency. */
export interface DialogLayer {
  root: HTMLElement
  dialog: HTMLElement
  dismiss: () => void
  canEscape: () => boolean
}

const layers: (DialogLayer & { opener: HTMLElement | null })[] = []
const inertBefore = new Map<HTMLElement, boolean>()
let overflowBefore = ''
let observer: MutationObserver | undefined
const selector = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [contenteditable="true"], [tabindex]:not([tabindex="-1"])'

function focusable(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(selector)).filter(element =>
    element.tabIndex >= 0 && !element.closest('[inert]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden',
  )
}

function focusInside(dialog: HTMLElement) {
  ;(focusable(dialog)[0] || dialog).focus()
}

function syncLayers() {
  const top = layers.at(-1)
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement)) continue
    if (!inertBefore.has(child)) inertBefore.set(child, child.inert)
    child.inert = child !== top?.root
  }
  layers.forEach((layer, index) => {
    layer.root.style.zIndex = String(2000 + index * 2)
    if (layer === top) layer.dialog.setAttribute('aria-modal', 'true')
    else layer.dialog.removeAttribute('aria-modal')
  })
}

function onKeyDown(event: KeyboardEvent) {
  const top = layers.at(-1)
  if (!top) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopImmediatePropagation()
    if (top.canEscape()) top.dismiss()
  } else if (event.key === 'Tab') {
    const items = focusable(top.dialog)
    const index = items.indexOf(document.activeElement as HTMLElement)
    if (!items.length || index === -1 || (event.shiftKey ? index === 0 : index === items.length - 1)) {
      event.preventDefault()
      ;(event.shiftKey ? items.at(-1) : items[0])?.focus()
      if (!items.length) top.dialog.focus()
    }
  }
}

function onFocus(event: FocusEvent) {
  const top = layers.at(-1)
  if (top && event.target instanceof Node && !top.dialog.contains(event.target)) focusInside(top.dialog)
}

export function isTopDialog(root: HTMLElement | null) {
  return layers.at(-1)?.root === root
}

export function registerDialog(layer: DialogLayer) {
  const entry = { ...layer, opener: document.activeElement instanceof HTMLElement ? document.activeElement : null }
  if (!layers.length) {
    overflowBefore = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('focusin', onFocus, true)
    observer = new MutationObserver(syncLayers)
    observer.observe(document.body, { childList: true })
  }
  layers.push(entry)
  syncLayers()
  focusInside(entry.dialog)
  return () => {
    const index = layers.indexOf(entry)
    if (index === -1) return
    const wasTop = layers.at(-1) === entry
    layers.splice(index, 1)
    inertBefore.forEach((inert, element) => { element.inert = inert })
    if (layers.length) syncLayers()
    else {
      observer?.disconnect()
      observer = undefined
      inertBefore.clear()
      document.body.style.overflow = overflowBefore
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('focusin', onFocus, true)
    }
    if (wasTop) {
      const top = layers.at(-1)
      if (entry.opener?.isConnected && !entry.opener.closest('[inert]') && (!top || top.dialog.contains(entry.opener))) entry.opener.focus()
      else if (top) focusInside(top.dialog)
    }
  }
}