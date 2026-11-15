/* eslint-disable @typescript-eslint/no-require-imports -- Local fictional browser regression. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://127.0.0.1:3231'
assert.match(base, /^http:\/\/127\.0\.0\.1:/, 'Use an isolated review host only')
const queueKey = 'odeon:beta-enrollment-portal:v2'
const snapshotKey = 'odeon:app-sample:v2'
const academyStaff = ['Maya Chen', 'Theo Brooks', 'Eli Foster', 'Ava Bennett', 'Noah Ellis', 'Zoe Morgan', 'Leo Carter', 'Nina Shah', 'Isabel Rivera', 'Owen Patel', 'Rowan Bell', 'Sage Monroe', 'Arden Wells', 'Quinn Avery', 'Reese Lane']

async function completeBooking(page, payment) {
  await page.goto(`${base}/odeon-demo`)
  await page.getByRole('checkbox', { name: 'Select Alex Adams', exact: true }).check()
  await page.getByRole('button', { name: 'Enroll', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  const lessonCard = page.locator('section[class*="selectedCard"]').first()
  assert.equal(await lessonCard.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(246, 248, 248)', 'Lesson setup uses a neutral card')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  assert.equal(await page.locator('button[class*="openSlot"]').first().evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(246, 248, 248)', 'Enrollment availability matches neutral rescheduling availability')
  await page.locator('button[class*="openSlot"]').first().click()
  // Several academy staff may be free, so the teacher is chosen explicitly.
  const teachers = page.getByRole('group', { name: /Teachers at/ })
  if (await teachers.count()) await teachers.getByRole('button').first().click()
  const booked = page.locator('button[class*="activeBookedSlot"]').first()
  await booked.waitFor()
  assert.notEqual(await booked.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(230, 249, 252)', 'Booked student time is not teal')
  assert.equal(await booked.evaluate(element => getComputedStyle(element, '::before').content), 'none', 'No added editing indicator')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  if (payment === 'later') await page.getByLabel('Add payment later').check()
  await page.getByRole('button', { name: 'Complete booking', exact: true }).click()
  await page.waitForTimeout(600)
}

async function completeBandMembership(page) {
  await page.goto(`${base}/odeon-demo`)
  await page.getByRole('checkbox', { name: 'Select Alex Adams', exact: true }).check()
  await page.getByRole('button', { name: 'Create band', exact: true }).click()
  await page.getByLabel('Band name', { exact: true }).fill('Beta regression band')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Create band', exact: true }).click()
  await page.waitForTimeout(400)
  if (page.viewportSize().width < 768) await page.getByRole('button', { name: 'Open menu', exact: true }).click()
  await page.getByRole('link', { name: 'Bands & ensembles', exact: true }).first().click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Beta regression band', exact: true }).click()
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await page.getByRole('button', { name: 'Actions for Emma Adams', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Enroll student', exact: true }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByLabel('I agree to the academy’s band policies.').check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByLabel('Monthly price per member ($)').fill('35')
  await page.getByLabel('Payment method').selectOption('demo_card')
  await page.getByLabel(/I authorize/).check()
  await page.getByRole('button', { name: 'Pay & subscribe', exact: true }).click()
  await page.waitForTimeout(800)
}

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const width of [1440, 390]) {
    for (const payment of ['demo_card', 'later']) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.setDefaultTimeout(30000)
      const errors = [], requests = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('request', request => {
        if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(`${request.method()} ${request.url()}`)
      })
      await completeBooking(page, payment)
      const queue = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), queueKey)
      const draft = queue.drafts.find(item => item.kind === 'enrollment')
      assert.ok(draft?.data?.completedAt, 'Booking is marked complete')
      assert.equal(draft.data.paymentStatus, payment === 'later' ? 'unpaid' : 'paid')

      await page.waitForFunction(key => !!localStorage.getItem(key), snapshotKey)
      const snapshot = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), snapshotKey)
      const student = snapshot.snapshot.data.students.find(item => item.id === 'demo:student-1-1')
      const enrollment = student.enrollments.find(item => item.id.startsWith('beta:'))
      assert.ok(enrollment, 'The booking is recorded on the student')
      assert.equal(enrollment.studentId, 'demo:student-1-1')
      assert.equal(enrollment.status, 'active')
      assert.equal(enrollment.initialPaymentStatus, payment === 'later' ? 'unpaid' : 'paid')
      assert.equal(enrollment.payerId, 'demo:family-1:holder')
      assert.ok(enrollment.amountMinor > 0, 'The recorded amount matches the priced lesson')
      assert.ok(academyStaff.includes(enrollment.teacher), 'The booking uses an academy staff member')
      assert.ok(enrollment.teacherId, 'The booking records the academy teacher identity')
      const lessons = snapshot.snapshot.data.lessons.filter(item => item.enrollmentId === enrollment.id)
      assert.equal(lessons.length, 6, 'A weekly booking creates its six dated lessons')
      assert.ok(lessons.every(item => item.time === enrollment.time && item.status === 'Scheduled'))

      await page.goto(`${base}/odeon-demo?view=parent&account=${encodeURIComponent('demo:family-1')}`)
      await page.locator('[data-parent-portal]').waitFor()
      const portal = await page.locator('[data-parent-portal]').innerText()
      const clock = enrollment.time
      const hour = Number(clock.slice(0, 2)), minute = clock.slice(3)
      const friendly = `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'pm' : 'am'}`
      assert.ok(portal.includes(enrollment.teacher), 'The family sees the booked teacher')
      assert.ok(portal.includes(friendly), 'The family sees the booked time')
      assert.deepEqual(errors, [])
      assert.deepEqual(requests, [])
      console.log(`PASS ${width} ${payment}: booking completes, is recorded on the student and reaches the family portal; no API requests/errors`)
      await page.close()
    }

    const bandPage = await browser.newPage({ viewport: { width, height: 1000 } })
    bandPage.setDefaultTimeout(30000)
    const bandErrors = [], bandRequests = []
    bandPage.on('pageerror', error => bandErrors.push(error.message))
    bandPage.on('request', request => {
      if (new URL(request.url()).pathname.startsWith('/api/')) bandRequests.push(`${request.method()} ${request.url()}`)
    })
    await completeBandMembership(bandPage)
    const queue = await bandPage.evaluate(key => JSON.parse(sessionStorage.getItem(key)), queueKey)
    const receipt = queue.enrollments.find(item => item.completedAt)
    assert.ok(receipt, 'The band enrollment is completed')
    assert.equal(receipt.paymentStatus, 'succeeded')
    assert.equal(receipt.subscriptionStatus, 'active')
    assert.equal(receipt.monthlyPrice, '35')
    const band = queue.academy.groups.find(group => group.id === receipt.bandId)
    assert.deepEqual(band.memberIds, ['demo:student-1-1'], 'The student is a confirmed member')
    assert.deepEqual(band.pendingMemberIds || [], [], 'No candidate stays pending')
    await bandPage.waitForFunction(key => !!localStorage.getItem(key), snapshotKey)
    const bandSnapshot = await bandPage.evaluate(key => JSON.parse(localStorage.getItem(key)), snapshotKey)
    const membership = bandSnapshot.snapshot.data.students.find(item => item.id === 'demo:student-1-1').enrollments.find(item => item.id.startsWith('beta:band:'))
    assert.ok(membership, 'The membership is recorded on the student')
    assert.equal(membership.program, 'Beta regression band')
    assert.equal(membership.status, 'active')
    assert.equal(membership.amountMinor, 3500)
    assert.deepEqual(bandErrors, [])
    assert.deepEqual(bandRequests, [])
    console.log(`PASS ${width} band: membership completes, confirms the member and is recorded on the student; no API requests/errors`)
    await bandPage.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
