/* eslint-disable @typescript-eslint/no-require-imports -- Isolated sample navigation regression. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://127.0.0.1:3231'
assert.match(base, /^http:\/\/127\.0\.0\.1:/)

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1100 } })
      page.setDefaultTimeout(20000)
      const errors = [], apiRequests = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => {
        apiRequests.push(route.request().url())
        return route.fulfill({ json: {} })
      })
      await page.goto(`${base}/odeon-demo?view=quick&account=demo%3Afamily-1&student=demo%3Astudent-1-1`)
      const impersonate = page.getByRole('button', { name: 'Impersonate Alex Adams', exact: true })
      await impersonate.waitFor()
      await impersonate.scrollIntoViewIfNeeded()
      await page.waitForTimeout(400) // Wait for the slidepanel entrance animation before measuring.
      const pencil = await page.getByRole('button', { name: 'Edit Contact', exact: true }).boundingBox()
      const person = await impersonate.boundingBox()
      assert.ok(person.x >= pencil.x + pencil.width && Math.abs(person.y + person.height / 2 - pencil.y - pencil.height / 2) < 3, 'Person icon is beside the pencil')
      await impersonate.click()
      await page.getByRole('button', { name: 'Exit impersonation', exact: true }).waitFor()
      await page.locator('[data-parent-portal]').waitFor()
      assert.equal(await page.locator('aside').count(), 0, 'Parent portal has no admin sidebar')
      assert.equal(await page.getByRole('button', { name: 'Open menu', exact: true }).count(), 0, 'Parent portal has no admin mobile menu')
      assert.equal(await page.locator('[data-parent-portal]').evaluate(element => Math.round(element.getBoundingClientRect().width)), width, 'Parent portal occupies the full viewport width')
      await page.getByText('Impersonating Alex Adams · Sample parent portal', { exact: true }).waitFor()
      assert.equal(new URL(page.url()).searchParams.get('account'), 'demo:family-1')
      await page.screenshot({ path: `/tmp/odeon-impersonation-${width}.png`, fullPage: true })
      await page.reload()
      await page.getByRole('button', { name: 'Exit impersonation', exact: true }).click()
      await page.getByRole('button', { name: 'Impersonate Alex Adams', exact: true }).waitFor()
      assert.equal(new URL(page.url()).searchParams.get('student'), 'demo:student-1-1', 'Exit restores original student context')
      await page.goto(`${base}/odeon-demo/school-setup`)
      const switcher = page.getByRole('button', { name: 'School onboarding', exact: true })
      await switcher.waitFor()
      assert.equal(await page.locator('iframe').count(), 0)
      const beige = await page.locator('aside').evaluate(element => getComputedStyle(element.parentElement.parentElement).backgroundColor)
      await switcher.click()
      await page.getByRole('group', { name: 'Choose a work area', exact: true }).waitFor()
      for (const name of ['Operations Run your day-to-day work', 'Funding Manage funded students and programs', 'Settings']) assert.ok(await page.getByRole('group', { name: 'Choose a work area' }).getByRole('link', { name, exact: true }).count())
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      await page.screenshot({ path: `/tmp/odeon-onboarding-workspace-${width}.png`, fullPage: true })
      // Later checks follow these real routes with every API intercepted.
      assert.equal(await page.getByRole('link', { name: 'Funding Manage funded students and programs', exact: true }).getAttribute('href'), '/dashboard/funding/students')
      await page.goto(`${base}/odeon-demo?screen=calendar`)
      await page.getByRole('heading', { name: 'Academy calendar', exact: true }).waitFor()
      if (width === 390) await page.getByRole('button', { name: 'Open menu', exact: true }).click()
      assert.equal(await page.getByRole('link', { name: 'Parent portal', exact: true }).count(), 0)
      assert.equal(await page.getByRole('link', { name: 'School Setup', exact: true }).count(), 0)
      const espresso = await page.locator(width === 390 ? '[style*="z-index: 50"]' : 'aside').first().evaluate(element => getComputedStyle(element).backgroundColor)
      assert.notEqual(espresso, beige, 'Leaving onboarding restores the dark navigation')
      await page.getByRole('button', { name: 'Operations', exact: true }).click()
      await page.getByRole('link', { name: 'School onboarding Set up your school', exact: true }).click()
      await page.getByRole('button', { name: 'School onboarding', exact: true }).waitFor()
      assert.deepEqual(errors, [])
      assert.deepEqual(apiRequests, [], 'Sample onboarding and impersonation do not access live APIs')
      await page.unroute('**/api/**')
      await page.route('**/api/**', route => {
        const pathname = new URL(route.request().url()).pathname
        let json = {}
        if (pathname === '/api/account/me') json = { tenantId: 'review', membershipId: 'review-owner', roleKey: 'owner', canAccessDesignSystem: true, canManageIntegrations: true, canManageBrand: true, canManageRoles: true, email: 'review@example.invalid' }
        else if (pathname === '/api/account/identity') json = { firstName: 'Review', fullName: 'Review Owner', avatarUrl: null, isDemo: false }
        else if (pathname === '/api/notifications') json = { notifications: [], unread_count: 0 }
        else if (pathname === '/api/insights') json = { insights: [] }
        else if (pathname === '/api/website-content') json = { items: [], revision: 0 }
        else if (['/api/staff', '/api/contacts', '/api/tenant-fields', '/api/funding/cases', '/api/funding/organizations'].includes(pathname)) json = []
        return route.fulfill({ json })
      })
      for (const [label, route] of [
        ['Operations Run your day-to-day work', '/dashboard'],
        ['Funding Manage funded students and programs', '/dashboard/funding/students'],
        ['School Setup Manage your school’s teaching team', '/dashboard/staff'],
        ['Website Manage your public content', '/dashboard/community'],
        ['Settings', '/dashboard/settings'],
      ]) {
        await page.goto(`${base}/odeon-demo/school-setup`)
        await page.getByRole('button', { name: 'School onboarding', exact: true }).click()
        await page.getByRole('group', { name: 'Choose a work area' }).getByRole('link', { name: label, exact: true }).click()
        await page.waitForURL(url => url.pathname === route)
        if (width === 390) await page.getByRole('button', { name: 'Open menu', exact: true }).click()
        const areaButton = label.startsWith('Operations') ? 'Operations' : label.startsWith('Funding') ? 'Funding' : label.startsWith('School Setup') ? 'School Setup' : label.startsWith('Website') ? 'Website' : 'Settings'
        await page.getByRole('button', { name: areaButton, exact: true }).click()
        await page.getByRole('link', { name: 'School onboarding Set up your school', exact: true }).click()
        await page.getByRole('button', { name: 'School onboarding', exact: true }).waitFor()
        assert.equal(await page.getByText('This page could not be found.', { exact: true }).count(), 0)
      }
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}: workspace dropdown, standalone beige onboarding, espresso return, contextual impersonation and exit/reload; no APIs/errors/overflow`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })