/* eslint-disable @typescript-eslint/no-require-imports -- Local harness; synthetic network only. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      const errors = []; const sends = []
      page.on('pageerror', error => errors.push(error.message))
      const person = { id: 'person:alex', name: 'Alex Example', email: 'alex@example.com', phone: '+15555550123', student: '', stage: '', profileType: 'contact', profileId: 'alex', smsContactId: 'alex' }
      await page.route('**/api/**', async route => {
        const request = route.request(); const url = new URL(request.url())
        if (url.pathname === '/api/conversations') return route.fulfill({ json: { people: [person] } })
        if (url.pathname === '/api/conversations/email') {
          if (request.method() === 'POST') sends.push(request.postDataJSON())
          return route.fulfill({ json: { mailboxes: [], threads: [], nextCursor: null } })
        }
        return route.fulfill({ json: [] })
      })
      const base = process.env.CONVERSATIONS_LIVE_REVIEW_URL || 'http://127.0.0.1:3102'
      await page.goto(base)
      const button = name => page.getByRole('button', { name, exact: true })
      const name = button('Open conversation with Alex Example')
      await name.waitFor()
      const style = await name.locator('span').filter({ hasText: /^Alex Example$/ }).evaluate(el => ({ weight: getComputedStyle(el).fontWeight, size: getComputedStyle(el).fontSize, decoration: getComputedStyle(el).textDecorationLine }))
      assert.deepEqual(style, { weight: '700', size: '16px', decoration: 'none' })
      await button('New message').click()
      for (const channel of ['Email', 'SMS']) {
        const control = page.getByRole('dialog').getByRole('button', { name: channel, exact: true })
        assert.equal(await control.isEnabled(), true)
        assert.equal(await control.evaluate(el => getComputedStyle(el).borderTopStyle), 'solid')
      }
      await page.keyboard.press('Escape')
      await name.click()
      await page.getByRole('textbox', { name: 'SMS message', exact: true }).waitFor()
      await button('Draft with AI').waitFor()
      const workspace = page.locator('[aria-label="SMS workspace"]')
      const workspaceBounds = await workspace.boundingBox()
      assert.ok(Math.abs(workspaceBounds.y + workspaceBounds.height - 880) < 3, 'Conversation workspace should extend to the viewport bottom gutter')
      assert.equal(await workspace.locator(':scope > *').count(), width >= 1000 ? 2 : 1)
      const reply = page.getByRole('textbox', { name: 'SMS message', exact: true })
      const history = page.getByRole('region', { name: 'SMS history', exact: true })
      let smsColumnWidths
      assert.equal(await workspace.locator(':scope > div').first().getByRole('textbox', { name: 'SMS message', exact: true }).count(), 1)
      assert.equal(await workspace.locator(':scope > div').first().getByRole('region', { name: 'SMS history', exact: true }).count(), 1)
      await reply.fill('Two-column preview check')
      if (width >= 1000) {
        const preview = page.getByRole('complementary', { name: 'SMS preview pane' })
        await preview.getByText('Two-column preview check', { exact: true }).waitFor()
        assert.equal(await preview.locator('textarea,button,input').count(), 0)
        const left = await history.boundingBox(); const right = await preview.boundingBox()
        assert.ok(right.x >= left.x + left.width - 1)
        smsColumnWidths = [left.width, right.width]
        assert.ok(Math.abs(left.width / (left.width + right.width) - 0.3) < 0.001, 'SMS columns must be 30/70')
        const phone = preview.getByRole('region', { name: 'SMS phone preview for Alex Example', exact: true })
        for (const body of ['', 'Short reply', 'A long reply that should scroll inside the phone. '.repeat(100)]) {
          await reply.fill(body)
          const bounds = await phone.boundingBox()
          assert.equal(bounds.width, 240)
          assert.equal(bounds.height, 520)
        }
        assert.equal(await phone.locator(':scope > div').nth(2).evaluate(el => el.scrollHeight > el.clientHeight), true)
        await reply.fill('Two-column preview check')
      }
      await page.screenshot({ path: `/tmp/pulse-sms-two-columns-${width}.png`, fullPage: true })
      await button('Email').click()
      const reader = page.getByRole('region', { name: 'Email reader', exact: true })
      await reader.getByRole('button', { name: 'New email', exact: true }).waitFor()
      if (smsColumnWidths) {
        const emailList = await page.getByRole('complementary', { name: 'Email conversations' }).boundingBox()
        const emailReader = await reader.boundingBox()
        assert.ok(Math.abs(emailList.width - smsColumnWidths[0]) < 1, 'SMS and email left columns must match')
        assert.ok(Math.abs(emailReader.width - smsColumnWidths[1]) < 1, 'SMS and email right columns must match')
      }
      assert.equal(await page.getByRole('complementary', { name: 'Email conversations' }).getByRole('button', { name: 'New email' }).count(), 0)
      const action = await button('New email').boundingBox(); const panel = await reader.boundingBox()
      assert.ok(Math.abs(action.x + action.width / 2 - panel.x - panel.width / 2) < 4)
      assert.ok(Math.abs(action.y + action.height / 2 - panel.y - panel.height / 2) < 60)
      await page.screenshot({ path: `/tmp/pulse-ui-empty-email-${width}.png`, fullPage: true })
      await page.goto(`${base}/preview`)
      await name.getByText('0 new SMS · 1 unread emails', { exact: true }).waitFor()
      assert.doesNotMatch(await page.locator('body').innerText(), /Email history not loaded/)
      await name.click()
      await button('Email').click()
      await page.getByRole('region', { name: 'Email reader', exact: true }).getByText('Thank you! Tuesdays or Thursdays after school would work best. Could you share the next available times?', { exact: true }).waitFor()
      assert.doesNotMatch(await page.locator('body').innerText(), /Select an email to read/)
      assert.ok(await page.getByText('Sample email', { exact: true }).count() > 0)
      await page.screenshot({ path: `/tmp/pulse-email-history-${width}.png`, fullPage: true })
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('pulse:conversations-home')))
      await name.waitFor()
      for (const column of ['name', 'time contacted', 'date']) {
        await button(`Sort by ${column}`).click()
        await button(`Sort by ${column}`).click()
      }
      await page.goto(`${base}/preview?recipient=person%3Aalex&channel=email&compose=1`)
      await page.getByRole('textbox', { name: 'Email subject' }).fill('Staging preview')
      await page.getByRole('textbox', { name: 'Email body' }).fill('Keep this preview draft')
      await button('Send email').click()
      await page.getByRole('status').filter({ hasText: 'Preview only — no email sent.' }).waitFor()
      assert.equal(await page.getByRole('textbox', { name: 'Email body' }).innerText(), 'Keep this preview draft')
      assert.equal(sends.length, 0)
      assert.doesNotMatch(await page.locator('body').innerText(), /Drafts are kept in this tab only|Connect your Gmail mailbox in Settings/)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await page.screenshot({ path: `/tmp/pulse-ui-staging-email-${width}.png`, fullPage: true })
      assert.deepEqual(errors, [])
      await page.close()
      console.log(`PASS ${width}: SMS history and reply together, preview-only second column, name typography, channel buttons, email empty state and safe staging preview`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })