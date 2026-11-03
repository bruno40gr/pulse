/* eslint-disable @typescript-eslint/no-require-imports -- Intercepted local fixtures, no sends. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const rows = Array.from({ length: 3 }, (_, i) => {
  const account = { tenant_id: 'review', account_id: `a-${i}`, account_holder_name: `Holder ${i}`,
    account_holder_person_id: i === 2 ? null : `holder-${i}`, account_holder_phone: '+12025550101',
    client_status: 'active', phone: null, email: null, custom_fields: {}, last_name: 'Example' }
  return [
    ...(i === 2 ? [] : [{ ...account, id: `holder-${i}`, first_name: `Holder ${i}`, is_student: false }]),
    ...[0, 1].map(j => ({ ...account, id: `kid-${i}-${j}`, first_name: `Student ${i}-${j}`, is_student: true,
      student_id: `s-${i}-${j}`, is_minor: true, message_routing: 'account_holder' })),
  ]
}).flat()
;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 900, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], audiences = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => {
        const path = new URL(route.request().url()).pathname
        if (path === '/api/communications/recipients') {
          audiences.push(route.request().postDataJSON())
          return route.fulfill({ json: { selectedCount: 6, recipients: [], excluded: [], version: 'fixture' } })
        }
        if (path === '/api/inbox/reconcile') return route.fulfill({ json: { skipped: true } })
        if (path === '/api/communications/senders') return route.fulfill({ json: { senders: [] } })
        if (route.request().method() !== 'GET') throw new Error(`Unexpected write ${path}`)
        return route.fulfill({ json: path === '/api/contacts' ? rows : path === '/api/tenant-fields' ? [] : {} })
      })
      await page.goto('http://127.0.0.1:3218/dashboard/contacts')
      const table = page.getByRole('table', { name: 'Contacts', exact: true })
      await table.getByRole('button', { name: 'Student 0-0 Example', exact: true }).waitFor()
      const view = page.getByRole('group', { name: 'Contact view', exact: true })
      const search = page.getByRole('textbox', { name: 'Search contacts', exact: true })
      await search.fill('keep this draft')
      for (let i = 0; i < 3; i++) await table.getByRole('checkbox', { name: `Select Holder ${i}${i === 2 ? '' : ' Example'}`, exact: true }).check()
      const bar = page.getByRole('region', { name: 'Table results and actions' })
      await bar.getByText('3 selected', { exact: true }).waitFor()
      assert.equal(await search.isVisible(), true)
      assert.equal(await bar.getByRole('button', { name: /Edit/ }).count(), 0)
      assert.ok((await bar.boundingBox()).y > (await view.boundingBox()).y)
      for (const row of rows.filter(row => row.is_student)) assert.equal(await table.getByRole('checkbox', { name: `Select ${row.first_name} Example`, exact: true }).count(), 0)
      await view.getByRole('button', { name: 'View students', exact: true }).click()
      await bar.getByText('6 selected', { exact: true }).waitFor()
      for (const row of rows.filter(row => row.is_student)) assert.equal(await table.getByRole('checkbox', { name: `Select ${row.first_name} Example`, exact: true }).isChecked(), true)
      assert.equal(await search.inputValue(), 'keep this draft')
      await view.getByRole('button', { name: 'View families', exact: true }).click()
      await bar.getByText('3 selected', { exact: true }).waitFor()
      await view.getByRole('button', { name: 'View students', exact: true }).click()
      await bar.getByRole('button', { name: 'Clear selection', exact: true }).click()
      const selectAll = table.getByRole('checkbox', { name: 'Select all contacts', exact: true })
      await selectAll.check()
      await bar.getByText('6 selected', { exact: true }).waitFor()
      await selectAll.uncheck()
      assert.equal(await bar.count(), 0)
      await view.getByRole('button', { name: 'View families', exact: true }).click()
      await selectAll.check()
      await bar.getByText('3 selected', { exact: true }).waitFor()
      await view.getByRole('button', { name: 'View students', exact: true }).click()
      await bar.getByText('6 selected', { exact: true }).waitFor()
      await bar.getByRole('button', { name: 'Clear selection', exact: true }).click()
      assert.equal(await search.inputValue(), 'keep this draft')
      await table.getByRole('checkbox', { name: 'Select Student 0-0 Example', exact: true }).check()
      await view.getByRole('button', { name: 'View families', exact: true }).click()
      await bar.getByText('1 selected', { exact: true }).waitFor()
      await view.getByRole('button', { name: 'View students', exact: true }).click()
      await bar.getByText('2 selected', { exact: true }).waitFor()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await page.screenshot({ path: `/private/tmp/contact-view-selection-${width}.png`, fullPage: true })
      await bar.getByRole('button', { name: 'Email', exact: true }).click()
      await page.waitForTimeout(500)
      assert.deepEqual([...audiences[0].contactIds].sort(), ['kid-0-0', 'kid-0-1'])
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px: 3 families ↔ 6 students, partial family expands, discovery preserved, direct composer`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })