/* eslint-disable @typescript-eslint/no-require-imports -- Validate dashboard Notes palette without browser dependencies. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { NOTE_COLORS, NOTE_INK, NOTE_MUTED_INK, noteBackground } = createHarness().load('lib/dashboard-note-appearance.ts')
function luminance(hex) {
  const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}
function ratio(a, b) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}
test('sticky text and metadata exceed 4.5:1 on every normal, focused and completed color', () => {
  let worst = Infinity
  for (const color of Object.keys(NOTE_COLORS)) for (const completed of [false, true]) for (const focused of [false, true]) {
    const background = noteBackground(color, completed, focused)
    for (const ink of [NOTE_INK, NOTE_MUTED_INK]) {
      const contrast = ratio(ink, background)
      worst = Math.min(worst, contrast)
      assert.ok(contrast >= 4.5, `${ink} on ${background}: ${contrast.toFixed(2)}`)
    }
    assert.ok(ratio('#2563EB', background) >= 3, 'Blue focus outline and selected swatch ring')
  }
  console.log(`Lowest sticky text contrast: ${worst.toFixed(2)}:1`)
})
test('explicit button, avatar and status colors exceed normal-text contrast target', () => {
  for (const [ink, background] of [['#FFFFFF', '#1A130F'], ['#4B5563', '#E5E7EB'], ['#1F5C3A', '#FFFFFF'], ['#29231B', '#FFFFFF'], ['#8F1717', '#FFE3E3'], ['#1F5C3A', '#E0F3E5']]) assert.ok(ratio(ink, background) >= 4.5, `${ink} on ${background}`)
})