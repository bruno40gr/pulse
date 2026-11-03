/* eslint-disable @typescript-eslint/no-require-imports -- Fictional intercepted API fixtures only. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.CONTACT_LIST_VIEWS_REVIEW_URL || 'http://127.0.0.1:3218/dashboard/contacts'
const contact = (id, first_name, patch = {}) => ({
  id, first_name, last_name: 'Example', tenant_id: 'review', client_status: 'active',
  custom_fields: {}, phone: null, email: null, opted_out: false, ...patch,
})
const family = { account_id: 'family', account_holder_person_id: 'manager', account_holder_name: 'Morgan Example', account_holder_phone: '+12025550101', account_holder_email: 'morgan@example.test' }
const rows = [
  contact('one', 'Alex', { ...family, is_student: true, student_id: 'enrollment-one' }),
  contact('two', 'Taylor', { ...family, is_student: true, student_id: 'enrollment-two', staff_id: 'staff' }),
  contact('manager', 'Morgan', { is_student: false, phone: family.account_holder_phone, email: family.account_holder_email }),
  contact('renter', 'Jordan', { is_student: false, custom_fields: { contact_kind: 'booking' } }),
]
;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 900, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], writes = [], requests = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => {
        const request = route.request(), path = new URL(request.url()).pathname
        requests.push(path)
        if (path === '/api/ai-filter') return route.fulfill({ json: { contact_ids: ['one'], explanation: 'Alex Example' } })
        if (path === '/api/inbox/reconcile') return route.fulfill({ json: { skipped: true } })
        if (request.method() !== 'GET') { writes.push(path); return route.abort() }
        return route.fulfill({ json: path === '/api/contacts' ? rows : path === '/api/tenant-fields' ? [] : {} })
      })
      await page.goto(base)
      const table = page.getByRole('table', { name: 'Contacts', exact: true })
      const view = page.getByRole('group', { name: 'Contact view', exact: true })
      await table.getByRole('button', { name: 'Alex Example', exact: true }).waitFor()
      const alex = table.getByRole('checkbox', { name: 'Select Alex Example', exact: true })
      const morgan = table.getByRole('checkbox', { name: 'Select Morgan Example', exact: true })
      const taylor = table.getByRole('checkbox', { name: 'Select Taylor Example', exact: true })
      assert.equal(await table.getByText('Select family', { exact: true }).count(), 0)
      await alex.check()
      assert.equal(await alex.locator('xpath=ancestor::*[@role="row"][1]').getAttribute('aria-selected'), 'true')
      assert.equal(await morgan.isChecked(), false)
      assert.equal(await morgan.isEnabled(), true)
      assert.equal(await taylor.isChecked(), false)
      const rowBlue = async checkbox => checkbox.locator('xpath=ancestor::*[@role="row"][1]').evaluate(el => el.style.backgroundColor === 'rgb(245, 248, 255)')
      assert.equal(await rowBlue(alex), true)
      assert.equal(await rowBlue(morgan), false)
      assert.equal(await rowBlue(taylor), false)
      await morgan.check()
      assert.equal(await alex.isChecked(), true)
      assert.equal(await taylor.isChecked(), false)
      assert.equal(await rowBlue(morgan), true)
      assert.equal(await rowBlue(taylor), false)
      await morgan.uncheck()
      await morgan.dblclick()
      assert.equal(await morgan.isChecked(), false, 'Double-click no longer selects the whole family')
      assert.equal(await taylor.isChecked(), false)
      assert.equal(await alex.isChecked(), true)
      await morgan.check()
      await taylor.check()
      for (const checkbox of [alex, morgan, taylor]) assert.equal(await rowBlue(checkbox), true)
      const familyBounds = await morgan.locator('xpath=ancestor::*[@role="rowgroup"][1]').evaluate(group => {
        const rows = [...group.querySelectorAll('[role="row"]')]
        const bounds = group.getBoundingClientRect()
        return { topGap: rows[0].getBoundingClientRect().top - bounds.top,
          bottomGap: bounds.bottom - rows.at(-1).getBoundingClientRect().bottom,
          paddingTop: getComputedStyle(group).paddingTop, paddingBottom: getComputedStyle(group).paddingBottom }
      })
      assert.ok(familyBounds.topGap <= 1 && familyBounds.bottomGap <= 1, 'Blue rows cover the complete family group up to its border')
      assert.equal(familyBounds.paddingTop, '0px')
      assert.equal(familyBounds.paddingBottom, '0px')
      assert.equal(await alex.isChecked(), true)
      assert.equal(await morgan.isChecked(), true)
      assert.equal(await taylor.isChecked(), true)
      await morgan.dblclick()
      assert.equal(await alex.isChecked(), true)
      assert.equal(await morgan.isChecked(), true)
      assert.equal(await taylor.isChecked(), true)
      await alex.uncheck()
      assert.equal(await rowBlue(alex), false)
      assert.equal(await rowBlue(morgan), true)
      assert.equal(await rowBlue(taylor), true)
      assert.equal(await morgan.isChecked(), true)
      assert.equal(await taylor.isChecked(), true)
      await page.getByRole('button', { name: 'Clear selection', exact: true }).click()
      const contactsRequests = requests.filter(path => path === '/api/contacts').length
      const search = page.locator('[data-table-toolbar] input[type="text"]')
      await search.fill('Alex Example')
      await search.press('Enter')
      await page.getByText('1 contact', { exact: true }).waitFor()
      await table.getByRole('button', { name: 'Taylor Example', exact: true }).waitFor()
      assert.equal(await morgan.isDisabled(), true)
      assert.equal(await taylor.isDisabled(), true)
      await alex.check()
      assert.equal(await alex.isChecked(), true)
      assert.equal(await morgan.isChecked(), false)
      assert.equal(await taylor.isChecked(), false)
      await page.getByText('1 selected', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Clear selection', exact: true }).click()
      await view.getByRole('switch', { name: 'Families' }).uncheck()
      await table.getByRole('button', { name: 'Alex Example', exact: true }).waitFor()
      assert.equal(await table.getByRole('button', { name: 'Taylor Example', exact: true }).count(), 0)
      assert.equal(await search.inputValue(), 'Alex Example')
      assert.equal(await table.getByRole('checkbox', { checked: true }).count(), 0)
      await view.getByRole('switch', { name: 'Families' }).check()
      await table.getByRole('button', { name: 'Taylor Example', exact: true }).waitFor()
      assert.equal(await table.getByRole('button', { name: /Expand|Collapse/ }).count(), 0)
      assert.equal(requests.filter(path => path === '/api/contacts').length, contactsRequests)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      assert.deepEqual(writes, [])
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px: grouping preserves search, context not selected, no writes/refetch`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })