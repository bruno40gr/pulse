/* eslint-disable @typescript-eslint/no-require-imports -- All network responses are synthetic. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 900, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      await page.clock.setFixedTime(new Date('2026-10-28T12:00:00Z'))
      const errors = [], writes = [], summaryCursors = [], ranges = []
      page.on('pageerror', error => errors.push(error.message))
      const people = ['Older History', 'Recent Email', 'Unrelated Contact'].map((name, i) => ({ id: `person:${i}`, name, email: `${i}@example.invalid`, phone: '', student: '', stage: '', profileType: i === 2 ? 'contact' : 'lead', profileId: String(i), smsContactId: String(i) }))
      const email = i => ({ id: `email:box:thread:${i}`, contactId: people[i].id, name: people[i].name, email: people[i].email, phone: '', initials: 'E', student: '', stage: '', interest: '', nextAction: '', note: '', channel: 'email', subject: `Lessons ${i}`, mailboxId: 'box', providerThreadId: `thread-${i}`, messages: [{ id: `message-${i}`, channel: 'email', direction: 'inbound', unread: false, body: 'Existing email restored to reader', timestamp: '2026-10-26T12:00:00Z', time: 'October 26' }] })
      await page.route('**/api/**', route => {
        const r = route.request(), url = new URL(r.url())
        if (r.method() !== 'GET') { writes.push(url.pathname); return route.abort() }
        const json = body => route.fulfill({ json: body })
        if (url.pathname === '/api/conversations') return json({ people })
        if (url.pathname === '/api/inbox') return json([])
        if (url.pathname === '/api/conversations/email') {
          if (!url.searchParams.has('mailbox')) return json({ mailboxes: [{ id: 'box', email: 'office@example.invalid', canSend: false }] })
          ranges.push([url.searchParams.get('from'), url.searchParams.get('to')])
          if (url.searchParams.get('from') === '2026-09-01') return json({ threads: [{ ...email(0), messages: [{ ...email(0).messages[0], body: 'September lead email', timestamp: '2026-09-26T12:00:00Z', time: 'September 26' }] }], nextCursor: null })
          if (url.searchParams.has('summary')) {
            const cursor = url.searchParams.get('cursor') || 'first'; summaryCursors.push(cursor)
            return json({ threads: cursor === 'older-1' ? [email(0), email(1), email(2), { ...email(0), id: 'old-thread', messages: [{ ...email(0).messages[0], body: 'Old history must be hidden', timestamp: '2026-09-12T12:00:00Z' }] }] : [], nextCursor: cursor === 'first' ? 'older-1' : cursor === 'older-1' ? 'older-2' : cursor === 'older-2' ? 'older-3' : null })
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
      const loadOlder = page.getByRole('button', { name: 'Load more emails in date range', exact: true })
      await loadOlder.waitFor()
      assert.deepEqual(summaryCursors.slice(0, 3), ['first', 'older-1', 'older-2'])
      await loadOlder.click()
      await loadOlder.waitFor({ state: 'hidden' })
      assert.ok(summaryCursors.includes('older-3'))
      assert.equal(await page.getByRole('button', { name: 'Open conversation with Unrelated Contact', exact: true }).count(), 0)
      assert.equal(await page.getByLabel('From date', { exact: true }).inputValue(), '2026-10-01')
      assert.equal(await page.getByLabel('To date', { exact: true }).inputValue(), '2026-10-31')
      assert.ok(ranges.every(([from, to]) => from === '2026-10-01' && to === '2026-10-31'))
      await older.click()
      await page.getByRole('region', { name: 'Email reader', exact: true }).getByText('Existing email restored to reader', { exact: true }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Email', exact: true }).getAttribute('aria-pressed'), 'true')
      assert.equal(await page.getByText('Old history must be hidden', { exact: true }).count(), 0)
      await page.getByRole('button', { name: 'Back to Conversations', exact: true }).first().click()
      await page.getByLabel('From date', { exact: true }).fill('2026-09-01')
      await page.getByLabel('To date', { exact: true }).fill('2026-09-30')
      await page.getByRole('button', { name: 'Open conversation with Older History', exact: true }).click()
      await page.getByRole('region', { name: 'Email reader', exact: true }).getByText('September lead email', { exact: true }).waitFor()
      assert.equal(await page.getByText('Existing email restored to reader', { exact: true }).count(), 0)
      assert.deepEqual(writes, [])
      assert.deepEqual(errors, [])
      await page.screenshot({ path: `/tmp/pulse-email-restored-${width}.png`, fullPage: true })
      console.log(`PASS ${width}px: lead-only emails, current-month default, date changes filter reader history, no unrelated contacts, zero writes`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })