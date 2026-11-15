/* eslint-disable @typescript-eslint/no-require-imports -- Local fictional dataset regression. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://127.0.0.1:3231'
assert.match(base, /^http:\/\/127\.0\.0\.1:/)

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1100 } })
      page.setDefaultTimeout(30000)
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(`${base}/odeon-demo?screen=calendar`)
      await page.getByRole('group', { name: 'View by', exact: true }).waitFor()
      assert.ok(await page.getByRole('region', { name: 'Academy schedule', exact: true }).evaluate(element => element.scrollTop > 0), 'Initial viewport shows teaching hours')
      await page.getByRole('group', { name: 'View by', exact: true }).getByRole('button', { name: 'Room', exact: true }).click()
      const count = await page.locator('[data-booking-id]').count()
      assert.ok(count >= 35, `Wednesday has a realistic number of sessions: ${count}`)
      const summary = await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('odeon:app-sample:v2'))
        const queue = JSON.parse(sessionStorage.getItem('odeon:beta-enrollment-portal:v2'))
        return { students: saved.snapshot.data.students.length, teachers: saved.setup.teachers.length, groups: queue?.academy.groups.length ?? null }
      })
      assert.equal(summary.students, 167)
      assert.equal(summary.teachers, 15)
      // An unchanged initial queue is in memory until its first transaction;
      // opening the actual group workspace verifies the connected roster.
      await page.goto(`${base}/odeon-demo?screen=groups`)
      await page.getByText('Academy Ensemble 1', { exact: true }).first().waitFor()
      await page.goto(`${base}/odeon-demo?screen=calendar`)
      await page.getByRole('group', { name: 'View by', exact: true }).waitFor()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      await page.screenshot({ path: `/tmp/odeon-dense-calendar-${width}.png`, fullPage: true })
      // Simulate the old sparse envelope with a tester edit. Reload must append,
      // not reset the account or silently overwrite the edit.
      await page.evaluate(() => {
        const key = 'odeon:app-sample:v2', saved = JSON.parse(sessionStorage.getItem(key)), data = saved.snapshot.data
        delete data.datasetVersion
        data.students = data.students.filter(item => !item.id.startsWith('demo:dense-'))
        data.students[0].firstName = 'Preserved tester edit'
        data.accounts = data.accounts.filter(item => !item.id.startsWith('demo:dense-'))
        data.lessons = data.lessons.filter(item => !item.enrollmentId.startsWith('demo:dense-'))
        data.invoices = data.invoices.filter(item => !item.id.includes('dense-'))
        saved.setup.teachers = saved.setup.teachers.slice(0, 10)
        sessionStorage.setItem(key, JSON.stringify(saved))
      })
      await page.reload()
      await page.getByRole('group', { name: 'View by', exact: true }).waitFor()
      const migrated = await page.evaluate(() => {
        const data = JSON.parse(localStorage.getItem('odeon:app-sample:v2')).snapshot.data
        return { students: data.students.length, name: data.students[0].firstName, version: data.datasetVersion }
      })
      assert.deepEqual(migrated, { students: 167, name: 'Preserved tester edit', version: 2 })
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}: ${count} Wednesday sessions, connected population/bands, no page overflow, additive migration preserves tester edit`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })