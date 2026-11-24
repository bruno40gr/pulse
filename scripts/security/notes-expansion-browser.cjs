/* eslint-disable @typescript-eslint/no-require-imports -- Local-only notes layout regression; every API request is intercepted. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 900, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 800 } })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const now = new Date(), date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const originalBody = '@Alex Smith\n' + Array.from({ length: 45 }, (_, index) => `Paragraph ${index + 1}: A long synthetic note must expand without overlapping its actions or hiding the end of the text.`).join('\n\n')
      let note = { id: 'long-note', title: 'Long synthetic note', body: originalBody, color: 'green', pinned: true, is_private: false, participant_count: 1, created_by: 'Synthetic Staff', completed_at: null, created_at: now.toISOString(), updated_at: now.toISOString(), note_date: date, reply_count: 0, follow_up: null }
      await page.route('**/api/**', route => {
        const request = route.request(), path = new URL(request.url()).pathname
        if (path === '/api/notes/directory') return route.fulfill({ json: { owners: [{ id: '22222222-2222-4222-8222-222222222222', name: 'Alex Smith' }], membershipId: '22222222-2222-4222-8222-222222222222' } })
        if (path === '/api/notes') return route.fulfill({ json: [note] })
        if (path === '/api/notes/long-note' && request.method() === 'PATCH') {
          note = { ...note, ...request.postDataJSON() }
          return route.fulfill({ json: note })
        }
        return route.fulfill({ json: [] })
      })
      await page.goto(process.env.NOTES_REVIEW_URL || 'http://127.0.0.1:3264')
      const card = page.getByRole('article', { name: note.title, exact: true })
      const assertFullNote = async body => {
        const noteBody = card.getByRole('button', { name: `Edit ${note.title}`, exact: true }).locator(':scope > div').last()
        assert.equal(await noteBody.innerText(), body)
        assert.ok((await card.boundingBox()).height > 460, 'Long notes are not height-capped outside editing')
        assert.ok(await noteBody.evaluate(node => node.clientHeight >= node.scrollHeight - 1 && getComputedStyle(node).webkitLineClamp === 'none'), 'Read view shows all lines without an ellipsis or internal scrolling')
        const bodyBox = await noteBody.boundingBox(), replyBox = await card.getByRole('button', { name: 'Reply', exact: true }).boundingBox()
        assert.ok(replyBox.y >= bodyBox.y + bodyBox.height, 'Read-view actions remain below the full text')
      }
      await assertFullNote(originalBody)
      await card.getByRole('button', { name: `Edit ${note.title}`, exact: true }).click()
      const editor = card.getByPlaceholder('Take a note…')
      await editor.waitFor()
      const assertExpanded = async () => {
        await page.waitForFunction(() => {
          const textarea = document.querySelector('article textarea')
          return textarea && textarea.clientHeight >= textarea.scrollHeight - 1
        })
        assert.ok((await card.boundingBox()).height > 460, 'Editing long notes has no height cap')
        const editorBox = await editor.boundingBox()
        const actionsBox = await card.getByRole('button', { name: 'Keep as note', exact: true }).boundingBox()
        assert.ok(actionsBox.y >= editorBox.y + editorBox.height, 'Footer actions stay below the entire note body')
        assert.equal(await card.locator('textarea').evaluate(node => getComputedStyle(node).overflowY), 'hidden', 'The expanded note uses page scrolling rather than a nested editor scrollbar')
      }
      await assertExpanded()
      const initialHeight = (await editor.boundingBox()).height
      await editor.fill(originalBody + '\n\n' + 'New paragraphs grow the note while typing.\n'.repeat(25))
      await assertExpanded()
      assert.ok((await editor.boundingBox()).height > initialHeight, 'Editor grows as more text is entered')
      const extendedBody = await editor.inputValue()
      await page.setViewportSize({ width: width === 390 ? 900 : 390, height: 800 })
      await assertExpanded()
      await editor.fill('@Alex Smith\nShorter note after editing.')
      assert.ok((await editor.boundingBox()).height < initialHeight, 'Editor also shrinks when content is removed')
      await editor.fill(extendedBody)
      await card.getByRole('button', { name: 'Keep as note', exact: true }).scrollIntoViewIfNeeded()
      await card.getByRole('button', { name: 'Keep as note', exact: true }).click()
      await editor.waitFor({ state: 'detached' })
      assert.equal(note.body, extendedBody, 'Saving retains all paragraphs')
      await assertFullNote(extendedBody)
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px: full unclamped read view, grow/shrink editor, resize and save without restoring a height cap`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })