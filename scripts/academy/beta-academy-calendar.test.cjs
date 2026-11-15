/* eslint-disable @typescript-eslint/no-require-imports -- Offline domain verification. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function load(file) {
  const exports = {}
  const requireLocal = name => {
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name)
    const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name)
    return load(['.ts', '.tsx'].map(ext => base + ext).find(candidate => fs.existsSync(candidate)))
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: requireLocal, Response, URL, crypto: require('node:crypto').webcrypto })
  return exports
}
const calendar = load(path.join(root, 'beta-source/lib/beta-academy-calendar.ts'))
const { createDemoWorkspace } = load(path.join(root, 'beta-source/lib/odeon-demo-workspace.ts'))
const { expandPreviewCalendar } = load(path.join(root, 'beta-source/lib/academy-makeup-preview.ts'))
const academyWeek = (data, through = '2026-11-08') => expandPreviewCalendar(data, through)
const plain = value => JSON.parse(JSON.stringify(value))

test('the academy week starts on Monday and covers seven days', () => {
  assert.deepEqual(plain(calendar.betaWeekDates('2026-11-04')), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'])
  assert.equal(calendar.betaWeekStart('2026-11-04'), '2026-11-02')
  assert.equal(calendar.betaWeekdayName('2026-11-04'), 'Wednesday')
})

test('booked lessons become blocks with their student, teacher and room', () => {
  const data = createDemoWorkspace().data
  const blocks = calendar.betaLessonOccurrences(data)
  assert.ok(blocks.length > 0)
  const block = blocks[0]
  assert.equal(block.kind, 'lesson')
  assert.equal(block.studentNames.length, 1)
  assert.ok(block.teacherName)
  assert.ok(block.room)
  assert.ok(block.end > block.start, 'A block has an end time')
  assert.equal(block.serviceType, 'Private')
})

test('the calendar shows only the week it asks for', () => {
  const data = academyWeek(createDemoWorkspace().data)
  const dates = calendar.betaWeekDates('2026-11-04')
  const blocks = calendar.betaCalendarOccurrences(data, [], [], dates)
  assert.ok(blocks.length > 0)
  assert.ok(blocks.every(block => dates.includes(block.date)))
})

test('band rehearsals and event sessions appear on the calendar', () => {
  const data = createDemoWorkspace().data
  const dates = calendar.betaWeekDates('2026-11-04')
  const band = { id: 'band-1', name: 'Beta band', leader: 'Maya Chen', capacity: 8, trialMax: 0, memberIds: ['demo:student-1-1'], schedule: '', resources: [], eventIds: [], message: '', dailySchedule: { days: ['Monday'], from: '16:00', to: '17:00' } }
  const bands = calendar.betaBandOccurrences([band], data, dates)
  assert.equal(bands.length, 1)
  assert.equal(bands[0].date, '2026-11-02')
  assert.equal(bands[0].start, '16:00')
  assert.equal(bands[0].teacherName, 'Maya Chen')
  assert.deepEqual(bands[0].studentNames, ['Emma Adams'])
  const event = { id: 'event-1', name: 'Beta recital', description: '', image: '', start: '2026-11-03', end: '2026-11-05', schedule: '', location: 'Studio 1', published: true, activities: [{ id: 'a', name: 'Recital', ages: 'all', capacity: 10, teacher: 'Maya Chen', room: 'Studio 1', schedule: '' }], signup: '', payment: '', price: '', deposit: '', access: '', approval: false, hold: '', allocation: '', cancellation: '', waiver: '', questions: '', message: '' }
  const sessions = calendar.betaEventOccurrences([event], dates)
  assert.equal(sessions.length, 3, 'One session per day of the event')
  assert.equal(sessions[0].title, 'Recital')
  assert.equal(sessions[0].serviceType, 'Event')
})

test('filter choices come from what is actually scheduled', () => {
  const data = academyWeek(createDemoWorkspace().data)
  const dates = calendar.betaWeekDates('2026-11-04')
  const blocks = calendar.betaCalendarOccurrences(data, [], [], dates)
  const choices = calendar.betaCalendarChoices(blocks)
  assert.ok(choices.staff.length > 0)
  assert.ok(choices.rooms.length > 0)
  assert.ok(choices.services.includes('Private'))
  assert.ok(choices.staff.every(staff => staff.id && staff.name))
})
