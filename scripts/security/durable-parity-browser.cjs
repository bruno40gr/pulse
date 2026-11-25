/* eslint-disable @typescript-eslint/no-require-imports -- Local browser with synthetic identity and intercepted API IO only. */
const assert = require('node:assert/strict')
const { createHmac } = require('node:crypto')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.PARITY_REVIEW_URL || 'http://127.0.0.1:3250'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local fixture only')
require('@next/env').loadEnvConfig(require('node:path').resolve(__dirname, '../..'))
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const tenant = uuid(1), account = uuid(2), manager = uuid(3), child = uuid(4)
const payload = Buffer.from(JSON.stringify({ actor: { instructorId: 'local-fixture', personId: 'local-fixture', displayName: 'Local Fixture', access: { kind: 'demo', tenantId: tenant } }, expiresAt: Date.now() + 3600000 })).toString('base64url')
const cookie = `${payload}.${createHmac('sha256', process.env.PULSE_SESSION_SECRET || process.env.PULSE_SYSTEM_PASSWORD || 'pulse-headliner-session-2026').update(payload).digest('base64url')}`
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.setDefaultTimeout(20000)
      await page.context().addCookies([{ name: 'pulse_access', value: cookie, url: base }])
      const errors = [], unexpected = []
      page.on('pageerror', error => errors.push(error.stack || error.message))
      let releaseDrafts
      const initialDraftGate = new Promise(resolve => { releaseDrafts = resolve })
      let drafts = [], fail = true, completed = false, delayDrafts = true, familyRevision = 0
      const familyAccounts = [{ id: account, name: 'Fixture Family', email: 'primary@example.test', phone: null }, { id: manager, name: 'Second Parent', email: 'second@example.test', phone: null }]
      const accountManagers = []
      const roster = [{ id: manager, tenant_id: tenant, first_name: 'Second', last_name: 'Parent', email: 'second@example.test', phone: null, client_status: '', is_student: false, notes_history: [], student_notes_history: [], custom_fields: {} }, { id: child, tenant_id: tenant, first_name: 'Fixture', last_name: 'Child', account_id: account,
        account_holder_name: 'Fixture Family', account_holder_email: 'primary@example.test', student_id: uuid(5),
        is_student: true, is_minor: true, family_revision: 0, client_status: 'active', notes_history: [], student_notes_history: [], custom_fields: {}, linked_account_ids: [], family_links: [],
        profile_enrollments: [{ id: uuid(60), instrument: 'Voice', service_type: 'Private', level: 2, plan_name: 'Monthly - 30 Min Private Voice', instructor: 'Fixture Teacher', lesson_day: null, lesson_time: null }] }]
      await page.route('**/api/**', async route => {
        const request = route.request(), path = new URL(request.url()).pathname
        if (path === '/api/bands/drafts') {
          if (request.method() === 'GET') {
            if (delayDrafts) await initialDraftGate
            delayDrafts = false; return route.fulfill({ json: { drafts: completed ? [] : drafts } })
          }
          const body = request.postDataJSON()
          if (fail) { fail = false; return route.fulfill({ status: 503, json: { error: 'Synthetic save failed; retry.' } }) }
          drafts = [{ id: body.draft.id, revision: body.revision + 1, state: body.draft }]
          completed = body.complete
          return route.fulfill({ json: { revision: body.revision + 1, completed, band: body.draft.data.name } })
        }
        if (path === '/api/bands') return route.fulfill({ json: { bands: completed ? [{ name: 'Resumable Fixture', members: [], status: 'active' }] : [] } })
        if (path === '/api/leads/tentative-bands/groups') return route.fulfill({ json: { groups: [] } })
        if (path === '/api/contacts') return route.fulfill({ json: roster, headers: { 'x-contacts-can-edit': 'true', 'x-contacts-can-read-notes': 'true', 'x-contacts-can-edit-notes': 'true' } })
        if (path === '/api/contacts/family') {
          if (request.method() === 'GET') { await new Promise(resolve => setTimeout(resolve, 800)); return route.fulfill({ json: { accounts: familyAccounts, managers: accountManagers } }) }
          const body = request.postDataJSON()
          if (body.kind !== 'child' && body.kind !== 'manager-link') assert.equal(body.expectedRevision, familyRevision)
          familyRevision++
          if (body.kind === 'manager-link') {
            assert.equal(body.accountId, account); assert.equal(body.personId, manager)
            accountManagers.push({ id: uuid(90), account_id: account, person_id: manager, is_primary: false, relationship: 'Account manager' })
          } else if (body.kind === 'child') {
            roster.push({ ...roster[1], id: uuid(8), first_name: body.firstName, last_name: body.lastName, student_id: uuid(9), family_revision: 1, linked_account_ids: [], family_links: [] })
          } else unexpected.push(`${request.method()} ${path}: ${body.kind}`)
          return route.fulfill({ json: { saved: true } })
        }
        if (path === '/api/staff' || path === '/api/tenant-fields' || path === '/api/funding/cases') return route.fulfill({ json: [] })
        if (path === '/api/account/identity') return route.fulfill({ json: { fullName: 'Local Fixture', firstName: 'Local', isDemo: false } })
        if (path === '/api/account/me') return route.fulfill({ json: { tenantId: tenant, canManageContacts: true, permissions: ['contacts.read', 'contacts.manage', 'notes.read', 'notes.manage'] } })
        if (request.method() !== 'GET' && path !== '/api/inbox/reconcile') unexpected.push(`${request.method()} ${path}`)
        return route.fulfill({ json: path.includes('notifications') ? { notifications: [], unreadCount: 0 } : {} })
      })
      await page.goto(`${base}/dashboard/bands`, { waitUntil: 'domcontentloaded' })
      await page.getByRole('status', { name: 'Loading bands and drafts', exact: true }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Create new band' }).isDisabled(), true)
      releaseDrafts()
      await page.getByRole('button', { name: 'Create new band' }).click()
      await page.getByLabel('Band name', { exact: true }).fill('Resumable Fixture')
      await page.getByLabel('Band description').fill('Persistent description')
      await page.getByRole('button', { name: 'Save & close', exact: true }).click()
      await page.getByText('Synthetic save failed; retry.').waitFor()
      assert.equal(await page.getByLabel('Band name', { exact: true }).inputValue(), 'Resumable Fixture')
      await page.getByRole('button', { name: 'Save & close', exact: true }).click()
      await page.getByRole('table', { name: 'Band drafts', exact: true }).waitFor()
      await page.reload()
      await page.getByRole('table', { name: 'Band drafts', exact: true }).getByRole('button', { name: 'Continue', exact: true }).click()
      assert.equal(await page.getByLabel('Band name', { exact: true }).inputValue(), 'Resumable Fixture')
      assert.equal(await page.getByLabel('Band description').inputValue(), 'Persistent description')
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await page.getByRole('button', { name: 'Create band', exact: true }).click()
      await page.getByRole('heading', { name: 'Resumable Fixture', exact: true }).waitFor()
      assert.equal(completed, true)
      await page.goto(`${base}/dashboard/contacts?account=${account}`)
      await page.getByText('Voice • Level 2', { exact: true }).waitFor()
      await page.getByText('Private • 30 min', { exact: true }).waitFor()
      assert.ok(await page.getByRole('heading', { name: 'Voice • Level 2', exact: true }).evaluate(element => Number(getComputedStyle(element).fontWeight) >= 700))
      assert.equal(await page.getByText('Monthly - 30 Min Private Voice', { exact: true }).count(), 0)
      await page.getByRole('button', { name: /edit contact/i }).click().catch(async error => {
        console.error('Contact fixture diagnostics:', errors, (await page.locator('body').innerText()).slice(-5000))
        throw error
      })
      assert.equal(await page.getByRole('region', { name: 'Dependents', exact: true }).count(), 0)
      const manageHolders = page.getByRole('button', { name: 'Manage account holders', exact: true })
      await manageHolders.waitFor().catch(async error => {
        console.error('Family diagnostics:', errors, (await page.locator('body').innerText()).slice(-6000))
        throw error
      })
      assert.equal(await page.getByRole('button', { name: 'Edit Contact', exact: true }).count(), 0)
      assert.equal(await page.getByRole('group', { name: 'Contact sections', exact: true }).count(), 0)
      assert.equal(await page.getByRole('button', { name: 'Send email', exact: true }).count(), 0)
      await page.keyboard.press('Escape')
      await page.getByRole('heading', { name: 'Edit Contact', exact: true }).waitFor()
      const familySpacing = await page.getByRole('region', { name: 'Manage Family Group', exact: true }).evaluate(element => {
        const form = element.previousElementSibling
        return element.getBoundingClientRect().top - form.getBoundingClientRect().bottom
      })
      assert.ok(familySpacing >= 16, `Family section gap: ${familySpacing}px`)
      await page.screenshot({ path: `/tmp/pulse-focused-editor-${width}.png`, fullPage: true })
      await manageHolders.click()
      const holdersForm = page.getByRole('dialog', { name: 'Manage account holders', exact: true })
      await holdersForm.getByLabel('Search contacts', { exact: true }).fill('second@example.test')
      await holdersForm.getByRole('radio', { name: 'Second Parent', exact: true }).check()
      await holdersForm.screenshot({ path: `/tmp/pulse-family-modal-holders-existing-${width}.png` })
      await holdersForm.getByRole('button', { name: 'Link account holder', exact: true }).click()
      await holdersForm.getByRole('button', { name: 'Remove account holder', exact: true }).waitFor()
      assert.equal(roster[1].account_id, account)
      await holdersForm.getByRole('radio', { name: 'New contact', exact: true }).check()
      await holdersForm.getByLabel('First name', { exact: true }).fill('Retained')
      await holdersForm.screenshot({ path: `/tmp/pulse-family-modal-holders-new-${width}.png` })
      await page.keyboard.press('Escape')
      assert.equal(await holdersForm.count(), 0)
      await page.getByRole('heading', { name: 'Edit Contact', exact: true }).waitFor()
      await manageHolders.click()
      assert.equal(await holdersForm.getByLabel('First name', { exact: true }).inputValue(), 'Retained')
      await holdersForm.getByRole('button', { name: 'Cancel', exact: true }).click()
      await page.getByRole('button', { name: 'Add student', exact: true }).click()
      const form = page.getByRole('dialog', { name: 'Add student', exact: true })
      await form.screenshot({ path: `/tmp/pulse-family-modal-student-existing-${width}.png` })
      await form.getByRole('radio', { name: 'New contact', exact: true }).check()
      await form.getByLabel('First name', { exact: true }).fill('Added')
      await form.getByLabel('Last name', { exact: true }).fill('Dependent')
      await form.screenshot({ path: `/tmp/pulse-family-modal-student-new-${width}.png` })
      await form.getByRole('button', { name: 'Add student', exact: true }).click()
      await page.getByLabel('Added Dependent family membership', { exact: true }).waitFor()
      assert.equal(await form.count(), 0)
      await page.getByRole('button', { name: 'Save changes', exact: true }).click()
      await page.getByRole('button', { name: 'Edit Contact', exact: true }).waitFor()
      await page.getByRole('group', { name: 'Contact sections', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Edit Contact', exact: true }).click()
      const nativeDialogs = []
      page.on('dialog', async dialog => { nativeDialogs.push(dialog.message()); await dialog.dismiss() })
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await page.getByRole('button', { name: 'Edit Contact', exact: true }).waitFor()
      assert.equal(await page.getByRole('dialog', { name: 'Discard contact changes', exact: true }).count(), 0)
      await page.getByRole('button', { name: 'Edit Contact', exact: true }).click()
      const editableName = page.getByLabel('Name', { exact: true })
      const originalName = await editableName.inputValue()
      await editableName.fill(`${originalName} changed`)
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      const discard = page.getByRole('dialog', { name: 'Discard contact changes', exact: true })
      await discard.waitFor()
      await discard.getByRole('button', { name: 'Keep editing', exact: true }).click()
      assert.equal(await editableName.inputValue(), `${originalName} changed`)
      await editableName.fill(originalName)
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await page.getByRole('button', { name: 'Edit Contact', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Edit Contact', exact: true }).click()
      await editableName.fill(`${originalName} changed`)
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await discard.getByRole('button', { name: 'Discard changes', exact: true }).click()
      await page.getByRole('button', { name: 'Edit Contact', exact: true }).waitFor()
      assert.deepEqual(nativeDialogs, [])
      assert.deepEqual(errors, []); assert.deepEqual(unexpected, [])
      console.log(`PASS ${width}px: subscription summary, editor spacing, unchanged/reverted cancel, app-modal keep/discard, no native dialogs; existing band/family regressions; all API IO intercepted`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })