/* eslint-disable @typescript-eslint/no-require-imports -- Isolated, intercepted browser review. */
const assert = require('node:assert/strict')
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer')
const base = process.env.CONTENT_STUDIO_REVIEW_URL
if (!base || !['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use an isolated loopback review URL; never production.')

;(async () => {
  const browser = await puppeteer.launch({ headless: true, ...(process.env.CONTENT_STUDIO_BROWSER_PATH ? { executablePath: process.env.CONTENT_STUDIO_BROWSER_PATH } : {}) })
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage()
      await page.setViewport({ width, height: 1000 })
      const errors = [], actions = []
      let items = [], revision = 0, fail = false, published = null, releasePublish
      page.on('pageerror', error => errors.push(error.message))
      await page.setRequestInterception(true)
      page.on('request', async request => {
        const url = new URL(request.url())
        if (url.pathname === '/api/website-content/assets') {
          if (request.method() === 'GET') return request.respond({ status: 200, contentType: 'image/png', body: require('node:fs').readFileSync(process.env.CONTENT_STUDIO_TEST_IMAGE) })
          return request.respond({ status: 201, contentType: 'application/json', body: JSON.stringify({ url: '/api/website-content/assets?tenant=00000000-0000-0000-0000-000000000001&id=00000000-0000-0000-0000-000000000005' }) })
        }
        if (url.pathname === '/api/website-content') {
          if (request.method() === 'POST') {
            const body = JSON.parse(request.postData())
            actions.push(body.action)
            if (body.action === 'publish') await new Promise(resolve => { releasePublish = resolve })
            if (fail) { fail = false; return request.respond({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'Another admin changed the workspace. Reload before saving.' }) }) }
            assert.equal(body.revision, revision)
            if (body.action === 'publish') published = structuredClone(body.item)
            if (['unpublish', 'archive'].includes(body.action)) published = null
            const existing = items.find(item => item.id === body.item.id)
            const status = body.action === 'publish' ? 'published' : body.action === 'archive' ? 'archived' : 'draft'
            const item = { ...body.item, status, hasPublishedVersion: body.action === 'publish' || body.action === 'save' && !!existing?.hasPublishedVersion }
            items = [...items.filter(row => row.id !== item.id), item]; revision++
          }
          return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ items, revision }) })
        }
        if (url.origin === new URL(base).origin || url.protocol === 'data:') return request.continue()
        return request.abort()
      })
      const click = async text => {
        const handle = await page.evaluateHandle(text => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text), text)
        assert.ok(handle.asElement(), text)
        await handle.asElement().click(); await new Promise(resolve => setTimeout(resolve, 150))
      }
      const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
      const publishButton = () => page.$('[data-hold-confirm]')
      const pointerHold = async ms => {
        const button = await publishButton()
        await button.scrollIntoView()
        const box = await button.boundingBox()
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down(); await pause(ms); await page.mouse.up()
      }
      await page.goto(base)
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.includes('Article') && !button.disabled))
      assert.ok(!await page.$eval('body', element => element.textContent.includes('Reset prototype workspace')))
      assert.equal(await page.$('#studio-import'), null)
      assert.ok(!await page.$eval('body', element => element.textContent.includes('Import existing website content')))
      await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.includes('Article')).click())
      await page.type('#studio-title', 'Synthetic academy story')
      await page.type('#studio-summary', 'Synthetic summary')
      await page.type('#studio-body', 'Synthetic article body.')
      await click('Save draft')
      assert.equal(items.length, 1)
      await page.reload(); await page.waitForFunction(() => document.body.textContent.includes('Synthetic academy story'))
      await click('Open')
      await click('Next')
      const upload = await page.$('#studio-image')
      await upload.uploadFile(process.env.CONTENT_STUDIO_TEST_IMAGE)
      await page.waitForSelector('#studio-imageAlt')
      await page.waitForFunction(() => document.body.textContent.includes('Photo uploaded'))
      const filename = require('node:path').basename(process.env.CONTENT_STUDIO_TEST_IMAGE)
      assert.ok(await page.evaluate(name => document.body.textContent.includes(name), filename))
      assert.ok(await page.evaluate(() => document.body.textContent.includes('PNG')))
      await click('Remove photo')
      assert.ok(!await page.evaluate(() => document.body.textContent.includes('Photo uploaded')))
      await (await page.$('#studio-image')).uploadFile(process.env.CONTENT_STUDIO_TEST_IMAGE)
      await page.waitForSelector('#studio-imageAlt')
      await page.type('#studio-imageAlt', 'Synthetic image')
      await click('Save draft')
      assert.equal(items[0].imageFileName, filename)
      assert.equal(items[0].imageFileType, 'image/png')
      await page.reload(); await page.waitForFunction(() => document.body.textContent.includes('Synthetic academy story'))
      assert.equal(await page.$eval('h2', element => element.textContent.trim()), 'Your Content')
      await page.waitForFunction(() => document.querySelector('ul img')?.naturalWidth > 0)
      assert.ok(await page.$eval('ul li', element => element.textContent.includes('Article')))
      await click('Open'); await click('Next')
      assert.ok(await page.evaluate(name => document.body.textContent.includes(name) && document.body.textContent.includes('Photo uploaded'), filename))
      await click('Next')
      await page.waitForFunction(() => {
        const image = document.querySelector('[aria-label="Final preview"] img')
        return image?.complete && image.naturalWidth > 0
      })
      await click('Publish to Website')
      assert.equal(actions.filter(action => action === 'publish').length, 0, 'click must not publish')
      await pointerHold(150)
      assert.equal(actions.filter(action => action === 'publish').length, 0, 'early release must cancel')
      const button = await publishButton()
      await button.focus()
      await page.keyboard.down('Enter'); await pause(150); await page.keyboard.up('Enter')
      assert.equal(actions.filter(action => action === 'publish').length, 0, 'short keyboard hold must cancel')
      await button.focus()
      await page.keyboard.down(' '); await pause(150)
      await page.evaluate(() => window.dispatchEvent(new Event('blur')))
      await pause(1550); await page.keyboard.up(' ')
      assert.equal(actions.filter(action => action === 'publish').length, 0, 'blur must cancel')
      await button.scrollIntoView()
      const box = await button.boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down(); await pause(150)
      await page.mouse.move(0, 0); await pause(1550); await page.mouse.up()
      assert.equal(actions.filter(action => action === 'publish').length, 0, 'moving outside must cancel')
      await button.focus()
      await page.keyboard.down('Enter'); await pause(150)
      await page.keyboard.press('Escape'); await pause(1550); await page.keyboard.up('Enter')
      assert.equal(actions.filter(action => action === 'publish').length, 0, 'Escape must cancel')
      fail = true
      if (width === 390) {
        await button.scrollIntoView()
        const touchBox = await button.boundingBox()
        const client = await page.createCDPSession()
        const touch = async ms => {
          await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchBox.x + touchBox.width / 2, y: touchBox.y + touchBox.height / 2 }] })
          await pause(ms)
          await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        }
        await touch(150)
        assert.equal(actions.filter(action => action === 'publish').length, 0, 'short touch must cancel')
        await touch(1650)
        await client.detach()
      } else await pointerHold(1650)
      assert.equal(actions.filter(action => action === 'publish').length, 1)
      assert.equal(await page.$('[role="dialog"]'), null, 'no success before server response')
      releasePublish()
      await page.waitForSelector('[role="alert"]')
      assert.equal(await page.$('[role="dialog"]'), null, 'conflicts must not show success')
      assert.ok(await publishButton(), 'conflict keeps editor open')
      await button.focus()
      await page.keyboard.down(width === 390 ? 'Enter' : ' ')
      await pause(1650)
      // Repeat keydown while awaiting the server must not submit again.
      await page.keyboard.down(width === 390 ? 'Enter' : ' ')
      await pause(150)
      await page.keyboard.up(width === 390 ? 'Enter' : ' ')
      assert.equal(actions.filter(action => action === 'publish').length, 2)
      assert.equal(await page.$('[role="dialog"]'), null)
      assert.equal(await page.$eval('[data-hold-confirm]', element => element.disabled), true)
      assert.equal(await page.$eval('[data-hold-confirm]', element => element.textContent.trim()), 'Publish to Website')
      releasePublish()
      await page.waitForSelector('[role="dialog"]')
      assert.ok(await page.$eval('[role="dialog"]', element => element.textContent.includes('“Synthetic academy story” published.')))
      assert.ok(await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement)))
      assert.ok(!await page.$eval('body', element => element.textContent.includes('Continue editing') || element.textContent.includes('Refresh the connected website')))
      assert.equal(published.title, 'Synthetic academy story')
      await click('Done')
      assert.equal(await page.$('[role="dialog"]'), null)
      assert.equal(await page.$('#studio-title'), null, 'Done returns to workspace')
      await page.reload(); await page.waitForFunction(() => document.body.textContent.includes('Synthetic academy story'))
      await click('Open')
      await page.$eval('#studio-title', element => { element.select() })
      await page.type('#studio-title', 'Private revised story')
      fail = true
      await click('Save draft')
      await page.waitForSelector('[role="alert"]')
      assert.equal(await page.$eval('#studio-title', element => element.value), 'Private revised story')
      assert.equal(published.title, 'Synthetic academy story')
      await click('Save draft')
      assert.equal(items[0].title, 'Private revised story')
      assert.equal(items[0].hasPublishedVersion, true)
      assert.equal(published.title, 'Synthetic academy story')
      await page.reload(); await page.waitForFunction(() => document.body.textContent.includes('Private revised story'))
      assert.ok(await page.evaluate(() => document.body.textContent.includes('Published on website · draft edits not published')))
      await click('Remove from website')
      assert.equal(items[0].hasPublishedVersion, false)
      assert.equal(published, null)
      assert.ok(await page.evaluate(() => document.body.textContent.includes('Not published on website')))
      assert.ok(actions.includes('publish') && actions.includes('unpublish'))
      const image = items[0].image
      items = [
        { ...items[0], imageFileName: undefined, imageFileType: undefined },
        ...['event', 'deadline', 'announcement'].map((kind, index) => ({ ...items[0], id: `synthetic-${index}`, kind, title: `Synthetic ${kind}`, artwork: 'upload', image: '', artworkImage: image, artworkAlt: `Synthetic ${kind} flyer` })),
      ]
      await page.reload(); await page.waitForFunction(() => document.querySelectorAll('ul img').length === 4)
      for (const label of ['Article', 'Event', 'Deadline', 'Announcement']) {
        assert.ok(await page.evaluate(label => [...document.querySelectorAll('ul li')].some(item => item.textContent.includes(label)), label))
      }
      await page.waitForFunction(() => [...document.querySelectorAll('ul img')].every(image => image.complete && image.naturalWidth > 0))
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await page.screenshot({ path: `/tmp/odeon-article-review/content-list-${width}.png`, fullPage: true })
      await click('Open'); await click('Next')
      assert.ok(await page.evaluate(() => document.body.textContent.includes('Photo uploaded')))
      assert.ok(await page.$eval('img', image => image.naturalWidth > 0))
      await page.screenshot({ path: `/tmp/odeon-article-review/uploaded-photo-${width}.png`, fullPage: true })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}: uploaded photo/details/remove/reload, legacy photo fallback, Your Content h2, four content-type thumbnails, hold cancellation/completion, server-gated confirmation, conflict retention and draft/live separation; all APIs intercepted.`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })