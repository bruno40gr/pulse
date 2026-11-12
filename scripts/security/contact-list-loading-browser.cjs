/* eslint-disable @typescript-eslint/no-require-imports -- Local intercepted browser regression. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.CONTACT_REVIEW_URL || 'http://127.0.0.1:3227/existing-contacts'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local fixture only')
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  let release
  const fieldsGate = new Promise(resolve => { release = resolve })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = []; let contacts = 0, fields = 0, fieldsReleased = false
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/contacts') {
        contacts++
        return route.fulfill({ json: [{ id: 'fixture', first_name: 'Loaded', last_name: 'Contact', email: 'fixture@example.invalid', phone: null, is_student: true, student_id: 'student', client_status: 'active', status_class: 'active', custom_fields: {} }] })
      }
      if (path === '/api/tenant-fields') {
        fields++; await fieldsGate; fieldsReleased = true
        return route.fulfill({ json: [] })
      }
      return route.fulfill({ json: {} })
    })
    await page.goto(base)
    await page.getByText('Loaded Contact', { exact: true }).first().waitFor({ timeout: 10000 })
    assert.equal(fieldsReleased, false, 'Rows must render while fields request is pending')
    assert.equal(contacts, 1)
    assert.equal(fields, 1)
    release()
    await page.waitForTimeout(200)
    assert.deepEqual(errors, [])
    console.log(JSON.stringify({ passed: true, rowsVisibleBeforeFields: true, contactsRequests: contacts, fieldRequests: fields }))
  } finally { release(); await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })