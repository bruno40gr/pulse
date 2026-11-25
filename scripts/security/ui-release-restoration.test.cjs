/* eslint-disable @typescript-eslint/no-require-imports -- Local source and synthetic domain contracts. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHarness } = require('./synthetic-harness.cjs')
const read = file => fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8')
const { lessonSummary } = createHarness().load('lib/lesson-summary.ts')
test('restored lesson summary separates identity and details without inventing levels', () => {
  assert.equal(lessonSummary({ part: 'identity', instrument: 'Voice', level: 2 }), 'Voice • Level 2')
  assert.equal(lessonSummary({ part: 'identity', instrument: 'Voice' }), 'Voice')
  assert.equal(lessonSummary({ part: 'details', format: 'semi_private', duration: 45 }), 'Semi-private • 45 min')
  assert.equal(lessonSummary({ part: 'details', plan: 'Monthly - 30 Min Private Voice' }), 'Private • 30 min')
})
test('previously shipped lesson surfaces share summaries and retain card heading conventions', () => {
  for (const file of ['AccountSubscriptions', 'UpcomingBookings', 'CalendarBookingLayout']) {
    assert.match(read(`beta-source/app/content-studio-prototype/students/${file}.tsx`), /<LessonSummary /)
  }
  const card = read('beta-source/app/content-studio-prototype/students/SubscriptionCard.tsx')
  assert.match(card, /SectionTitle as="h3" variant="card"/)
  assert.doesNotMatch(card, /detail && <SectionTitle/)
})
test('restored workspace loading and tenant staff redirect cannot expose sample staff while waiting', () => {
  const source = read('beta-source/app/odeon-demo/DemoWorkspace.tsx')
  assert.match(source, /const liveStaff = Boolean\(tenant && params.get\('screen'\) === 'staff'\)/)
  assert.match(source, /router.replace\(`\/dashboard\/staff/)
  assert.match(source, /if \(!ready \|\| liveStaff\) return <LoadingSkeleton/)
  assert.match(source, /if \(!ready \|\| liveStaff \|\| blockedSave.current\) return/)
  assert.doesNotMatch(source, /href="\/odeon-demo\?screen=calendar"/)
  assert.doesNotMatch(read('app/odeon-demo/page.tsx'), /fallback=\{null\}/)
})
test('restoration retains shared contact follow-ups and scoped admin relationship UI', () => {
  const panel = read('components/contacts/LiveContactPanel.tsx')
  assert.match(panel, /<LessonSummary /)
  assert.match(panel, /<ContactFollowUps /)
  assert.match(read('app/dashboard/contacts/page.tsx'), /ContactRelationshipBadges/)
  assert.match(read('components/notes/MentionTextarea.tsx'), /mention/i)
})

test('restoration retains the explicitly approved no-focus-ring styling', () => {
  assert.match(read('app/globals.css'), /\*:focus, \*:focus-visible \{\s*outline: none !important;\s*box-shadow: none !important;/)
  assert.doesNotMatch(read('app/globals.css'), /outline: 2px solid var\(--interaction-focus\)/)
})

test('restoration includes inherited family editing and band draft functionality', () => {
  const panel = read('components/contacts/LiveContactPanel.tsx')
  assert.match(panel, /<LiveFamilyManagement/)
  assert.match(panel, /editing && editorDirty/)
  assert.match(panel, /<Modal isOpen=\{discardTarget !== null\}/)
  assert.match(read('app/dashboard/contacts/page.tsx'), /onFamilyChanged=/)
  assert.match(read('app/api/contacts/family/route.ts'), /allowDemo: false/)
  assert.match(read('app/api/bands/drafts/route.ts'), /bandWritesEnabled\(\)/)
  assert.match(read('components/ui/SlidePanelHeader.tsx'), /flexWrap: isMobile && actions/)
})