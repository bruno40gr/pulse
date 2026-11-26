/* eslint-disable @typescript-eslint/no-require-imports -- Loopback-only synthetic browser acceptance; no provider sends. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.STAFF_PROFILE_REVIEW_URL || 'http://127.0.0.1:3271/staff-profile-review'
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname))
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const tenant = '00000000-0000-0000-0000-000000000001'
      const row = { id: 'teacher', tenant_id: tenant, first_name: 'Taylor', last_name: 'Teacher', phone: '2025550101', email: 'teacher@example.invalid', is_student: false, staff_id: 'instructor', is_active: true, client_status: 'active', custom_fields: {}, notes_history: [], student_notes_history: [] }
      const student = { ...row, id: 'student', first_name: 'Sam', last_name: 'Student', staff_id: null, is_student: true, student_id: 'enrolled', profile_enrollments: [] }
      const writes = [], errors = [], detailReads = []
      let editable = true, rejectStatus = false, allowSunset = false
      page.on('pageerror', error => errors.push(error.message))
      page.on('dialog', dialog => allowSunset ? dialog.accept() : dialog.dismiss())
      await page.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url())
        const fulfill = (json, extra = {}) => route.fulfill({ json, ...extra })
        if (request.method() !== 'GET') writes.push({ path: url.pathname, body: request.postDataJSON(), tenant: url.searchParams.get('tenant') })
        if (url.pathname === '/api/staff') return fulfill(row.is_active ? [{ id: 'instructor', person_id: row.id, first_name: row.first_name, last_name: row.last_name, phone: row.phone, email: row.email, is_active: true }] : [])
        if (url.pathname === '/api/contacts') return fulfill([row, student], { headers: { 'X-Contacts-Can-Edit': String(editable), 'X-Contacts-Can-Read-Notes': 'true', 'X-Contacts-Can-Edit-Notes': String(editable) } })
        if (url.pathname === '/api/contacts/teacher/profile') {
          Object.assign(row, request.postDataJSON())
          return fulfill(row)
        }
        if (url.pathname === '/api/contacts/teacher/student-notes') {
          row.student_notes_history.push({ id: 'note', text: request.postDataJSON().text, timestamp: '2026-11-25T12:00:00Z' })
          return fulfill({ student_notes_history: row.student_notes_history })
        }
        if (url.pathname.endsWith('/follow-ups')) return fulfill({ follow_ups: [], can_edit_inquiries: editable })
        if (url.pathname === '/api/contacts/teacher') {
          assert.equal(url.searchParams.get('tenant'), tenant)
          if (request.method() === 'PATCH') {
            if (rejectStatus) return fulfill({ error: 'Synthetic status failure' }, { status: 503 })
            row.is_active = request.postDataJSON().is_active
          }
          detailReads.push(row.id)
          return fulfill({ ...row, active_students: [{ enrollment_id: 'lesson', person_id: 'student', name: 'Sam Student', client_status: 'active', instrument: 'Piano', service_type: 'Private', lesson_day: 'Monday', lesson_time: '16:00' }] })
        }
        if (url.pathname === '/api/contacts/student') { detailReads.push('student'); return fulfill(student) }
        return fulfill([])
      })
      await page.goto(base)
      const open = () => page.getByRole('table', { name: 'Staff', exact: true }).getByText('Taylor Teacher', { exact: true }).click()
      await open()
      const dialog = page.getByRole('dialog').first()
      await dialog.getByText('Instructor profile', { exact: true }).waitFor()
      await dialog.getByRole('heading', { name: 'Active students (1)', exact: true }).waitFor()
      assert.equal(await dialog.getByRole('button', { name: 'Funding Program', exact: true }).count(), 0)
      const historyLength = await page.evaluate(() => history.length)
      await dialog.getByRole('link', { name: 'Sam Student', exact: true }).click()
      await dialog.getByRole('heading', { name: 'Sam Student', exact: true }).waitFor()
      assert.ok(detailReads.includes('student'))
      assert.equal(await page.evaluate(() => history.length), historyLength)
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'hidden' })
      if (width === 390) assert.equal(await page.evaluate(() => Boolean(history.state?.pulseMobileConversationProfile)), false)
      await open()
      await dialog.getByRole('button', { name: 'Edit Contact', exact: true }).click()
      await dialog.getByRole('textbox', { name: 'Phone', exact: true }).fill('2025550199')
      await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
      await dialog.getByRole('button', { name: 'Edit Contact', exact: true }).waitFor()
      assert.equal(row.phone, '2025550199')
      await dialog.getByRole('group', { name: 'Contact sections', exact: true }).getByRole('button', { name: 'Notes', exact: true }).click()
      await dialog.getByRole('button', { name: 'Add a note', exact: true }).click()
      await dialog.getByPlaceholder('Write a note...', { exact: true }).fill('Synthetic instructor follow-up')
      await dialog.getByRole('button', { name: 'Save note', exact: true }).click()
      await dialog.getByText('Synthetic instructor follow-up', { exact: true }).waitFor()
      await dialog.getByRole('group', { name: 'Contact sections', exact: true }).getByRole('button', { name: 'Account', exact: true }).click()
      const sunset = dialog.getByRole('button', { name: 'Sunset / offboard', exact: true })
      const writesBeforeStatus = writes.length
      await sunset.click()
      assert.equal(writes.length, writesBeforeStatus, 'cancelled confirmation cannot write')
      allowSunset = true; rejectStatus = true
      await sunset.click()
      await dialog.getByText('Synthetic status failure', { exact: true }).waitFor()
      await sunset.waitFor({ state: 'visible' })
      assert.equal(row.is_active, true)
      rejectStatus = false
      await sunset.click()
      await dialog.getByRole('button', { name: 'Reactivate instructor', exact: true }).waitFor()
      assert.equal(await page.getByRole('table', { name: 'Staff', exact: true }).getByText('Taylor Teacher', { exact: true }).count(), 0)
      await dialog.getByRole('button', { name: 'Reactivate instructor', exact: true }).click()
      await dialog.getByRole('button', { name: 'Sunset / offboard', exact: true }).waitFor()
      assert.equal(row.is_active, true)
      await page.getByRole('table', { name: 'Staff', exact: true }).getByText('Taylor Teacher', { exact: true }).waitFor()
      assert.ok(writes.slice(writesBeforeStatus).every(write => write.path === '/api/contacts/teacher' && write.tenant === tenant && typeof write.body.is_active === 'boolean'))
      assert.ok(writes.every(write => write.tenant === tenant))
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'hidden' })
      editable = false
      await page.reload()
      await open()
      await dialog.getByRole('heading', { name: 'Active students (1)', exact: true }).waitFor()
      assert.equal(await dialog.getByRole('button', { name: 'Sunset / offboard', exact: true }).count(), 0)
      assert.equal(await dialog.getByRole('button', { name: 'Edit Contact', exact: true }).isDisabled(), true)
      await dialog.getByRole('button', { name: 'Send SMS', exact: true }).click()
      await page.waitForURL(url => url.pathname === '/dashboard/inbox' && url.searchParams.get('recipient') === 'teacher' && url.searchParams.get('channel') === 'sms')
      await page.goto(base)
      await page.getByRole('checkbox', { name: 'Select all staff', exact: true }).check()
      await page.getByRole('button', { name: 'Send message', exact: true }).click()
      await page.getByRole('dialog').getByText('Message to 1 staff members', { exact: true }).waitFor()
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px: shared staff profile, student navigation, single history owner, edit/note persistence, cancel/error/sunset/reactivation, permissions, SMS handoff and bulk composer; synthetic writes only`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })