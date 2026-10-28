/* eslint-disable @typescript-eslint/no-require-imports -- All network responses are synthetic. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], writes = [], summaryCursors = []
      page.on('pageerror', error => errors.push(error.message))
      const people = ['Older History', 'Recent Email'].map((name, i) => ({ id: `person:${i}`, name, email: `${i}@example.invalid`, phone: '', student: '', stage: '', profileType: 'contact', profileId: String(i), smsContactId: String(i) }))
      const email = i => ({ id: `email:box:thread:${i}`, contactId: people[i].id, name: people[i].name, email: people[i].email, phone: '', initials: 'E', student: '', stage: '', interest: '', nextAction: '', note: '', channel: 'email', subject: `Lessons ${i}`, mailboxId: 'box', providerThreadId: `thread-${i}`, messages: [{ id: `message-${i}`, channel: 'email', direction: 'inbound', unread: false, body: 'Existing email restored to reader', timestamp: '2026-10-26T12:00:00Z', time: 'October 26' }] })
      await page.route('**/api/**', route => {
        const r = route.request(), url = new URL(r.url())
        if (r.method() !== 'GET') { writes.push(url.pathname); return route.abort() }
        const json = body => route.fulfill({ json: body })
        if (url.pathname === '/api/conversations') return json({ people })
        if (url.pathname === '/api/inbox') return json([])
        if (url.pathname === '/api/conversations/email') {
          if (!url.searchParams.has('mailbox')) return json({ mailboxes: [{ id: 'box', email: 'office@example.invalid', canSend: false }] })
          if (url.searchParams.has('summary')) {
            const cursor = url.searchParams.get('cursor') || 'first'; summaryCursors.push(cursor)
            return json({ threads: cursor === 'older-1' ? [email(1)] : [], nextCursor: cursor === 'first' ? 'older-1' : cursor === 'older-1' ? 'older-2' : cursor === 'older-2' ? 'older-3' : null })
          }
          return json({ threads: [email(Number(url.searchParams.get('person').split(':')[1]))], nextCursor: null })
        }
        return json({ senders: [], templates: [], signature: '' })
      })
      await page.goto(process.env.CONVERSATION_RESTORE_URL || 'http://localhost:3157/conversation-restore')
      const filter = page.getByRole('group', { name: 'Filter conversation channel', exact: true })
      await filter.getByRole('button', { name: 'Email', exact: true }).click()
      const older = page.getByRole('button', { name: 'Open conversation with Older History', exact: true })
      await older.waitFor()
      const loadOlder = page.getByRole('button', { name: 'Load older email conversations', exact: true })
      await loadOlder.waitFor()
      assert.deepEqual(summaryCursors.slice(0, 3), ['first', 'older-1', 'older-2'])
      await loadOlder.click()
      await loadOlder.waitFor({ state: 'hidden' })
      assert.ok(summaryCursors.includes('older-3'))
      await older.click()
      await page.getByRole('region', { name: 'Email reader', exact: true }).getByText('Existing email restored to reader', { exact: true }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Email', exact: true }).getAttribute('aria-pressed'), 'true')
      assert.deepEqual(writes, [])
      assert.deepEqual(errors, [])
      await page.screenshot({ path: `/tmp/pulse-email-restored-${width}.png`, fullPage: true })
      console.log(`PASS ${width}px: empty newest page, immediate older summaries, reachable unindexed contact, load older, direct reader, zero writes`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })