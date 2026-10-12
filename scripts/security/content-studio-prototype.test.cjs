/* eslint-disable @typescript-eslint/no-require-imports -- Existing synthetic test harness. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { createHarness } = require('./synthetic-harness.cjs')
const studio = () => createHarness().load('lib/content-studio-prototype.ts')
const base = kind => ({ kind, title: 'Synthetic title', summary: '', body: '', date: '', time: '', image: '', imageAlt: '', artwork: 'template', ctaLabel: '', ctaUrl: '', socialUrl: '', permission: false, featured: false })

test('events and deadlines always have calendar placement; announcements do not', () => {
  const { placements } = studio()
  assert.deepEqual(Array.from(placements(base('event'))), ['Calendar', 'Bulletin Board'])
  assert.deepEqual(Array.from(placements(base('deadline'))), ['Calendar', 'Bulletin Board'])
  assert.deepEqual(Array.from(placements(base('announcement'))), ['Bulletin Board'])
})
test('events require date and time; deadlines require valid date but no time', () => {
  const { publishErrors } = studio()
  assert.equal(publishErrors(base('event')).length, 2)
  assert.equal(publishErrors({ ...base('deadline'), date: '2026-10-20' }).length, 0)
  assert.ok(publishErrors({ ...base('deadline'), date: '2026-02-30' }).length)
})
test('articles require body and supplied image with accessible description', () => {
  const { publishErrors } = studio()
  assert.equal(publishErrors(base('article')).length, 2)
  assert.equal(publishErrors({ ...base('article'), body: 'Synthetic story', image: 'data:image/png;base64,test', imageAlt: 'Synthetic image' }).length, 0)
})
test('article CTA pairs require HTTPS; banner CTAs are text only', () => {
  const { publishErrors } = studio()
  for (const ctaUrl of ['javascript:alert(1)', 'http://example.test', 'https://user:pass@example.test']) {
    assert.ok(publishErrors({ ...base('article'), body: 'Story', image: 'photo', imageAlt: 'Photo', ctaLabel: 'Read more', ctaUrl }).length)
  }
  assert.equal(publishErrors({ ...base('announcement'), ctaLabel: 'See you there!' }).length, 0)
  assert.equal(publishErrors({ ...base('deadline'), date: '2026-11-01', ctaLabel: 'Register now!' }).length, 0)
})
test('social publication requires URL and permission and observes the four-slot limit', () => {
  const { publishErrors } = studio()
  assert.equal(publishErrors(base('social')).length, 2)
  const draft = { ...base('social'), socialUrl: 'https://instagram.com/p/synthetic/', permission: true, featured: true }
  assert.equal(publishErrors(draft, 3).length, 0)
  assert.ok(publishErrors(draft, 4).length)
})
test('prototype route is covered by existing account-administrator middleware gate', () => {
  const middleware = readFileSync('middleware.ts', 'utf8')
  assert.match(middleware, /pathname === '\/content-studio-prototype'/)
  assert.match(middleware, /pathname\.startsWith\('\/content-studio-prototype\/'\)/)
  const gatedBlock = middleware.slice(middleware.indexOf("if (pathname === '/dashboard/design'"), middleware.indexOf("if (host === 'heycohen"))
  assert.match(gatedBlock, /requireAccountAdministrator/)
})
test('event theme suggestions use details and allow explicit staff overrides', () => {
  const { suggestedEventTheme, eventTreatment } = studio()
  for (const [title, expected] of [['Student Showcase', 'showcase'], ['Band Camp', 'camp'], ['Open Mic Night', 'open-mic'], ['Rocklin Bands', 'concert'], ['Songwriting Workshop', 'songwriting']]) {
    assert.equal(suggestedEventTheme(title), expected)
    assert.equal(eventTreatment({ ...base('event'), title, eventTheme: 'auto' }).id, expected)
  }
  assert.equal(suggestedEventTheme('Music night', 'A lyric writing workshop'), 'songwriting')
  assert.equal(eventTreatment({ ...base('event'), title: 'Band Camp', eventTheme: 'concert' }).id, 'concert')
  assert.equal(eventTreatment(base('event')).id, 'showcase')
})
test('event wizard has one shared footer and no Pulse exit or Continue controls', () => {
  const source = readFileSync('app/content-studio-prototype/ContentStudio.tsx', 'utf8')
  assert.doesNotMatch(source, /Back to Pulse|>Continue</)
  assert.match(source, /studioSteps\(draft.kind\)/)
  assert.equal((source.match(/<footer className=\{styles.wizardFooter\}/g) || []).length, 1)
})
test('all five content types share the wizard and validate the appropriate step', () => {
  const { studioSteps, studioStepErrors } = studio()
  for (const kind of ['event', 'deadline', 'announcement', 'article', 'social']) {
    assert.deepEqual(Array.from(studioSteps(kind)).slice(1), ['Design', 'Publish'])
  }
  const article = { ...base('article'), body: 'Story' }
  assert.equal(studioStepErrors(article, 0).length, 0)
  assert.equal(studioStepErrors(article, 1).length, 1)
  assert.equal(studioStepErrors({ ...article, image: 'photo', imageAlt: 'Photo' }, 1).length, 0)
  assert.equal(studioStepErrors(base('social'), 0).length, 2)
})
test('supporting photos default to separate and are independent of uploaded artwork', () => {
  const { newStudioDraft, publishErrors, studioStepErrors } = studio()
  assert.equal(newStudioDraft('event').imageLayout, 'separate')
  const draft = { ...base('announcement'), image: 'supporting photo', imageAlt: 'Photo', artwork: 'upload', artworkImage: '', artworkAlt: '' }
  assert.equal(studioStepErrors(draft, 1).length, 1)
  assert.ok(publishErrors(draft).includes('Upload artwork or choose a template.'))
  assert.equal(publishErrors({ ...draft, artworkImage: 'flyer', artworkAlt: 'Flyer' }).length, 0)
})
test('event time choices are deliberate half-hour slots, not the current clock time', () => {
  const { eventTimes, newStudioDraft, publishErrors } = studio()
  assert.equal(newStudioDraft('event').time, '')
  assert.equal(eventTimes.length, 48)
  assert.ok(eventTimes.every(option => /^\d{2}:(00|30)$/.test(option.value)))
  assert.equal(eventTimes.find(option => option.value === '19:00').label, '7:00 PM')
  assert.ok(publishErrors({ ...base('event'), date: '2026-11-01', time: '19:28' }).length)
  assert.equal(publishErrors({ ...base('event'), date: '2026-11-01', time: '19:00', ctaLabel: 'See you there!' }).length, 0)
})
test('one design choice sets the palette and layout; dark posters have white logos', () => {
  const { eventTreatment, posterLogoFilter } = studio()
  assert.equal(eventTreatment({ ...base('event'), title: 'Band Camp', designId: 'open-mic' }).layout, 'portrait')
  assert.equal(posterLogoFilter('#FFFFFF'), 'brightness(0) invert(1)')
  assert.equal(posterLogoFilter('#111111'), 'brightness(0)')
  const source = readFileSync('app/content-studio-prototype/ContentStudio.tsx', 'utf8')
  assert.doesNotMatch(source, /id="event-theme"|id="poster-layout"|styles.themeSwatches|This prototype uses keywords|Without a photo/)
  assert.match(source, /id="studio-references"/)
})