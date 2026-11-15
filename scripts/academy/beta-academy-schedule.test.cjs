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
const schedule = load(path.join(root, 'beta-source/lib/beta-academy-schedule.ts'))
const { createDemoWorkspace } = load(path.join(root, 'beta-source/lib/odeon-demo-workspace.ts'))
const { createDemoSetup } = load(path.join(root, 'beta-source/lib/odeon-demo-setup.ts'))

test('the academy staff, programs and hours come from School Setup', () => {
  const setup = createDemoSetup()
  const teachers = schedule.betaAcademyTeachers(setup)
  assert.equal(teachers.length, setup.teachers.length)
  assert.ok(teachers.length > 0)
  const maya = teachers.find(teacher => teacher.name === 'Maya Chen')
  assert.ok(maya, 'Maya Chen is on the academy staff')
  assert.ok(maya.instruments.includes('Piano'))
  assert.ok(maya.blocks.length > 0)
  assert.ok(maya.blocks.every(block => block.day >= 1 && block.day <= 6), 'Availability uses calendar weekdays')
})

test('a teacher is offered only in the hours they keep and the programs they teach', () => {
  const setup = createDemoSetup()
  const teachers = schedule.betaAcademyTeachers(setup)
  const piano = { instrument: 'Piano', duration: 30 }
  const monday = '2026-11-02'
  const inHours = schedule.betaAvailableTeachers(teachers, piano, monday, '15:00', [], 'demo:student-1-1')
  assert.ok(inHours.length > 0, 'An open slot has teachers')
  assert.ok(inHours.every(teacher => teacher.instruments.includes('Piano')))
  assert.equal(schedule.betaAvailableTeachers(teachers, piano, monday, '23:00', [], 'demo:student-1-1').length, 0, 'Nobody is offered outside their hours')
  assert.equal(schedule.betaAvailableTeachers(teachers, { instrument: 'Harp', duration: 30 }, monday, '15:00', [], 'demo:student-1-1').length, 0, 'Nobody teaches an unknown program')
})

test('a teacher already teaching that slot is not offered again', () => {
  const setup = createDemoSetup()
  const teachers = schedule.betaAcademyTeachers(setup)
  const teacher = teachers[0]
  const load = [{ teacherId: teacher.id, teacher: teacher.name, date: '2026-11-02', time: '15:00', duration: 30, studentId: 'demo:student-9-1' }]
  const offered = schedule.betaAvailableTeachers(teachers, { instrument: teacher.instruments[0] || 'Piano', duration: 30 }, '2026-11-02', '15:00', load, 'demo:student-1-1')
  assert.ok(!offered.some(item => item.id === teacher.id), 'The busy teacher is not offered')
  const sameStudent = schedule.betaAvailableTeachers(teachers, { instrument: teacher.instruments[0] || 'Piano', duration: 30 }, '2026-11-02', '15:00', load, 'demo:student-9-1')
  assert.ok(!sameStudent.some(item => item.id === teacher.id), 'A student cannot be in two lessons at once')
})

test('the teaching load reflects the academy records and keeps students apart', () => {
  const data = createDemoWorkspace().data
  const load = schedule.betaTeachingLoad(data.students, data.lessons)
  assert.ok(load.length > 0)
  assert.ok(load.every(item => item.teacher && item.date && item.time))
  const teacherIds = new Set(load.map(item => item.teacherId).filter(Boolean))
  assert.ok(teacherIds.size > 0, 'Booked lessons carry the academy teacher identity')
  const rooms = schedule.betaAcademyRooms(createDemoSetup())
  assert.ok(rooms.length > 0, 'The academy has rooms')
  assert.ok(rooms.every(room => room.name))
})

test('a free room is offered at the teacher own location', () => {
  const setup = createDemoSetup()
  const teachers = schedule.betaAcademyTeachers(setup)
  const rooms = schedule.betaAcademyRooms(setup)
  const teacher = teachers[0]
  const room = schedule.betaRoomFor(rooms, teacher, '2026-11-02', '15:00', 30, [])
  assert.ok(rooms.some(item => item.name === room), 'The room belongs to the academy')
})
