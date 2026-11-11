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
      let items = [], revision = 0, fail = false, published = null
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
      await page.goto(base)
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.includes('Article') && !button.disabled))
      assert.ok(!await page.$eval('body', element => element.textContent.includes('Reset prototype workspace')))
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
      await page.type('#studio-imageAlt', 'Synthetic image')
      await click('Next')
      await page.waitForFunction(() => {
        const image = document.querySelector('[aria-label="Final preview"] img')
        return image?.complete && image.naturalWidth > 0
      })
      await click('Publish to Website')
      await page.waitForFunction(() => document.body.textContent.includes('Published. The website'))
      assert.equal(published.title, 'Synthetic academy story')
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
      await click('Unpublish')
      assert.equal(items[0].hasPublishedVersion, false)
      assert.equal(published, null)
      assert.ok(actions.includes('publish') && actions.includes('unpublish'))
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}: draft reload, upload, publish, conflict retention, draft/live separation and unpublish; all APIs intercepted.`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })