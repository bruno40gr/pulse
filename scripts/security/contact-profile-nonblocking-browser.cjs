/* eslint-disable @typescript-eslint/no-require-imports -- Local intercepted browser regression. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.CONTACT_PROFILE_REVIEW_URL || 'http://127.0.0.1:3227/contact-profile'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local fixture only')
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  let releaseInsights, releaseFunding
  const insightsGate = new Promise(resolve => { releaseInsights = resolve })
  const fundingGate = new Promise(resolve => { releaseFunding = resolve })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = [], writes = []; let insightsRequests = 0, fundingRequests = 0
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/contact-insights') {
        insightsRequests++; await insightsGate
        return route.fulfill({ json: { insights: [{ headline: 'Fixture highlight arrived', valence: 'celebrate', source: 'profile' }] } })
      }
      if (path === '/api/funding/cases') {
        fundingRequests++; await fundingGate
        return route.fulfill({ json: [] })
      }
      if (route.request().method() !== 'GET') writes.push(path)
      return route.fulfill({ json: {} })
    })
    await page.goto(base)
    await page.getByText('Loading AI highlights…', { exact: true }).waitFor()
    await page.getByText('Visible student note', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Internal notes', exact: true }).click()
    await page.getByText('Visible internal note', { exact: true }).waitFor()
    assert.equal(insightsRequests, 1)
    assert.equal(fundingRequests, 1)
    await page.getByRole('button', { name: /edit contact/i }).click()
    await page.getByRole('heading', { name: 'Edit contact', exact: true }).waitFor()
    assert.equal(await page.getByRole('textbox').count() > 0, true)
    assert.deepEqual(writes, [])
    releaseInsights(); releaseFunding()
    await page.waitForTimeout(200)
    assert.deepEqual(errors, [])
    console.log(JSON.stringify({ passed: true, profileAndNotesUsableWhileAIAndFundingPending: true, insightsRequests, fundingRequests, writes: writes.length }))
  } finally { releaseInsights(); releaseFunding(); await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })