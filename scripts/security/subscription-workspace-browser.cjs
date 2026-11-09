/* eslint-disable @typescript-eslint/no-require-imports -- Local prototype regression journey. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.STUDENT_REVIEW_URL || 'http://127.0.0.1:3197/students'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local lab required')

;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 1366, 900, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' })
      const page = await context.newPage(), errors = [], apis = []
      page.setDefaultTimeout(10000)
      page.on('pageerror', error => errors.push(error.message))
      await context.route('**/*', route => {
        const url = new URL(route.request().url())
        if (url.hostname === 'res.cloudinary.com' && route.request().resourceType() === 'image') return route.continue()
        if (url.origin !== new URL(base).origin) return route.abort()
        if (url.pathname.startsWith('/api/')) {
          const shell = ['/api/account/identity', '/api/account/claim-reminder', '/api/notifications', '/api/leads', '/api/inbox', '/api/inbox/reconcile', '/api/tenant/sync-status']
          if (!shell.includes(url.pathname)) { apis.push(url.pathname); return route.abort() }
          return route.fulfill({ json: url.pathname === '/api/account/identity' ? { fullName: 'Preview staff', firstName: 'Preview', isDemo: true } : { count: 0, notifications: [], unread_count: 0, show: false } })
        }
        return route.continue()
      })
      await page.goto(base)
      const search = page.getByRole('searchbox', { name: 'Search contacts' })
      await search.fill('Kim')
      await search.evaluate(element => { element.dataset.retained = 'yes' })
      const selection = page.getByRole('checkbox', { name: 'Select Sam Kim', exact: true })
      await selection.check()
      await page.getByRole('button', { name: 'Open Sophie Kim family', exact: true }).click()
      const panel = page.getByRole('dialog')
      async function openSubscription() {
        await panel.getByRole('button', { name: 'Sophie Piano subscription actions', exact: true }).click()
        // Focus may try to scroll an overflowing ancestor. Only the content and
        // tab strip should scroll; the outer header frame must never move.
        await panel.evaluate(element => {
          const overflow = document.createElement('div')
          overflow.style.cssText = 'position:absolute;left:100%;width:120px;height:1px'
          element.append(overflow)
          element.scrollLeft = 120
          overflow.remove()
        })
        await panel.getByRole('menuitem', { name: 'Manage subscription', exact: true }).click()
        await page.getByRole('region', { name: 'Manage subscription', exact: true }).waitFor()
      }
      await openSubscription()
      const workspace = page.getByRole('region', { name: 'Manage subscription', exact: true })
      await workspace.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished)) })
      assert.equal(await page.getByRole('dialog').count(), 0, 'Subscription is a focused workspace, not an expanded drawer')
      assert.equal(await page.getByRole('navigation', { name: 'Family sections' }).count(), 0)
      assert.equal(await page.getByRole('group', { name: 'Contact actions' }).count(), 0)
      await workspace.getByRole('heading', { name: 'Manage subscription', exact: true }).waitFor()
      await workspace.getByRole('heading', { name: 'Piano • 30 min', exact: true }).waitFor()
      await workspace.getByRole('combobox', { name: 'Payer', exact: true }).waitFor()
      const save = workspace.getByRole('button', { name: 'Save payer', exact: true })
      assert.ok(await save.evaluate(element => element.getBoundingClientRect().width < 200), 'Save action must not stretch with its form')
      await workspace.evaluate(async element => { await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished)) })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Full-bleed profile header stays within the viewport')
      await page.screenshot({ path: `/tmp/odeon-subscription-workspace-${width}.png`, fullPage: true })
      await workspace.getByRole('button', { name: 'Back to Sophie Kim', exact: true }).click()
      await panel.getByRole('button', { name: 'Sophie Piano subscription actions', exact: true }).waitFor()
      await panel.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished)) })
      assert.equal(await panel.getByRole('heading', { name: 'Manage subscription', exact: true }).count(), 0)
      await openSubscription()
      await save.click()
      await panel.getByRole('button', { name: 'Sophie Piano subscription actions', exact: true }).waitFor()
      await panel.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished)) })
      await openSubscription()
      await workspace.getByRole('button', { name: 'Back to Sophie Kim', exact: true }).click()
      await panel.getByRole('button', { name: 'Close', exact: true }).click()
      await search.waitFor()
      assert.equal(await search.inputValue(), 'Kim')
      assert.equal(await search.getAttribute('data-retained'), 'yes')
      assert.equal(await selection.isChecked(), true)
      assert.deepEqual(errors, [])
      assert.deepEqual(apis, [])
      console.log(`PASS V1 subscription workspace continuity, compact actions, save/back/X, retained contacts ${width}px`)
      await context.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })