/* eslint-disable @typescript-eslint/no-require-imports -- Offline appearance contracts. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHarness } = require('./synthetic-harness.cjs')
const h = createHarness()
const { calendarStudentStyle, calendarServiceStyle } = h.load('lib/calendar-appearance.ts')
const { calendarStudentPalette, interaction } = h.load('lib/tokens.ts')
const read = file => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8')

test('academy service colors are consistent across students and distinguish service categories', () => {
  const guitar = { kind: 'lesson', serviceType: 'Private', program: 'Guitar' }
  assert.deepEqual(calendarServiceStyle(guitar), calendarServiceStyle({ ...guitar, studentIds: ['another-student'] }))
  assert.deepEqual(calendarServiceStyle(guitar), calendarServiceStyle({ ...guitar, program: ' guitar ' }))
  assert.deepEqual(calendarServiceStyle(guitar), calendarServiceStyle({ ...guitar, kind: 'event', serviceType: 'Private lesson' }))
  const styles = [guitar, { ...guitar, serviceType: 'Group' }, { ...guitar, kind: 'band' }, { ...guitar, kind: 'studio' }, { ...guitar, kind: 'rehearsal' }].map(calendarServiceStyle)
  assert.equal(new Set(styles.map(style => style['--calendar-student-surface'])).size, styles.length)
})

test('academy toolbar reuses shared segmented controls and has no clear filters action', () => {
  const calendar = read('beta-source/app/odeon-demo/AcademyCalendar.tsx')
  assert.match(calendar, /Tabs<CalendarPerspective> variant="prominent" controlSize="toolbar"/)
  assert.match(calendar, /ariaLabel="Calendar range"/)
  assert.doesNotMatch(calendar, /Clear filters|calendarStudentStyle/)
  assert.match(calendar, /calendarServiceStyle\(item\)/)
})

test('student colors stay stable across focus, roster order, repeated lessons and proposed dates', () => {
  const roster = ['sara', 'adam']
  const adam = calendarStudentStyle('adam', roster)
  const sara = calendarStudentStyle('sara', roster)
  assert.notEqual(adam['--calendar-student-surface'], sara['--calendar-student-surface'])
  assert.deepEqual(adam, calendarStudentStyle('adam', ['adam', 'sara', 'adam']))
  assert.deepEqual(sara, calendarStudentStyle('sara', ['adam', 'sara']))
  assert.equal(calendarStudentStyle('', [])['--calendar-student-text'], calendarStudentPalette[0].text)
})

test('calendar identity hues avoid teal and red/yellow/green status hues', () => {
  for (const color of calendarStudentPalette) {
    assert.notEqual(color.border, interaction.selected)
    const [r, g, b] = color.border.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min
    let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
    hue = (hue * 60 + 360) % 360
    assert.ok(hue >= 210 && hue <= 310, `Non-status hue ${hue}`)
  }
})

test('cards and available slots are neutral; selected student blocks retain identity, without extra indicators', () => {
  const css = read('beta-source/app/content-studio-prototype/enrollment/enrollment.module.css')
  const rule = name => css.match(new RegExp(`\\.${name} \\{([^}]+)\\}`))[1]
  for (const name of ['selectedCard', 'openSlot', 'availableLegend']) {
    assert.match(rule(name), /calendar-neutral/)
    assert.doesNotMatch(rule(name), /interaction-selected/)
  }
  for (const name of ['bookedSlot', 'activeBookedSlot', 'replacementSlot', 'familyReferenceSlot']) assert.match(rule(name), /calendar-student/)
  assert.doesNotMatch(css, /content: 'Editing/)
  const sidebar = read('beta-source/app/content-studio-prototype/students/FamilyReschedule.tsx')
  assert.doesNotMatch(sidebar, /colors.link/)
})