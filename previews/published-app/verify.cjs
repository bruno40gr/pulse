const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.setDefaultTimeout(10000)
      const errors = [], external = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('request', request => {
        const url = new URL(request.url())
        if (url.protocol.startsWith('http') && url.origin !== 'http://127.0.0.1:3199') external.push(url.href)
      })
      await page.goto('http://127.0.0.1:3199/odeon-demo', { waitUntil: 'domcontentloaded' })
      await page.getByText('Emma Adams', { exact: true }).waitFor()
      const table = page.getByRole('table', { name: 'Contacts', exact: true })
      const row = table.getByRole('row').filter({ has: page.getByText('Emma Adams', { exact: true }) })
      if (width === 1440) {
        await row.hover()
        assert.match(await row.evaluate(el => getComputedStyle(el).boxShadow), /37, 99, 235/)
      }
      await page.getByRole('button', { name: 'View families', exact: true }).click()
      await table.getByRole('checkbox', { name: 'Select Alex Adams', exact: true }).check()
      assert.equal(await table.getByRole('checkbox', { name: 'Select Alex Adams', exact: true }).isChecked(), true)
      await page.screenshot({ path: `/tmp/odeon-published-contacts-${width}.png`, fullPage: true })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      // Students in both views, and holders where displayed, must use V3.
      for (const view of ['View families', 'View students']) {
        await page.getByRole('button', { name: view, exact: true }).click()
        const people = view === 'View families' ? [['Emma Adams', 'Student profile'], ['Alex Adams', 'Account manager']] : [['Emma Adams', 'Student profile']]
        for (const [name, role] of people) {
          await table.getByRole('button', { name, exact: true }).click()
          const dialog = page.getByRole('dialog', { name: 'Family workspace V3', exact: true })
          await dialog.getByText(role, { exact: true }).waitFor()
          assert.equal(await page.getByRole('dialog').count(), 1, 'No legacy panel mounted alongside V3')
          await dialog.getByRole('button', { name: 'Billing', exact: true }).click()
          await dialog.getByText('DEMO-2026-09-1', { exact: true }).waitFor()
          assert.equal(await dialog.getByText('DEMO-2026-09-2', { exact: true }).count(), 0)
          await page.screenshot({ path: `/tmp/odeon-published-v3-${name.split(' ')[0]}-${view.replaceAll(' ', '-')}-${width}.png`, fullPage: true })
          await dialog.getByRole('button', { name: /Makeups/ }).click()
          await dialog.getByText('Piano', { exact: false }).first().waitFor()
          await dialog.getByRole('button', { name: 'Close', exact: true }).first().click()
          await dialog.waitFor({ state: 'hidden' })
        }
      }
      await table.getByRole('button', { name: 'Lucas Baker', exact: true }).click()
      const otherFamily = page.getByRole('dialog', { name: 'Family workspace V3', exact: true })
      await otherFamily.getByRole('button', { name: 'Billing', exact: true }).click()
      await otherFamily.getByText('DEMO-2026-09-2', { exact: true }).waitFor()
      assert.equal(await otherFamily.getByText('DEMO-2026-09-1', { exact: true }).count(), 0)
      await otherFamily.getByRole('button', { name: 'Close', exact: true }).first().click()
      await page.getByRole('link', { name: 'Enroll new student', exact: true }).click()
      await page.getByRole('heading', { name: 'Enroll a student', exact: true }).waitFor()
      await page.getByLabel('First name', { exact: true }).fill('Preview')
      await page.getByLabel('Last name', { exact: true }).fill('Student')
      await page.getByLabel('Email', { exact: true }).fill('preview.student@example.invalid')
      await page.getByLabel('Phone', { exact: true }).fill('2025550199')
      await page.getByRole('heading', { name: 'Family details', exact: true }).click()
      await page.getByRole('button', { name: 'Edit', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await page.getByRole('heading', { name: 'Set up lessons', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await page.getByRole('button', { name: 'Back', exact: true }).waitFor()
      await page.screenshot({ path: `/tmp/odeon-published-enrollment-${width}.png`, fullPage: true })
      assert.deepEqual(errors, [])
      assert.equal(external.filter(url => /supabase|twilio|stripe/.test(url)).length, 0)
      console.log(`PASS ${width}: published table/selection; V3 students in both views + family holder; billing, makeups, close/reopen, family isolation; enrollment Family → Lessons → Times; no page errors or provider requests`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })