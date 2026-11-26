/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic API fixtures; no live writes. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], patches = [], drafts = []
      let includeSavedDraft = true
      page.on('pageerror', error => errors.push(error.message))
      const band = { name: 'SunKast', status: 'active', coach: 'Bruno Wong', coaches: [{ person_id: 'coach', name: 'Bruno Wong' }], members: [
        ['breannah', 'Breannah Gonzalez', ['Voice']], ['brooks', 'Brooks Henderson', []], ['harper', 'Harper Cole', ['Drums']], ['rhett', 'Rhett Walde', []],
      ].map(([person_id, name, instruments]) => ({ person_id, name, instruments, membership: 'confirmed', source: 'enrollment' })) }
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url())
        let body = {}
        if (url.pathname === '/api/bands/members' && route.request().method() === 'PATCH') {
          const patch = route.request().postDataJSON(); patches.push(patch)
          band.members.find(row => row.person_id === patch.person_id).instruments = patch.instruments
          body = { saved: true }
        } else if (url.pathname === '/api/bands') body = { bands: [band, ...(includeSavedDraft ? [{ name: 'Saved draft', status: 'draft', coach: null, members: [] }] : [])] }
        else if (url.pathname === '/api/leads/tentative-bands/groups') body = { groups: [] }
        else if (url.pathname === '/api/bands/drafts' && route.request().method() === 'PUT') {
          const saved = route.request().postDataJSON()
          drafts.splice(0, drafts.length, { id: saved.draft.id, revision: saved.revision + 1, state: saved.draft })
          body = { revision: saved.revision + 1, completed: false }
        } else if (url.pathname === '/api/bands/drafts') body = { drafts }
        else if (url.pathname === '/api/contacts' || url.pathname === '/api/staff') body = []
        await route.fulfill({ json: body })
      })
      await page.goto(process.env.BAND_ROSTER_REVIEW_URL || 'http://127.0.0.1:3271/dashboard/bands')
      await page.getByRole('button', { name: 'Saved draft', exact: true }).filter({ visible: true }).waitFor()
      assert.equal(await page.getByRole('heading', { name: 'Band drafts', exact: true }).count(), 0)
      assert.equal(await page.getByText('No bands being formed', { exact: true }).count(), 0)
      assert.equal(await page.getByRole('textbox', { name: 'Search bands' }).count(), 0)
      await page.getByRole('button', { name: 'Form a band', exact: true }).click()
      await page.getByRole('heading', { name: 'Form a band', exact: true }).waitFor()
      const nameInput = page.getByRole('textbox', { name: /name/i }).first()
      await nameInput.fill('Resumable review draft')
      await page.getByRole('button', { name: 'Save & close', exact: true }).click()
      await page.getByRole('button', { name: 'Resumable review draft', exact: true }).filter({ visible: true }).click()
      await page.getByRole('textbox', { name: /name/i }).first().waitFor()
      assert.equal(await page.getByRole('textbox', { name: /name/i }).first().inputValue(), 'Resumable review draft')
      await page.getByRole('button', { name: 'Save & close', exact: true }).click()
      await page.getByRole('button', { name: 'Saved draft', exact: true }).filter({ visible: true }).click()
      await page.getByRole('button', { name: 'Edit band', exact: true }).waitFor()
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'SunKast', exact: true }).click()
      await page.getByRole('button', { name: 'Members', exact: true }).click()
      await page.getByText('Roster (5)', { exact: true }).waitFor()
      for (const name of ['Breannah Gonzalez', 'Brooks Henderson', 'Harper Cole', 'Rhett Walde', 'Bruno Wong']) {
        assert.ok((await page.locator('body').innerText()).includes(name), name)
      }
      const instrument = page.getByRole('button', { name: 'Instruments for Harper Cole' }).filter({ visible: true })
      await instrument.click()
      const option = page.getByRole('option', { name: 'Voice', exact: true })
      await option.click()
      await page.waitForFunction(() => document.body.innerText.includes('Voice, Drums'))
      assert.deepEqual(patches.at(-1).instruments, ['Voice', 'Drums'])
      await page.keyboard.press('Escape')
      assert.equal(await page.getByRole('listbox').count(), 0)
      assert.equal(await page.getByText('Roster (5)', { exact: true }).count(), 1)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await page.screenshot({ path: `/tmp/band-roster-${width}.png` })
      await page.getByRole('button', { name: 'Send email', exact: true }).click()
      await page.getByText('Send message to band members or their account holders', { exact: true }).waitFor()
      assert.equal(await page.getByText('Each recipient gets a separate email. Other account holders are not included.', { exact: true }).count(), 0)
      await page.getByLabel('Email delivery', { exact: true }).selectOption('shared')
      await page.getByText('One shared email. Recipients start in BCC for privacy; use Manage recipients to move them to CC or To.', { exact: true }).waitFor()
      await page.getByLabel('Channel', { exact: true }).selectOption('sms')
      await page.getByText('Each recipient gets a separate SMS—not a group text.', { exact: true }).waitFor()
      drafts.length = 0
      includeSavedDraft = false
      await page.reload()
      await page.getByText('No bands being formed', { exact: true }).waitFor()
      assert.equal(await page.getByRole('heading', { name: 'Band drafts', exact: true }).count(), 0)
      assert.equal(await page.getByText('No unfinished wizard drafts.', { exact: true }).count(), 0)
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px: single saved draft listing, no empty draft container/search, creation save/resume, correct empty copy, five-person roster, shared multi-select save/reload, Escape, no page overflow`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
