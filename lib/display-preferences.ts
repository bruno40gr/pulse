export const DISPLAY_FONT_SIZE_KEY = 'pulse_display_font_size'
export const DEFAULT_DISPLAY_FONT_SIZE = 16
export const MIN_DISPLAY_FONT_SIZE = 14
export const MAX_DISPLAY_FONT_SIZE = 20

export function clampDisplayFontSize(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_DISPLAY_FONT_SIZE
  return Math.min(MAX_DISPLAY_FONT_SIZE, Math.max(MIN_DISPLAY_FONT_SIZE, Math.round(value)))
}

export function applyDisplayFontSize(value: number) {
  const fontSize = clampDisplayFontSize(value)
  document.documentElement.style.fontSize = `${fontSize}px`
  window.localStorage.setItem(DISPLAY_FONT_SIZE_KEY, String(fontSize))
  return fontSize
}

export function readDisplayFontSize() {
  if (typeof window === 'undefined') return DEFAULT_DISPLAY_FONT_SIZE
  return clampDisplayFontSize(Number(window.localStorage.getItem(DISPLAY_FONT_SIZE_KEY)))
}