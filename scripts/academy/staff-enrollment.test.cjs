/* eslint-disable @typescript-eslint/no-require-imports -- Local TypeScript test harness. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function load(file, overrides = {}) {
  const output = {}
  const localRequire = name => {
    if (overrides[name]) return overrides[name]
    if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name)
      return load(['.ts', '.tsx'].map(ext => base + ext).find(candidate => fs.existsSync(candidate)), overrides)
    }
    return require(name)
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports: output, require: localRequire, crypto: require('node:crypto').webcrypto }, { filename: file, timeout: 1000 })
  return output
}
const domain = load(path.join(root, 'lib/academy-staff-enrollment.ts'))
const ready = () => ({ ...domain.newStaffEnrollment(), student: domain.enrollmentPeople[0], lessons: [{ ...domain.newLesson('one'), teacher: domain.enrollmentTeachers[0], start: '2026-11-03', time: '16:00' }] })

test('enrollment starts with a blank student and one lesson', () => {
  const draft = domain.newStaffEnrollment()
  assert.equal(draft.student, null)
  assert.equal(draft.lessons.length, 1)
  assert.equal(draft.payment, 'later')
})

const schedule = load(path.join(root, 'lib/academy-enrollment-schedule.ts'))
test('calendar shows teachers by instrument and selected time', () => {
  const lesson = domain.newLesson('one')
  assert.equal(schedule.availableScheduleTeachers(lesson, '2026-11-03', '16:00', null, []).length, 2)
  const guitar = schedule.availableScheduleTeachers({ ...lesson, instrument: 'Guitar' }, '2026-11-03', '16:00', null, [])
  assert.equal(guitar.length, 1)
  assert.equal(guitar[0].name, 'Robin Ellis')
})
test('calendar accounts for teacher bookings and the full lesson length', () => {
  const lesson = domain.newLesson('one')
  const teachers = schedule.availableScheduleTeachers(lesson, '2026-11-03', '15:30', null, [])
  assert.equal(teachers.some(teacher => teacher.name === 'Jordan Vale'), false)
  const long = schedule.availableScheduleTeachers({ ...lesson, duration: '60' }, '2026-11-03', '17:30', null, [])
  assert.equal(long.some(teacher => teacher.name === 'Jordan Vale'), false)
})
test('teacher gap limits allow adjoining lessons and exclude a three-hour gap', () => {
  const day = [{ time: '10:00', duration: 60 }]
  assert.equal(schedule.fitsTeacherGap('11:00', 30, day, 60), true)
  assert.equal(schedule.fitsTeacherGap('12:00', 30, day, 60), true)
  assert.equal(schedule.fitsTeacherGap('14:00', 30, day, 60), false)
  assert.equal(schedule.fitsTeacherGap('14:00', 30, [], 60), true)
  const teachers = schedule.availableScheduleTeachers(domain.newLesson('one'), '2026-11-02', '14:00', null, [])
  assert.equal(teachers.some(teacher => teacher.name === 'Jordan Vale'), false)
})
test('siblings may share a time with different teachers but cannot share one teacher', () => {
  const first = { ...schedule.selectScheduleSlot(domain.newLesson('one'), '2026-11-03', '16:00', 'Jordan Vale'), studentId: 'child-one' }
  const second = { ...domain.newLesson('two'), studentId: 'child-two' }
  const available = schedule.availableScheduleTeachers(second, '2026-11-03', '16:00', { ...domain.enrollmentPeople[2], id: 'child-two' }, [first, second])
  assert.equal(available.length, 1)
  assert.equal(available[0].name, 'Robin Ellis')
})
test('each student has their own lessons and pricing', () => {
  const draft = { ...ready(), additionalStudents: [domain.enrollmentPeople[2]] }
  assert.match(domain.enrollmentStepError(draft, 1), /each student/)
  draft.lessons.push({ ...draft.lessons[0], id: 'two', studentId: domain.enrollmentPeople[2].id })
  assert.equal(domain.enrollmentStepError(draft, 1), null)
  assert.equal(domain.lessonPrice(draft.lessons[1], domain.lessonStudent(draft, draft.lessons[1])).total, 5000)
  assert.equal(domain.lessonPrice(draft.lessons[0], domain.lessonStudent(draft, draft.lessons[0])).total, 2500)
  const saved = domain.saveLocalEnrollment(draft)
  assert.notEqual(saved.additionalStudents[0], draft.additionalStudents[0])
})
test('family lessons are listed with names and times when there is more than one student', () => {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/LessonSchedule.tsx')).default
  const html = renderToStaticMarkup(React.createElement(Component, { lesson: domain.newLesson('one'), lessons: [], student: domain.enrollmentPeople[0], students: [domain.enrollmentPeople[0], domain.enrollmentPeople[2]], manager: domain.enrollmentPeople[1], onChange() {} }))
  for (const text of ['Family lessons this week', 'Riley Park', '3:00 pm', 'Piano with Jordan Vale']) assert.ok(html.includes(text), text)
  assert.ok(!html.includes('Schedule view'))
})
test('calendar prevents the student’s existing and newly chosen lessons from overlapping', () => {
  const lesson = domain.newLesson('one')
  assert.equal(schedule.availableScheduleTeachers(lesson, '2026-11-03', '15:30', domain.enrollmentPeople[2], []).length, 0)
  const other = schedule.selectScheduleSlot({ ...lesson, id: 'two', frequency: 'Weekly' }, '2026-11-03', '16:00', 'Jordan Vale')
  assert.equal(schedule.availableScheduleTeachers(lesson, '2026-11-10', '16:00', null, [other]).length, 0)
  assert.ok(schedule.availableScheduleTeachers(lesson, '2026-11-10', '16:30', null, [other]).length > 0)
})
test('family view includes a parent’s dependents and excludes unrelated appointments', () => {
  const events = schedule.familyAppointments(null, domain.enrollmentPeople[1])
  assert.equal(events.length, 1)
  assert.equal(events[0].studentName, 'Riley Park')
  assert.equal(schedule.familyAppointments(null, null).length, 0)
})
test('selecting a slot fills the lesson date, day, time and teacher', () => {
  const result = schedule.selectScheduleSlot(domain.newLesson('one'), '2026-11-04', '16:30', 'Robin Ellis')
  assert.equal(result.day, 'Wednesday')
  assert.equal(result.start, '2026-11-04')
  assert.equal(result.time, '16:30')
  assert.equal(result.teacher, 'Robin Ellis')
})
test('calendar shows all teacher blocks by default without a family toggle', () => {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/LessonSchedule.tsx')).default
  const html = renderToStaticMarkup(React.createElement(Component, { lesson: domain.newLesson('one'), lessons: [], student: null, manager: null, onChange() {} }))
  for (const text of ['Teacher preference', 'type="checkbox"', 'Jordan Vale', 'Robin Ellis', 'timeGrid', 'teachers available', 'Next week']) assert.ok(html.includes(text), text)
  for (const text of ['Choose a time for', 'Sample schedule', 'durationLegend', 'Selected lesson times', '<details', 'Teachers available at the selected', 'Schedule view', 'Family lessons this week', 'type="radio"']) assert.ok(!html.includes(text), text)
})

function hookRunner() {
  const state = []
  let index = 0
  return {
    react: { useState(initial) { const slot = index++; if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial; return [state[slot], value => { state[slot] = typeof value === 'function' ? value(state[slot]) : value }] } },
    render(component, props) { index = 0; return component(props) },
  }
}
function elements(tree) {
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(elements)]
}
test('a time with multiple teachers opens a choice at that time', () => {
  const hooks = hookRunner()
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/LessonSchedule.tsx'), { react: hooks.react }).default
  let lesson = domain.newLesson('one')
  const props = () => ({ lesson, lessons: [lesson], student: null, manager: null, onChange(patch) { lesson = { ...lesson, ...patch } } })
  let tree = hooks.render(Component, props())
  const slot = elements(tree).find(node => node.type === 'button' && node.props['aria-label'] === 'Tuesday, Nov 3 4:00 pm, 2 teachers available')
  assert.ok(slot)
  slot.props.onClick()
  assert.equal(lesson.teacher, '')
  tree = hooks.render(Component, props())
  const group = elements(tree).find(node => node.props?.['aria-label'] === 'Teachers at 4:00 pm')
  elements(group).find(node => node.type === 'button' && node.props.children === 'Robin Ellis').props.onClick()
  assert.equal(lesson.teacher, 'Robin Ellis')
  assert.equal(lesson.start, '2026-11-03')
  assert.equal(lesson.time, '16:00')
})
test('person fields save as typed, stay open within the form, and become a card on leaving', () => {
  const hooks = hookRunner()
  const { PersonPicker } = load(path.join(root, 'app/content-studio-prototype/enrollment/StaffEnrollment.tsx'), { react: hooks.react })
  let value = null
  let added = null
  const props = () => ({ title: 'Student', value, people: [], onChange(person) { value = person }, onAdd(person) { added = person } })
  let tree = hooks.render(PersonPicker, props())
  let inputs = elements(tree).filter(node => node.type === 'input')
  inputs[0].props.onChange({ target: { value: 'Taylor' } })
  tree = hooks.render(PersonPicker, props())
  inputs = elements(tree).filter(node => node.type === 'input')
  inputs[1].props.onChange({ target: { value: 'Lane' } })
  assert.equal(value.firstName, 'Taylor')
  assert.equal(value.lastName, 'Lane')
  tree = hooks.render(PersonPicker, props())
  const editor = elements(tree).find(node => node.props?.onBlur)
  editor.props.onBlur({ currentTarget: { contains: () => true }, relatedTarget: {} })
  assert.equal(added, null)
  editor.props.onBlur({ currentTarget: { contains: () => false }, relatedTarget: {} })
  assert.equal(added.firstName, 'Taylor')
  tree = hooks.render(PersonPicker, props())
  assert.equal(elements(tree).filter(node => node.type === 'input').length, 0)
  assert.ok(elements(tree).some(node => node.type === 'strong' && node.props.children === 'Taylor Lane'))
})
test('search finds existing people without choosing or merging them', () => {
  assert.equal(domain.searchEnrollmentPeople('').length, 0)
  assert.equal(domain.searchEnrollmentPeople(' park ').length, 2)
  assert.equal(domain.searchEnrollmentPeople('AVERY@').length, 1)
})
test('student details are required when continuing', () => {
  assert.match(domain.enrollmentStepError(domain.newStaffEnrollment(), 0), /Choose a student/)
  assert.equal(domain.enrollmentStepError(ready(), 0), null)
})
test('parent and payer can be added without replacing the student', () => {
  const draft = { ...ready(), manager: domain.enrollmentPeople[1], payer: 'manager' }
  assert.equal(domain.enrollmentStepError(draft, 0), null)
  assert.equal(domain.saveLocalEnrollment(draft).student.id, domain.enrollmentPeople[0].id)
  assert.match(domain.enrollmentStepError({ ...draft, manager: null }, 0), /parent or guardian/)
  assert.match(domain.enrollmentStepError({ ...draft, manager: draft.student }, 0), /another person/)
})
test('lesson details can continue without a time, but scheduling and saving require one', () => {
  const draft = { ...ready(), lessons: [{ ...ready().lessons[0], teacher: '', start: '', time: '' }] }
  assert.equal(domain.enrollmentStepError(draft, 1), null)
  assert.match(domain.enrollmentStepError(draft, 2), /teacher, start date and time/)
  assert.throws(() => domain.saveLocalEnrollment(draft), /teacher, start date and time/)
})
test('each lesson needs a teacher, date and time', () => {
  for (const patch of [{ teacher: '' }, { start: '' }, { time: '' }]) {
    assert.match(domain.enrollmentStepError({ ...ready(), lessons: [{ ...ready().lessons[0], ...patch }] }, 2), /teacher, start date and time/)
  }
})
test('teacher discount applies to every lesson for an explicitly active teacher', () => {
  for (const duration of ['30', '60']) {
    const price = domain.lessonPrice({ ...domain.newLesson('one'), duration }, domain.enrollmentPeople[0])
    assert.equal(price.total, price.base / 2)
  }
  assert.equal(domain.lessonPrice(domain.newLesson('one'), domain.enrollmentPeople[1]).discount, 0)
})
test('a parent’s teacher benefit does not transfer to a child', () => {
  const draft = { ...ready(), student: domain.enrollmentPeople[2], manager: domain.enrollmentPeople[0] }
  assert.equal(domain.lessonPrice(draft.lessons[0], draft.student).total, 5000)
})
test('multiple lessons and either payment choice remain local drafts', () => {
  for (const payment of ['later', 'demo_card']) {
    const draft = { ...ready(), payment, lessons: [...ready().lessons, { ...ready().lessons[0], id: 'two', instrument: 'Voice' }] }
    const saved = domain.saveLocalEnrollment(draft)
    assert.equal(saved.lessons.length, 2)
    assert.equal(saved.payment, payment)
    assert.notEqual(saved.lessons[0], draft.lessons[0])
    assert.equal('status' in saved, false)
  }
})
test('initial screen renders a clean staff enrollment form', () => {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/StaffEnrollment.tsx')).default
  const html = renderToStaticMarkup(React.createElement(Component))
  for (const text of ['Enroll a student', 'Family details', 'Add parent or guardian', 'Add another student', 'First name', 'Last name', 'Enroll an existing student or lead', 'Continue']) assert.ok(html.includes(text), text)
  assert.ok(!html.includes('type="search"'))
  assert.ok(html.indexOf('Add parent or guardian') < html.indexOf('Student 1'))
  for (const text of ['Approve', 'pending_payment', 'USD fixture amounts', 'No people found.', 'role="alert"']) assert.ok(!html.includes(text), text)
})
test('every student gets a visible lesson without adding one manually', () => {
  const draft = { ...ready(), additionalStudents: [domain.enrollmentPeople[2]] }
  const lessons = domain.ensureStudentLessons(draft)
  assert.equal(lessons.length, 2)
  assert.equal(lessons[1].studentId, domain.enrollmentPeople[2].id)
  assert.equal(lessons[1].frequency, 'Monthly subscription')
  assert.equal(domain.ensureStudentLessons({ ...draft, lessons }).length, 2)
})
test('teacher filtering keeps only that teacher’s blocks and can show all again', () => {
  const hooks = hookRunner()
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/LessonSchedule.tsx'), { react: hooks.react }).default
  const props = { lesson: domain.newLesson('one'), lessons: [], student: null, manager: null, onChange() {} }
  let tree = hooks.render(Component, props)
  elements(tree).filter(node => node.type === 'input' && node.props.type === 'checkbox')[1].props.onChange({ target: { checked: false } })
  tree = hooks.render(Component, props)
  assert.ok(!elements(tree).some(node => node.props?.['aria-label']?.includes('2 teachers available')))
  assert.ok(elements(tree).some(node => node.props?.['aria-label']?.includes('1 teacher available')))
  elements(tree).filter(node => node.type === 'input' && node.props.type === 'checkbox')[1].props.onChange({ target: { checked: true } })
  tree = hooks.render(Component, props)
  assert.ok(elements(tree).some(node => node.props?.['aria-label']?.includes('2 teachers available')))
})
test('a time with one teacher selects the lesson immediately', () => {
  const hooks = hookRunner()
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/LessonSchedule.tsx'), { react: hooks.react }).default
  let lesson = { ...domain.newLesson('one'), instrument: 'Guitar' }
  const props = { lesson, lessons: [], student: null, manager: null, onChange(patch) { lesson = { ...lesson, ...patch } } }
  const tree = hooks.render(Component, props)
  elements(tree).find(node => node.props?.['aria-label'] === 'Tuesday, Nov 3 4:00 pm, 1 teacher available').props.onClick()
  assert.equal(lesson.teacher, 'Robin Ellis')
  assert.equal(lesson.time, '16:00')
})
test('student cards select the active calendar without a separate bottom toggle', () => {
  const hooks = hookRunner()
  hooks.react.useRef = () => ({ current: null })
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/StaffEnrollment.tsx'), { react: hooks.react }).default
  let tree = hooks.render(Component, {})
  const picker = elements(tree).find(node => node.props?.title === 'Student 1')
  picker.props.onChange(domain.enrollmentPeople[0])
  tree = hooks.render(Component, {})
  elements(tree).find(node => node.props?.children?.some?.(child => child === 'Add another student')).props.onClick()
  tree = hooks.render(Component, {})
  const pickers = elements(tree).filter(node => node.props?.onAdd && node.props?.people)
  pickers[pickers.length - 1].props.onChange(domain.enrollmentPeople[2])
  tree = hooks.render(Component, {})
  elements(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  tree = hooks.render(Component, {})
  assert.ok(!elements(tree).some(node => node.props?.students && node.props?.lesson))
  assert.equal(elements(tree).filter(node => node.type === 'select').length, 6)
  assert.ok(elements(tree).some(node => node.type === 'label' && node.props.children[0] === 'Cadence'))
  elements(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  tree = hooks.render(Component, {})
  assert.equal(elements(tree).filter(node => node.type === 'select').length, 0)
  const cards = elements(tree).filter(node => node.type === 'section' && node.props?.onClick && node.props?.onFocus)
  assert.equal(cards.length, 2)
  assert.ok(!elements(tree).some(node => node.props?.['aria-label'] === 'Lesson calendar'))
  cards[1].props.onClick()
  tree = hooks.render(Component, {})
  const calendar = elements(tree).find(node => node.props?.onChange && node.props?.students && node.props?.lesson)
  assert.equal(calendar.props.student.id, domain.enrollmentPeople[2].id)
  assert.ok(elements(tree).some(node => node.type === 'button' && node.props['aria-pressed'] === true && node.props.children === 'Riley Park'))
})

test('additional lessons require a student choice without changing automatic lessons', () => {
  const hooks = hookRunner()
  hooks.react.useRef = () => ({ current: null })
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/StaffEnrollment.tsx'), { react: hooks.react }).default
  let tree = hooks.render(Component, {})
  elements(tree).find(node => node.props?.title === 'Student 1').props.onChange(domain.enrollmentPeople[0])
  tree = hooks.render(Component, {})
  elements(tree).find(node => node.props?.children?.some?.(child => child === 'Add another student')).props.onClick()
  tree = hooks.render(Component, {})
  elements(tree).filter(node => node.props?.onAdd && node.props?.people).at(-1).props.onChange(domain.enrollmentPeople[2])
  tree = hooks.render(Component, {})
  elements(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  tree = hooks.render(Component, {})
  elements(tree).find(node => node.props?.children?.some?.(child => child === 'Add another lesson')).props.onClick()
  tree = hooks.render(Component, {})
  const studentLabels = elements(tree).filter(node => node.type === 'label' && node.props.children[0] === 'Student')
  assert.equal(studentLabels.length, 1)
  const select = elements(studentLabels[0]).find(node => node.type === 'select')
  assert.equal(select.props.value, '')
  elements(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  tree = hooks.render(Component, {})
  assert.ok(elements(tree).some(node => node.props?.role === 'alert' && /student for each lesson/.test(node.props.children)))
  select.props.onChange({ target: { value: domain.enrollmentPeople[2].id } })
  tree = hooks.render(Component, {})
  elements(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  tree = hooks.render(Component, {})
  assert.ok(elements(tree).some(node => node.props?.students && node.props?.lesson))
})

const pricing = load(path.join(root, 'lib/academy-enrollment-pricing.ts'))
test('monthly preview counts remaining dates and next month dates at each student rate', () => {
  const draft = { ...ready(), lessons: [
    { ...ready().lessons[0], start: '2026-10-29', duration: '60' },
    { ...ready().lessons[0], id: 'two', start: '2026-11-11' },
  ] }
  const bill = pricing.enrollmentBillingPreview(draft)
  assert.equal(bill.nextDate, '2026-11-01')
  assert.equal(bill.current.lines[0].dates.join(','), '2026-10-29')
  assert.equal(bill.current.total, 5000)
  assert.equal(bill.next.lines[0].dates.length, 4)
  assert.equal(bill.next.lines[1].dates.length, 3)
  assert.equal(bill.next.total, 27500)
})
test('billing preview handles future starts, leap months, year boundaries and one-off lessons', () => {
  const draft = { ...ready(), lessons: [{ ...ready().lessons[0], start: '2026-12-03' }] }
  assert.equal(pricing.enrollmentBillingPreview(draft).next.total, 0)
  assert.equal(pricing.enrollmentBillingPreview(draft, '2026-12-20').nextDate, '2027-01-01')
  const leap = pricing.enrollmentBillingPreview({ ...draft, lessons: [{ ...draft.lessons[0], start: '2028-02-01' }] }, '2028-02-01')
  assert.equal(leap.current.lines[0].dates.length, 5)
  const single = pricing.enrollmentBillingPreview({ ...draft, lessons: [{ ...draft.lessons[0], frequency: 'À-la-carte' }] })
  assert.equal(single.current.total, 2500)
  assert.equal(single.next.total, 0)
})
test('selected slots show only the name, use a booked style, and span their actual duration', () => {
  const hooks = hookRunner()
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/LessonSchedule.tsx'), { react: hooks.react }).default
  const first = { ...ready().lessons[0], duration: '60', studentId: 'demo-avery' }
  const second = { ...domain.newLesson('second'), studentId: 'demo-riley' }
  const props = { lesson: second, lessons: [first, second], student: domain.enrollmentPeople[2], students: [domain.enrollmentPeople[0], domain.enrollmentPeople[2]], manager: null, onChange() {} }
  const tree = hooks.render(Component, props)
  const booked = elements(tree).filter(node => node.props?.className?.includes('bookedSlot') && node.props.children === 'Avery Lane' && node.props['aria-label']?.includes('Nov 3'))
  assert.equal(booked.length, 1)
  assert.equal(booked[0].props.children, 'Avery Lane')
  assert.match(booked[0].props.style.gridRow, /span 2/)
  assert.ok(!booked[0].props.className.includes('shortLesson'))
  assert.ok(!elements(tree).some(node => node.props?.className === 'selectionRow'))
  assert.ok(!elements(tree).some(node => node.props?.className === 'durationLegend'))
  const longTree = hooks.render(Component, { ...props, lesson: first, student: domain.enrollmentPeople[0] })
  for (const block of elements(longTree).filter(node => node.props?.className === 'slotOption')) assert.match(block.props.style.gridRow, /span 2/)
  assert.ok(elements(longTree).some(node => node.props?.className?.includes('activeBookedSlot') && node.props.children === 'Avery Lane'))
})

test('booking replaces the available start option with a single name-only block', () => {
  const hooks = hookRunner()
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/LessonSchedule.tsx'), { react: hooks.react }).default
  let lesson = { ...domain.newLesson('one'), instrument: 'Guitar', studentId: 'demo-avery' }
  const props = () => ({ lesson, lessons: [lesson], student: domain.enrollmentPeople[0], manager: null, onChange(patch) { lesson = { ...lesson, ...patch } } })
  let tree = hooks.render(Component, props())
  const label = 'Tuesday, Nov 3 4:00 pm, 1 teacher available'
  elements(tree).find(node => node.props?.['aria-label'] === label).props.onClick()
  tree = hooks.render(Component, props())
  assert.ok(!elements(tree).some(node => node.props?.['aria-label'] === label))
  assert.equal(elements(tree).filter(node => node.props?.children === 'Avery Lane' && node.props['aria-label']?.includes('Nov 3')).length, 1)
})

test('all teachers can be unchecked without hiding booked lessons', () => {
  const hooks = hookRunner()
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/LessonSchedule.tsx'), { react: hooks.react }).default
  const lesson = { ...ready().lessons[0], studentId: 'demo-avery' }
  const props = { lesson, lessons: [lesson], student: domain.enrollmentPeople[0], manager: null, onChange() {} }
  let tree = hooks.render(Component, props)
  for (const input of elements(tree).filter(node => node.type === 'input')) input.props.onChange({ target: { checked: false } })
  tree = hooks.render(Component, props)
  assert.ok(!elements(tree).some(node => node.props?.className?.includes('openSlot')))
  assert.ok(elements(tree).some(node => node.props?.children === 'Avery Lane'))
})

test('third-party payer validates and is copied without altering the family or prices', () => {
  const draft = { ...ready(), payer: 'other', otherPayer: { name: '', email: '', phone: '' } }
  assert.match(domain.enrollmentStepError(draft, 4), /payer’s name/)
  assert.throws(() => domain.saveLocalEnrollment(draft), /payer’s name/)
  draft.otherPayer = { name: 'Alta', email: 'bad', phone: '' }
  assert.match(domain.enrollmentStepError(draft, 4), /payer email/)
  draft.otherPayer.email = 'billing@example.test'
  const saved = domain.saveLocalEnrollment(draft)
  assert.equal(saved.otherPayer.name, 'Alta')
  assert.notEqual(saved.otherPayer, draft.otherPayer)
  assert.equal(saved.student.id, draft.student.id)
  assert.equal(domain.lessonPrice(saved.lessons[0], saved.student).total, 2500)
})

test('payment offers an additional payer and retains their details when switching payers', () => {
  const hooks = hookRunner()
  hooks.react.useRef = () => ({ current: null })
  let initialized = false
  const stateHook = hooks.react.useState
  hooks.react.useState = initial => {
    if (!initialized) { initialized = true; return stateHook(ready()) }
    return stateHook(initial)
  }
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/StaffEnrollment.tsx'), { react: hooks.react }).default
  let tree = hooks.render(Component, {})
  for (let step = 0; step < 4; step++) {
    elements(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
    tree = hooks.render(Component, {})
  }
  elements(tree).find(node => node.props?.children?.some?.(child => child === 'Add another payer')).props.onClick()
  tree = hooks.render(Component, {})
  const name = elements(tree).find(node => node.type === 'label' && node.props.children[0] === 'Name or organization')
  elements(name).find(node => node.type === 'input').props.onChange({ target: { value: 'Grandpa' } })
  tree = hooks.render(Component, {})
  const payer = elements(tree).find(node => node.type === 'select')
  assert.equal(payer.props.value, 'other')
  payer.props.onChange({ target: { value: 'student' } })
  tree = hooks.render(Component, {})
  assert.ok(elements(tree).some(node => node.type === 'input' && node.props.value === 'Grandpa'))
  elements(tree).find(node => node.type === 'select').props.onChange({ target: { value: 'other' } })
  tree = hooks.render(Component, {})
  elements(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  tree = hooks.render(Component, {})
  assert.ok(elements(tree).some(node => node.type === 'dd' && node.props.children === 'Grandpa'))
})


test('existing student checkbox opens lookup and choosing a result fills the person', () => {
  const hooks = hookRunner()
  const { PersonPicker } = load(path.join(root, 'app/content-studio-prototype/enrollment/StaffEnrollment.tsx'), { react: hooks.react })
  let value = null
  const props = () => ({ title: 'Student', studentLookup: true, value, people: domain.enrollmentPeople, onChange(person) { value = person }, onAdd() {} })
  let tree = hooks.render(PersonPicker, props())
  assert.equal(elements(tree).filter(node => node.type === 'input' && node.props.type !== 'checkbox').length, 4)
  elements(tree).find(node => node.props?.type === 'checkbox').props.onChange({ target: { checked: true } })
  tree = hooks.render(PersonPicker, props())
  elements(tree).find(node => node.props?.type === 'search').props.onChange({ target: { value: 'Avery' } })
  tree = hooks.render(PersonPicker, props())
  const result = elements(tree).find(node => node.type === 'button' && elements(node).some(child => child.type === 'strong' && child.props.children === 'Avery Lane'))
  result.props.onClick()
  tree = hooks.render(PersonPicker, props())
  assert.equal(value.id, 'demo-avery')
  assert.ok(!elements(tree).some(node => node.props?.type === 'search'))
})

test('every displayed one-hour option selects immediately or opens inline teacher choices', () => {
  const sourceHooks = hookRunner()
  const file = path.join(root, 'app/content-studio-prototype/enrollment/LessonSchedule.tsx')
  const Source = load(file, { react: sourceHooks.react }).default
  const base = { ...domain.newLesson('hour'), duration: '60' }
  const initial = sourceHooks.render(Source, { lesson: base, lessons: [base], student: null, manager: null, onChange() {} })
  const labels = elements(initial).filter(node => node.type === 'button' && node.props.className?.includes('openSlot')).map(node => node.props['aria-label'])
  assert.ok(labels.length > 10)
  for (const label of labels) {
    const hooks = hookRunner()
    const Component = load(file, { react: hooks.react }).default
    let lesson = { ...base }
    const props = () => ({ lesson, lessons: [lesson], student: null, manager: null, onChange(patch) { lesson = { ...lesson, ...patch } } })
    let tree = hooks.render(Component, props())
    elements(tree).find(node => node.props?.['aria-label'] === label).props.onClick()
    tree = hooks.render(Component, props())
    if (!lesson.teacher) {
      const inline = elements(tree).find(node => node.props?.className === 'inlineTeachers')
      assert.ok(inline, label)
      elements(inline).find(node => node.type === 'button').props.onClick()
    }
    assert.ok(lesson.teacher, label)
    assert.ok(lesson.start && lesson.time, label)
  }
})

test('draft bookings switch active lesson and existing appointments are not dead buttons', () => {
  const hooks = hookRunner()
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/LessonSchedule.tsx'), { react: hooks.react }).default
  const first = { ...ready().lessons[0], studentId: 'demo-avery' }
  let selected = ''
  const tree = hooks.render(Component, { lesson: domain.newLesson('second'), lessons: [first], student: domain.enrollmentPeople[0], manager: null, onChange() {}, onSelectLesson(id) { selected = id } })
  const booked = elements(tree).find(node => node.type === 'button' && node.props.className?.includes('bookedSlot'))
  booked.props.onClick()
  assert.equal(selected, first.id)
  assert.ok(elements(tree).some(node => node.type === 'div' && node.props?.className?.includes('bookedSlot')))
})

test('changing the first lesson teacher frees Robin for an overlapping sibling lesson', () => {
  const hooks = hookRunner()
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/LessonSchedule.tsx'), { react: hooks.react }).default
  const student = { ...domain.enrollmentPeople[0], id: 'student-one' }
  const sibling = { ...domain.enrollmentPeople[2], id: 'student-two' }
  let first = { ...schedule.selectScheduleSlot(domain.newLesson('first'), '2026-11-03', '16:00', 'Robin Ellis'), studentId: student.id }
  const second = { ...domain.newLesson('second'), instrument: 'Voice', studentId: sibling.id }
  const available = () => schedule.availableScheduleTeachers(second, '2026-11-03', '16:00', sibling, [first, second])
  assert.equal(available().length, 0)
  const props = () => ({ lesson: first, lessons: [first, second], student, students: [student, sibling], manager: null, onChange(patch) { first = { ...first, ...patch } }, onSelectLesson() {} })
  let tree = hooks.render(Component, props())
  elements(tree).find(node => node.props?.children === 'Change teacher').props.onClick()
  tree = hooks.render(Component, props())
  const group = elements(tree).find(node => node.props?.['aria-label'] === 'Change teacher')
  elements(group).find(node => node.props?.children === 'Jordan Vale').props.onClick()
  assert.equal(first.teacher, 'Jordan Vale')
  assert.equal(first.start, '2026-11-03')
  assert.equal(first.time, '16:00')
  assert.equal(available()[0].name, 'Robin Ellis')
})

test('clearing a guitar booking preserves the lesson and frees Robin for voice', () => {
  const hooks = hookRunner()
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/LessonSchedule.tsx'), { react: hooks.react }).default
  let lesson = { ...schedule.selectScheduleSlot({ ...domain.newLesson('guitar'), instrument: 'Guitar' }, '2026-11-03', '16:00', 'Robin Ellis'), studentId: 'one' }
  const second = { ...domain.newLesson('voice'), instrument: 'Voice', studentId: 'two' }
  const student = { ...domain.enrollmentPeople[0], id: 'one' }
  const sibling = { ...domain.enrollmentPeople[2], id: 'two' }
  const props = () => ({ lesson, lessons: [lesson, second], student, manager: null, onChange(patch) { lesson = { ...lesson, ...patch } }, onSelectLesson() {} })
  let tree = hooks.render(Component, props())
  elements(tree).find(node => node.type === 'button' && node.props.className?.includes('activeBookedSlot')).props.onClick()
  tree = hooks.render(Component, props())
  const group = elements(tree).find(node => node.props?.['aria-label'] === 'Change teacher')
  assert.equal(elements(group).filter(node => node.type === 'button' && node.props['aria-pressed'] !== undefined).length, 1)
  elements(tree).find(node => node.props?.children === 'Clear time').props.onClick()
  assert.equal(lesson.teacher, '')
  assert.equal(lesson.time, '')
  assert.equal(lesson.id, 'guitar')
  assert.equal(lesson.instrument, 'Guitar')
  assert.equal(lesson.duration, '30')
  assert.equal(schedule.availableScheduleTeachers(second, '2026-11-03', '16:00', sibling, [lesson, second])[0].name, 'Robin Ellis')
  tree = hooks.render(Component, props())
  assert.ok(elements(tree).some(node => node.props?.['aria-label'] === 'Tuesday, Nov 3 4:00 pm, 1 teacher available'))
})

test('teacher editing ignores preference filters but still excludes conflicting teachers', () => {
  const hooks = hookRunner()
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/LessonSchedule.tsx'), { react: hooks.react }).default
  const first = { ...schedule.selectScheduleSlot(domain.newLesson('first'), '2026-11-03', '16:00', 'Robin Ellis'), studentId: 'one' }
  const second = { ...schedule.selectScheduleSlot(domain.newLesson('second'), '2026-11-03', '16:00', 'Jordan Vale'), studentId: 'two' }
  const props = { lesson: first, lessons: [first, second], student: null, manager: null, onChange() {} }
  let tree = hooks.render(Component, props)
  for (const input of elements(tree).filter(node => node.props?.type === 'checkbox')) input.props.onChange({ target: { checked: false } })
  tree = hooks.render(Component, props)
  elements(tree).find(node => node.props?.children === 'Change teacher').props.onClick()
  tree = hooks.render(Component, props)
  const group = elements(tree).find(node => node.props?.['aria-label'] === 'Change teacher')
  assert.ok(elements(group).some(node => node.props?.children === 'Robin Ellis'))
  assert.ok(!elements(group).some(node => node.props?.children === 'Jordan Vale'))
  elements(group).find(node => node.props?.children === 'Cancel').props.onClick()
  tree = hooks.render(Component, props)
  assert.ok(!elements(tree).some(node => node.props?.['aria-label'] === 'Change teacher'))
})

test('scheduling cannot delete a lesson and Back returns to lesson setup', () => {
  const hooks = hookRunner()
  hooks.react.useRef = () => ({ current: null })
  const stateHook = hooks.react.useState
  let initialized = false
  hooks.react.useState = initial => {
    if (!initialized) {
      initialized = true
      const draft = ready()
      return stateHook({ ...draft, lessons: [...draft.lessons, { ...domain.newLesson('extra'), studentId: draft.student.id }] })
    }
    return stateHook(initial)
  }
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/StaffEnrollment.tsx'), { react: hooks.react }).default
  let tree = hooks.render(Component, {})
  elements(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  tree = hooks.render(Component, {})
  assert.ok(elements(tree).some(node => node.props?.['aria-label'] === 'Remove lesson 2'))
  elements(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  tree = hooks.render(Component, {})
  assert.ok(!elements(tree).some(node => node.props?.['aria-label']?.startsWith('Remove lesson')))
  elements(tree).find(node => node.props?.children?.some?.(child => child === 'Back')).props.onClick()
  tree = hooks.render(Component, {})
  assert.ok(elements(tree).some(node => node.props?.children?.some?.(child => child === 'Add another lesson')))
})

test('entering the calendar selects the first lesson instead of the last added lesson', () => {
  const hooks = hookRunner()
  hooks.react.useRef = () => ({ current: null })
  const stateHook = hooks.react.useState
  let initialized = false
  hooks.react.useState = initial => {
    if (!initialized) { initialized = true; return stateHook(ready()) }
    return stateHook(initial)
  }
  const Component = load(path.join(root, 'app/content-studio-prototype/enrollment/StaffEnrollment.tsx'), { react: hooks.react }).default
  let tree = hooks.render(Component, {})
  elements(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  tree = hooks.render(Component, {})
  for (let count = 0; count < 2; count++) {
    elements(tree).find(node => node.props?.children?.some?.(child => child === 'Add another lesson')).props.onClick()
    tree = hooks.render(Component, {})
  }
  elements(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  tree = hooks.render(Component, {})
  const calendar = elements(tree).find(node => node.props?.onSelectLesson && node.props?.lessons)
  assert.equal(calendar.props.lessons.length, 3)
  assert.equal(calendar.props.lesson.id, calendar.props.lessons[0].id)
  calendar.props.onSelectLesson(calendar.props.lessons[2].id)
  tree = hooks.render(Component, {})
  assert.equal(elements(tree).find(node => node.props?.onSelectLesson && node.props?.lessons).props.lesson.id, calendar.props.lessons[2].id)
})
