/* eslint-disable @typescript-eslint/no-require-imports -- Optional standalone preview runner. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const [width, height] of [[1920,1080],[1440,900],[1280,720],[1024,768],[820,1180],[768,640],[390,844],[320,568],[844,390]]) {
      const page = await browser.newPage({ viewport: { width, height } })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const button = name => page.getByRole('button', { name, exact: true })
      await page.goto(process.env.WORKSPACE_REVIEW_URL || 'http://127.0.0.1:3101')
      await button('Open conversation with Alex Chen').click(); await button('Email').click()
      const list = page.getByRole('complementary', { name: 'Email conversations', exact: true })
      assert.equal(await list.getByRole('heading', { name: 'Emails', exact: true }).count(), 0)
      assert.equal(await list.getByRole('button', { name: 'New email', exact: true }).count(), 0)
      await button('Read email: Piano lessons for Jamie').click(); await button('Reply').click()
      const composer = page.getByRole('region', { name: 'Email composer', exact: true })
      const reader = page.getByRole('region', { name: 'Email reader', exact: true })
      await composer.waitFor()
      if (width >= 1000) {
        const left = await list.boundingBox()
        const right = await reader.boundingBox()
        assert.ok(Math.abs(left.width / (left.width + right.width) - 0.3) < 0.005, `Email split must be 30/70 at ${width}`)
      }
      assert.equal(await button('Back to draft').count(), 0)
      assert.equal(await button('View previous email').count(), 0)
      assert.equal(await page.getByText('Email history · scroll up to review', { exact: true }).count(), 0)
      const peek = await reader.evaluate(panel => {
        const previous = panel.querySelector('[aria-label="Previous email context"] article').getBoundingClientRect()
        const draft = panel.querySelector('[aria-label="Email composer"]').getBoundingClientRect()
        const area = panel.getBoundingClientRect()
        return Math.min(previous.bottom, area.bottom) - Math.max(previous.top, area.top) > 20 && draft.top > area.top && draft.top < area.bottom
      })
      assert.ok(peek, `Previous email should peek above composer at ${width}x${height}`)
      const box = composer.getByLabel('Message input area', { exact: true })
      assert.equal(await box.evaluate(node => getComputedStyle(node).borderTopStyle), 'solid')
      assert.equal(await box.getByRole('button', { name: 'Use template', exact: true }).count(), 1)
      await composer.getByRole('textbox', { name: 'Email body', exact: true }).fill('Retain this responsive draft')
      await box.getByRole('button', { name: 'Use template', exact: true }).click()
      const library = page.getByRole('dialog', { name: 'Email templates', exact: true })
      await library.waitFor()
      assert.ok(await library.evaluate(node => node.scrollWidth <= node.clientWidth))
      await page.keyboard.press('Escape'); await library.waitFor({ state: 'detached' })
      await button('Save as draft').click(); await button('Continue draft').click()
      assert.equal(await composer.getByRole('textbox', { name: 'Email body', exact: true }).innerText(), 'Retain this responsive draft')
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflow at ${width}`)
      assert.ok(await reader.evaluate(node => node.scrollWidth <= node.clientWidth), `Reader overflow at ${width}`)
      await button('Send email').scrollIntoViewIfNeeded()
      assert.ok(await button('Send email').isVisible())
      if ([1440,390,320].includes(width)) await page.screenshot({ path: `/tmp/pulse-fold-${width}.png`, fullPage: true })
      assert.deepEqual(errors, [])
      await page.close()
      console.log(`PASS: ${width}x${height}: context peek, bounded input, contextual templates, draft retention, reachable footer, no overflow`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
