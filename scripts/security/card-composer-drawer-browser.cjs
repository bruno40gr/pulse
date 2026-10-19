/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic API responses only. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const width of [1440, 390]) for (const type of ['contact', 'lead', 'job']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      const errors = []; const writes = []
      page.on('pageerror', error => errors.push(error.message))
      const person = { id: 'person:alex', aliases: ['lead:alex'], name: 'Alex Example', email: 'alex@example.com', phone: '+15555550123', student: '', stage: '', profileType: 'contact', profileId: 'alex', smsContactId: 'alex' }
      await page.route('**/api/**', route => {
        const request = route.request(); const url = new URL(request.url())
        if (request.method() !== 'GET' && !['/api/inbox/read', '/api/me', '/api/contact-insights', '/api/contacts/check-sensitive'].includes(url.pathname)) writes.push(url.pathname)
        if (url.pathname === '/api/conversations') return route.fulfill({ json: { people: [person] } })
        if (url.pathname === '/api/conversations/email') return route.fulfill({ json: { mailboxes: [{ id: 'box', email: 'office@example.com', canSend: true }], threads: [], nextCursor: null } })
        return route.fulfill({ json: [] })
      })
      const base = process.env.CONVERSATIONS_LIVE_REVIEW_URL || 'http://127.0.0.1:3102'
      await page.goto(`${base}/cards?type=${type}`)
      const card = page.getByRole('dialog').first()
      assert.equal(await card.getByRole('button', { name: /^Back to / }).count(), 0, 'First-layer cards have no Back')
      const cardWidth = (await card.boundingBox()).width
      for (const channel of ['SMS', 'email']) {
        await card.getByRole('button', { name: `Send ${channel}`, exact: true }).click()
        const composer = channel === 'SMS' ? card : page.getByRole('dialog', { name: `Send ${channel} composer`, exact: true })
        await composer.waitFor()
        if (channel === 'SMS') {
          assert.equal(await composer.locator('.pulse-back-wrap').locator('..').getByText('Alex Example', { exact: true }).count(), 0, 'No duplicate recipient subtitle')
          await composer.getByRole('heading', { name: 'Send a Text Message', exact: true }).waitFor()
          assert.equal(await page.getByRole('dialog').count(), 1, 'SMS stays inside the same profile drawer')
          await composer.getByRole('button', { name: 'Attach image', exact: true }).waitFor()
          await composer.getByRole('button', { name: 'Draft with AI', exact: true }).waitFor()
          await composer.getByRole('button', { name: 'Send message', exact: true }).waitFor()
        }
        for (const close of await composer.getByRole('button', { name: /^Close(?: |$)/ }).all()) {
          const bounds = await close.boundingBox(); assert.ok(bounds.width >= 48 && bounds.height >= 48)
          assert.equal(await close.locator('svg').getAttribute('width'), '22')
        }
        assert.ok(Math.abs((await composer.boundingBox()).width - (channel === 'SMS' ? cardWidth : width <= 760 ? width : cardWidth)) < 1)
        assert.equal(page.context().pages().length, 1)
        assert.equal(await composer.getByRole('heading', { name: 'Conversations', exact: true }).count(), 0)
        const editor = composer.getByRole('textbox', { name: channel === 'SMS' ? 'SMS message' : 'Email body', exact: true })
        await editor.fill(`Keep ${channel} draft`)
        assert.equal(await composer.getByRole('button', { name: 'Open lead for Alex Example' }).count(), 0)
        assert.equal(await composer.getByRole('complementary', { name: 'SMS preview pane' }).count(), 0)
        assert.deepEqual(writes, [])
        await page.screenshot({ path: `/tmp/pulse-${type}-${channel}-drawer-${width}.png`, fullPage: true })
        if (channel === 'SMS') {
          const back = composer.getByRole('button', { name: type === 'contact' ? 'Back to contact' : 'Back to lead', exact: true })
          await back.hover()
          await page.getByRole('tooltip', { name: type === 'contact' ? 'Back to contact' : 'Back to lead', exact: true }).waitFor()
          await back.focus()
          const bounds = await back.boundingBox()
          assert.equal(bounds.width, 44); assert.equal(bounds.height, 44)
          assert.equal(await back.innerText(), '')
          await back.press('Enter')
          await card.getByRole('button', { name: 'Send SMS', exact: true }).waitFor()
        } else {
          await composer.getByRole('button', { name: type === 'contact' ? 'Back to contact' : 'Back to lead', exact: true }).click()
          await composer.waitFor({ state: 'hidden' })
        }
        assert.equal(await page.getByRole('dialog').count(), 1)
      }
      assert.deepEqual(errors, [])
      await page.close()
      console.log(`PASS ${width} ${type}: SMS/email drawer, matching width, no new tab, no submissions, returns to card`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })