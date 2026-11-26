/* eslint-disable @typescript-eslint/no-require-imports -- Loopback-only fixtures, no operational sends. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.CONTACTS_SHARED_REVIEW_URL || 'http://127.0.0.1:3271'
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname))
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [1440, 390]) for (const simulated of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.setDefaultTimeout(12000)
      const errors = [], requests = [], writes = []
      const tenant = 'non-default-tenant'
      await page.addInitScript(tenant => localStorage.setItem('pulse_active_tenant', tenant), tenant)
      const person = { id: 'ordinary-contact', tenant_id: tenant, first_name: 'Ordinary', last_name: 'Contact', phone: '2025550101', email: 'ordinary@example.invalid', client_status: 'active', is_student: false, custom_fields: {}, notes_history: [{ id: 'internal', text: 'Initial internal note', timestamp: '2026-11-25T12:00:00Z' }], student_notes_history: [] }
      let editable = true
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url())
        requests.push(`${request.method()} ${url.pathname}`)
        if (simulated) return route.abort()
        if (request.method() !== 'GET') writes.push(url.pathname)
        const fulfill = (json, extra = {}) => route.fulfill({ json, ...extra })
        if (url.pathname === '/api/contacts') return fulfill([person], { headers: { 'X-Contacts-Can-Edit': String(editable), 'X-Contacts-Can-Read-Notes': 'true', 'X-Contacts-Can-Edit-Notes': String(editable) } })
        if (url.pathname === '/api/contacts/ordinary-contact/profile') {
          assert.equal(url.searchParams.get('tenant'), tenant)
          Object.assign(person, request.postDataJSON())
          return fulfill(person)
        }
        if (url.pathname === '/api/contacts/ordinary-contact/internal-notes') {
          const body = request.postDataJSON()
          if (request.method() === 'POST') person.notes_history.push({ id: 'added', text: body.text, timestamp: '2026-11-25T13:00:00Z' })
          else person.notes_history = person.notes_history.map(note => note.id === body.note_id ? { ...note, completed_at: '2026-11-25T14:00:00Z' } : note)
          return fulfill({ notes_history: person.notes_history })
        }
        if (url.pathname === '/api/contacts/ordinary-contact') return fulfill(person)
        if (url.pathname.endsWith('/follow-ups')) return fulfill({ follow_ups: [], can_edit_inquiries: editable })
        if (url.pathname === '/api/communications/recipients') return fulfill({ recipients: [{ destination: '+12025550101', name: 'Ordinary Contact', contactIds: [person.id] }], excluded: [], selectedCount: 1, version: 'fixture' })
        if (url.pathname === '/api/conversations') return fulfill({ people: [{ id: 'person:ordinary-contact', name: 'Ordinary Contact', phone: person.phone, email: person.email }] })
        return fulfill([])
      })
      const path = simulated ? '/contacts-simulated-review' : `/dashboard/contacts?tenant=${tenant}&contact=${person.id}&notes=internal`
      await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForLoadState('networkidle', { timeout: 60000 })
      const dialog = page.getByRole('dialog').first()
      const sections = () => dialog.getByRole('group', { name: 'Contact sections', exact: true })
      const tab = name => sections().getByRole('button', { name, exact: true }).click()
      const open = () => page.getByRole('table', { name: 'Contacts', exact: true }).getByRole('button', { name: simulated ? 'Fictional Student' : 'Ordinary Contact', exact: true }).click()
      if (simulated) await open()
      else {
        await dialog.getByText('Initial internal note', { exact: true }).waitFor()
        assert.equal(await dialog.getByRole('group', { name: 'Note types', exact: true }).getByRole('button', { name: 'Internal notes', exact: true }).getAttribute('aria-pressed'), 'true')
      }
      await tab('Account')
      await dialog.getByRole('button', { name: 'Edit Contact', exact: true }).click()
      await dialog.getByRole('textbox', { name: 'Phone', exact: true }).fill('2025550199')
      await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
      await dialog.getByRole('button', { name: 'Edit Contact', exact: true }).waitFor()
      await tab('Notes')
      const add = simulated ? 'Add a note' : 'Add internal note'
      await dialog.getByRole('button', { name: add, exact: true }).click()
      await dialog.getByPlaceholder('Write a note...', { exact: true }).fill('Shared profile fixture note')
      await dialog.getByRole('button', { name: 'Save note', exact: true }).click()
      await dialog.getByText('Shared profile fixture note', { exact: true }).waitFor()
      if (simulated) {
        await tab('Enrollments')
        await dialog.getByText('Enrollment fixture for fictional-student', { exact: true }).waitFor()
        await tab('Account')
        assert.equal(await dialog.getByRole('button', { name: 'Call', exact: true }).isDisabled(), true)
        assert.equal(await dialog.getByRole('button', { name: 'Send email', exact: true }).isDisabled(), true)
      } else {
        assert.equal(person.phone, '2025550199')
        assert.ok(writes.includes('/api/contacts/ordinary-contact/internal-notes'))
        await tab('Account')
      }
      const historyLength = await page.evaluate(() => history.length)
      await dialog.getByRole('button', { name: 'Send SMS', exact: true }).click()
      await dialog.getByRole('textbox', { name: 'SMS message', exact: true }).fill('Do not send')
      assert.equal(await page.evaluate(() => history.length), historyLength)
      await page.keyboard.press('Escape')
      await dialog.getByRole('button', { name: 'Send SMS', exact: true }).waitFor()
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'hidden' })
      if (!simulated) await page.getByRole('button', { name: 'Clear', exact: true }).click()
      await open()
      await tab('Notes')
      if (!simulated) await dialog.getByRole('group', { name: 'Note types', exact: true }).getByRole('button', { name: 'Internal notes', exact: true }).click()
      await dialog.getByText('Shared profile fixture note', { exact: true }).waitFor()
      if (width === 390) {
        await page.goBack()
        await dialog.waitFor({ state: 'hidden' })
      } else {
        await page.keyboard.press('Escape')
        await dialog.waitFor({ state: 'hidden' })
      }
      if (simulated) assert.deepEqual(requests, [], 'fictional panel, notes and SMS must not issue operational requests')
      else {
        editable = false
        await page.reload()
        await page.getByRole('button', { name: 'Clear', exact: true }).click()
        await open()
        assert.equal(await dialog.getByRole('button', { name: 'Edit Contact', exact: true }).isDisabled(), true)
        await tab('Notes')
        assert.equal(await dialog.getByRole('button', { name: 'Add a note', exact: true }).count(), 0)
        assert.equal(writes.some(path => /campaign|send|calls/.test(path)), false)
      }
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px ${simulated ? 'simulated' : 'non-default tenant'}: shared profile, edits/notes, initial tab, SMS/back, dismissal, permissions/enrollments and no sends`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })