/* eslint-disable @typescript-eslint/no-require-imports -- Local synthetic browser fixtures only. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.FOLLOW_UP_PREVIEW_URL || 'http://127.0.0.1:3226'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local preview only')
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } })
      let releaseRead, releaseSave, readFailure = false, saveFailure = false, patches = 0
      let record = { id: 'synthetic', person_id: '11111111-1111-4111-8111-111111111111', lead_intake_id: null, due_at: '2026-12-01T12:00:00Z', message: 'Existing panel message', status: 'open', version: 1 }
      const readGate = new Promise(resolve => { releaseRead = resolve })
      await page.route('**/api/**', async route => {
        if (!route.request().url().includes('/follow-ups?')) throw new Error('Unexpected API access')
        if (route.request().method() === 'GET') {
          await readGate
          return route.fulfill({ status: readFailure ? 503 : 200, json: readFailure ? { error: 'Synthetic load failure' } : { follow_ups: record ? [record] : [], can_edit_inquiries: true } })
        }
        patches++
        const body = route.request().postDataJSON()
        if (releaseSave) await releaseSave.promise
        if (saveFailure) return route.fulfill({ status: 503, json: { error: 'Synthetic save failure' } })
        record = { ...record, due_at: body.due_at, message: body.message, status: body.action === 'save' ? 'open' : 'cleared', version: (record?.version ?? 0) + 1 }
        return route.fulfill({ json: { follow_up: record } })
      })
      await page.goto(`${base}/contact-follow-ups`)
      await page.getByRole('status', { name: 'Loading follow-ups' }).waitFor()
      assert.equal(await page.getByText('No follow-up scheduled.', { exact: true }).count(), 0)
      assert.equal(await page.getByRole('button', { name: 'Add follow-up', exact: true }).count(), 0)
      releaseRead()
      await page.getByText('Existing panel message', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Edit follow-up', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Synthetic Alex follow-up', exact: true })
      assert.equal(await dialog.getByLabel('Reminder note', { exact: true }).inputValue(), 'Existing panel message')
      await dialog.getByLabel('Reminder note', { exact: true }).fill('Edited through modal')
      saveFailure = true
      await dialog.getByRole('button', { name: 'Save follow-up', exact: true }).click()
      await dialog.getByText('Could not save follow-up. Your draft is retained. Please try again.', { exact: true }).waitFor()
      assert.equal(await dialog.getByLabel('Reminder note', { exact: true }).inputValue(), 'Edited through modal')
      saveFailure = false
      let resolveSave
      releaseSave = { promise: new Promise(resolve => { resolveSave = resolve }) }
      await dialog.getByRole('button', { name: 'Save follow-up', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('button[type="submit"]')?.disabled)
      assert.equal(await dialog.getByLabel('Reminder note', { exact: true }).isDisabled(), true)
      await page.keyboard.press('Escape'); assert.equal(await dialog.isVisible(), true)
      resolveSave(); releaseSave = null
      await dialog.waitFor({ state: 'hidden' })
      await page.getByText('Edited through modal', { exact: true }).first().waitFor()
      assert.equal(await page.getByRole('status', { name: 'Loading follow-ups' }).count(), 0)
      assert.equal(await page.locator('output').textContent(), 'Edited through modal')
      assert.equal(patches, 2)
      await page.screenshot({ path: `/tmp/contact-follow-up-${width}.png`, fullPage: true })
      readFailure = true
      await page.reload()
      await page.getByText('Synthetic load failure', { exact: false }).waitFor()
      assert.equal(await page.getByText('No follow-up scheduled.', { exact: true }).count(), 0)
      readFailure = false; record = null
      await page.getByRole('button', { name: 'Reload follow-ups', exact: true }).click()
      await page.getByText('No follow-up scheduled.', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Add follow-up', exact: true }).waitFor()
      console.log(`PASS ${width}: delayed skeleton, date/message, modal-only edit, failed draft retention, pending-save dismissal prevention, table summary refresh, error/retry and verified empty state`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })