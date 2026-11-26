/* eslint-disable @typescript-eslint/no-require-imports -- Loopback-only UI checks with intercepted storage. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const base = process.env.EMAIL_TEMPLATES_REVIEW_URL || 'http://127.0.0.1:3283'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const width of [1440, 900, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } }), errors = [], writes = []
      page.on('pageerror', error => errors.push(error.message))
      let templates = [{ id: 'approved', name: 'Approved template', subject: 'Approved subject', body: 'Hello [MEMBER’S NAME]', channel: 'email', version: 0 }], fail = false, canManage = true
      await page.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url())
        assert.equal(url.pathname, '/api/conversations/templates')
        if (request.method() === 'GET') return route.fulfill({ json: { templates, can_manage: canManage, storage_available: true } })
        const body = request.postDataJSON(); writes.push({ method: request.method(), body })
        if (fail) return route.fulfill({ status: 409, json: { error: 'This template changed. Close and reopen templates.' } })
        if (request.method() === 'DELETE') templates = templates.filter(row => row.id !== body.id)
        else {
          templates = templates.filter(row => row.id !== body.id)
          templates.push({ ...body, channel: 'email', version: body.version + 1 })
        }
        return route.fulfill({ json: { saved: true } })
      })
      await page.goto(base)
      await page.getByRole('button', { name: 'Manage templates', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Email templates', exact: true })
      await dialog.getByText('Hello [MEMBER’S NAME]', { exact: true }).waitFor()
      assert.equal(await dialog.getByRole('button', { name: 'Use template', exact: true }).count(), 0)
      await dialog.getByRole('button', { name: 'Create new template', exact: true }).click()
      await dialog.getByLabel('Template name', { exact: true }).fill('New template')
      await dialog.getByLabel('Subject', { exact: true }).fill('New subject')
      await dialog.getByLabel('Message', { exact: true }).fill('New message')
      await dialog.getByRole('button', { name: 'Save template', exact: true }).click()
      await dialog.getByText('New message', { exact: true }).waitFor()
      assert.equal(writes[0].method, 'POST')
      await dialog.getByRole('button', { name: 'Edit template', exact: true }).click()
      await dialog.getByLabel('Message', { exact: true }).fill('Edited message')
      fail = true
      await dialog.getByRole('button', { name: 'Save template', exact: true }).click()
      await dialog.getByText('This template changed. Close and reopen templates.', { exact: true }).waitFor()
      assert.equal(await dialog.getByLabel('Message', { exact: true }).inputValue(), 'Edited message')
      fail = false
      await dialog.getByRole('button', { name: 'Save template', exact: true }).click()
      await dialog.getByText('Edited message', { exact: true }).waitFor()
      await dialog.getByRole('button', { name: 'Close', exact: true }).click()
      // An already-mounted composer loads the new shared list on open.
      await page.getByRole('button', { name: 'Use template', exact: true }).click()
      await dialog.getByRole('button', { name: 'New template', exact: true }).click()
      await dialog.getByText('Edited message', { exact: true }).waitFor()
      const bounds = await dialog.boundingBox()
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width)
      assert.equal(await dialog.evaluate(element => element.scrollWidth > element.clientWidth), false)
      await dialog.getByRole('button', { name: 'Remove template', exact: true }).click()
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
      assert.equal(writes.filter(row => row.method === 'DELETE').length, 0)
      await dialog.getByRole('button', { name: 'Remove template', exact: true }).click()
      await dialog.getByRole('button', { name: 'Confirm remove', exact: true }).click()
      await dialog.getByRole('button', { name: 'New template', exact: true }).waitFor({ state: 'hidden' })
      assert.equal(writes.at(-1).body.version, 2)
      await dialog.getByRole('button', { name: 'Close', exact: true }).click()
      await page.reload()
      await page.getByRole('button', { name: 'Manage templates', exact: true }).click()
      assert.equal(await dialog.getByRole('button', { name: 'New template', exact: true }).count(), 0)
      await dialog.getByRole('button', { name: 'Close', exact: true }).click()
      canManage = false
      await page.reload()
      await page.getByRole('button', { name: 'Use template', exact: true }).click()
      await dialog.getByRole('button', { name: 'Approved template', exact: true }).waitFor()
      for (const label of ['Create new template', 'Edit template', 'Remove template']) assert.equal(await dialog.getByRole('button', { name: label, exact: true }).count(), 0)
      await dialog.getByRole('button', { name: 'Use template', exact: true }).click()
      await dialog.waitFor({ state: 'hidden' })
      assert.deepEqual(errors, [])
      await page.close()
      console.log(`Shared templates: create/edit/remove, retained drafts, reload, reader access and ${width}px layout passed.`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })