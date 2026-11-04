/* eslint-disable @typescript-eslint/no-require-imports -- Fictional API fixtures; all network writes intercepted. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const url = process.env.NOTES_REVIEW_URL || 'http://127.0.0.1:3218/dashboard/notes'
const owner = '22222222-2222-4222-8222-222222222222'
const other = '33333333-3333-4333-8333-333333333333'
const contact = 'contact:55555555-5555-4555-8555-555555555555'
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 900, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1100 } })
      const page = await context.newPage()
      const errors = [], writes = []
      let failSave = false
      let notes = [{ id: 'original', title: 'Tuesday might work better', body: 'Keep the original context.', color: 'yellow', pinned: true, is_private: true, participant_count: 1, created_by: 'Synthetic Staff', completed_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), note_date: localDate(), reply_count: 1, follow_up: null }]
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', async route => {
        const request = route.request(), path = new URL(request.url()).pathname
        const data = request.method() === 'GET' ? null : request.postDataJSON()
        if (request.method() !== 'GET') writes.push({ path, method: request.method(), data })
        if (path === '/api/notes/directory') {
          const params = new URL(request.url()).searchParams
          return route.fulfill({ json: params.get('owners') ? { owners: [{ id: owner, name: 'Alex Smith' }, { id: other, name: 'Jordan Lee' }], membershipId: owner } : [{ id: contact, name: 'Michelle Morgan', kind: 'contact' }] })
        }
        if (path === '/api/staff/mention-directory') return route.fulfill({ json: [{ membership_id: owner, person_id: null, first_name: 'Alex', last_name: 'Smith', email: null }] })
        if (path === '/api/notes/title') return route.fulfill({ json: { title: 'Generated title' } })
        if (path.endsWith('/replies')) return route.fulfill({ json: [{ id: 'reply', body: 'Existing reply', created_by: 'Other Staff', created_at: new Date().toISOString() }] })
        if (path === '/api/notes' && request.method() === 'GET') return route.fulfill({ json: notes })
        if (path === '/api/notes' && request.method() === 'POST') {
          const note = { ...notes[0], ...data, id: `created-${notes.length}`, reply_count: 0, pinned: false, follow_up: data.follow_up || null }
          notes = [note, ...notes]; return route.fulfill({ json: note })
        }
        if (path.startsWith('/api/notes/') && request.method() === 'PATCH') {
          if (failSave) return route.fulfill({ status: 503, json: { error: 'Synthetic save unavailable' } })
          const id = path.split('/').at(-1)
          notes = notes.map(note => note.id === id ? { ...note, ...data, participant_count: data.follow_up ? 2 : note.participant_count } : note)
          return route.fulfill({ json: notes.find(note => note.id === id) })
        }
        return route.fulfill({ json: {} })
      })
      await page.goto(url)
      const sticky = page.getByRole('article', { name: 'Tuesday might work better', exact: true })
      await sticky.waitFor()
      await page.getByRole('combobox', { name: 'Date', exact: true }).waitFor()
      assert.equal(await page.getByText('Quick thoughts, names, phone numbers. Jot it down.', { exact: true }).count(), 0)
      assert.equal(await page.getByText('Write a note to enable adding it.', { exact: true }).count(), 0)
      const views = page.getByRole('group', { name: 'View', exact: true })
      assert.equal(await views.getByRole('button').count(), 3)
      if (width === 1440) {
        const buttonBox = await views.boundingBox(), toggleBox = await page.getByRole('switch', { name: 'Hide notes marked ‘done’' }).boundingBox()
        assert.ok(Math.abs((buttonBox.y + buttonBox.height / 2) - (toggleBox.y + toggleBox.height / 2)) < 3)
        assert.ok(toggleBox.x > buttonBox.x + buttonBox.width)
      }
      await sticky.getByRole('button', { name: 'Mark note as done' }).click()
      await sticky.getByRole('button', { name: 'Mark note as open' }).waitFor()
      assert.equal(notes[0].follow_up, null, 'Completing a plain note does not convert it to a task')
      assert.ok(notes[0].completed_at)
      await page.reload()
      await sticky.getByRole('button', { name: 'Mark note as open' }).waitFor()
      await page.getByRole('switch', { name: 'Hide notes marked ‘done’' }).click()
      await sticky.waitFor({ state: 'hidden' })
      await page.getByRole('switch', { name: 'Hide notes marked ‘done’' }).click()
      await sticky.getByRole('button', { name: 'Mark note as open' }).click()
      await sticky.getByRole('button', { name: 'Mark note as done' }).waitFor()
      assert.equal(notes[0].completed_at, null)
      await sticky.getByRole('button', { name: 'Edit Tuesday might work better' }).click()
      await sticky.getByPlaceholder('Take a note…').fill('@Alex Smith please confirm.\nKeep the original context.')
      await sticky.getByRole('button', { name: 'Convert to task', exact: true }).click()
      const panel = page.getByRole('dialog', { name: 'Task details', exact: true })
      await panel.waitFor()
      assert.match(await panel.getByLabel('Description', { exact: true }).inputValue(), /Keep the original context/)
      assert.equal(await panel.getByLabel('Owner', { exact: true }).inputValue(), owner)
      await panel.getByText('Assigning an owner adds them to this private conversation', { exact: false }).waitFor()
      await panel.getByRole('button', { name: 'Tomorrow', exact: true }).click()
      await panel.getByLabel('Related to').fill('Michelle')
      await panel.getByRole('option', { name: 'Michelle Morgan · Contact' }).click()
      await panel.getByRole('button', { name: 'Convert to task', exact: true }).click()
      await panel.waitFor({ state: 'hidden' })
      await sticky.getByRole('button', { name: 'Task assigned to Alex Smith' }).waitFor()
      assert.equal(notes.find(note => note.id === 'original').pinned, true)
      assert.equal(notes.find(note => note.id === 'original').reply_count, 1)
      assert.equal(notes.find(note => note.id === 'original').follow_up.personId, contact)
      await views.getByRole('button', { name: 'My tasks', exact: true }).click()
      await sticky.waitFor()
      await sticky.getByRole('button', { name: 'Mark note as done' }).click()
      await sticky.getByRole('button', { name: 'Mark note as open' }).waitFor()
      await views.getByRole('button', { name: 'Open tasks', exact: true }).click()
      await sticky.waitFor({ state: 'hidden' })
      await views.getByRole('button', { name: 'All notes', exact: true }).click()
      await sticky.getByRole('button', { name: 'Mark note as open' }).click()
      await sticky.getByRole('button', { name: 'Mark note as done' }).waitFor()
      await sticky.getByRole('button', { name: 'Replies 1', exact: true }).click()
      await page.getByText('Existing reply', { exact: true }).waitFor()
      await page.keyboard.press('Escape')
      await page.reload()
      await sticky.getByRole('button', { name: 'Task assigned to Alex Smith' }).waitFor()
      await sticky.getByRole('button', { name: 'Edit Tuesday might work better' }).click()
      failSave = true
      await sticky.getByPlaceholder('Take a note…').fill('Unsaved edit remains visible')
      await page.getByRole('heading', { name: 'Notes', exact: true }).click()
      await page.getByText('Your edit is still open', { exact: false }).waitFor()
      assert.equal(await sticky.getByPlaceholder('Take a note…').inputValue(), 'Unsaved edit remains visible')
      failSave = false
      await page.getByRole('heading', { name: 'Notes', exact: true }).click()
      await sticky.getByRole('button', { name: 'Edit Tuesday might work better' }).waitFor()
      const composer = page.getByPlaceholder('Take a note…', { exact: true })
      await composer.fill('@')
      assert.equal(await page.getByRole('button', { name: 'Create a task', exact: true }).count(), 0)
      await composer.fill('@Unknown')
      assert.equal(await page.getByRole('button', { name: 'Create a task', exact: true }).count(), 0)
      await composer.fill('@Michelle')
      await page.getByRole('button', { name: '@Michelle Morgan · Contact', exact: true }).click()
      assert.equal(await page.getByRole('button', { name: 'Create a task', exact: true }).count(), 0, 'Client mention alone is not a task')
      await composer.fill(`${await composer.inputValue()}@Alex Smith create a new task`)
      await page.getByRole('button', { name: 'Create a task', exact: true }).click()
      await panel.getByLabel('Related to').waitFor()
      await page.waitForFunction(() => document.querySelector('input[placeholder="Search leads or contacts…"]')?.value === 'Michelle Morgan')
      assert.equal(await panel.getByLabel('Owner', { exact: true }).inputValue(), owner)
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      await composer.fill('@Alex Smith create a new task')
      await page.getByRole('button', { name: 'Create a task', exact: true }).click()
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      assert.equal(notes.length, 1, 'Cancel does not create an orphan note')
      await page.getByRole('button', { name: 'Create a task', exact: true }).click()
      await panel.getByRole('button', { name: 'Create task', exact: true }).click()
      await panel.waitFor({ state: 'hidden' })
      assert.equal(notes.length, 2)
      assert.equal(notes[0].follow_up.ownerId, owner)
      assert.ok(writes.some(write => write.method === 'POST' && write.path === '/api/notes' && write.data.follow_up))
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
      await page.screenshot({ path: `/private/tmp/notes-production-${width}.png`, fullPage: true })
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px: persisted API contract, conversion identity/privacy/replies, filters, completion, reload, failed-save retention, composer cancellation and task creation`)
      await context.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })