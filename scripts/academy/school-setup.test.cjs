/* eslint-disable @typescript-eslint/no-require-imports -- Pure preview setup validation. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const domain = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').resolve(__dirname, '../../app/content-studio-prototype/school-setup/setup-content.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, { exports: domain })
const area = id => domain.setupAreas.find(item => item.id === id)
test('unnamed time off and sick leave block availability without changing the weekly schedule', () => {
 const base = [{ id: 'mon', day: 0, from: 720, to: 1080 }]
 const off = { id: 'sick', start: '2026-11-09', end: '2026-11-09', allDay: true, from: 720, to: 780, sickLeave: true }
 assert.equal(domain.validateTeacherExceptions({ timeOff: JSON.stringify([off]) }), null)
 assert.equal(domain.validateTeacherExceptions({ timeOff: JSON.stringify([{ ...off, sickLeave: false }]) }), null)
 assert.equal(domain.validateTeacherExceptions({ timeOff: JSON.stringify([{ ...off, sickLeave: undefined }]) }), null)
 assert.ok(domain.validateTeacherExceptions({ timeOff: JSON.stringify([{ ...off, sickLeave: 'yes' }]) }))
 assert.equal(domain.teacherAvailabilityForDate(base, [], [off], '2026-11-09').length, 0)
 const partial = domain.teacherAvailabilityForDate(base, [], [{ ...off, allDay: false, from: 900, to: 930 }], '2026-11-09')
 assert.equal(partial.length, 2)
 assert.equal(partial[0].to, 900)
 assert.equal(partial[1].from, 930)
 assert.equal(domain.teacherAvailabilityForDate(base, [], [off], '2026-11-16')[0].from, 720)
})
test('weekly schedules carry forward and later edits preserve earlier weeks', () => {
 const base = [{ id: 'mon', day: 0, from: 720, to: 1080 }]
 const first = [{ ...base[0], from: 780 }]
 const weeks = [{ week: '2026-11-09', blocks: first }, { week: '2026-11-23', blocks: [] }]
 assert.equal(domain.teacherWeekAvailability(base, weeks, '2026-11-02')[0].from, 720)
 assert.equal(domain.teacherWeekAvailability(base, weeks, '2026-11-16')[0].from, 780)
 assert.equal(domain.teacherWeekAvailability(base, weeks, '2026-11-23').length, 0)
 assert.equal(domain.teacherWeekAvailability(base, weeks, '2026-11-30').length, 0)
 assert.equal(domain.validateTeacherExceptions({ availabilityWeeks: JSON.stringify(weeks) }), null)
 assert.ok(domain.validateTeacherExceptions({ availabilityWeeks: JSON.stringify([{ week: '2026-11-10', blocks: first }]) }))
 assert.ok(domain.validateTeacherExceptions({ availabilityWeeks: JSON.stringify([{ week: '2026-11-09', blocks: [...first, ...base] }]) }))
})
test('recurring teacher availability, date overrides and time off remain independent', () => {
 const base = [{ id: 'mon', day: 0, from: 720, to: 1260 }]
 assert.equal(domain.teacherAvailabilityForDate(base, [], [], '2026-11-09')[0].from, 720)
 assert.equal(domain.teacherAvailabilityForDate(base, [], [], '2026-11-16')[0].from, 720)
 const overrides = [{ date: '2026-11-09', blocks: [{ id: 'one', day: 0, from: 600, to: 660 }] }]
 assert.equal(domain.teacherAvailabilityForDate(base, overrides, [], '2026-11-09')[0].from, 600)
 assert.equal(domain.teacherAvailabilityForDate(base, overrides, [], '2026-11-16')[0].from, 720)
 assert.equal(domain.teacherAvailabilityForDate(base, [{ date: '2026-11-09', blocks: [] }], [], '2026-11-09').length, 0)
 const vacation = [{ id: 'vac', name: 'Vacation', start: '2026-11-09', end: '2026-11-16', allDay: true, from: 720, to: 780 }]
 assert.equal(domain.teacherAvailabilityForDate(base, overrides, vacation, '2026-11-09').length, 0)
 assert.equal(domain.teacherAvailabilityForDate(base, [], vacation, '2026-11-16').length, 0)
 assert.equal(domain.teacherAvailabilityForDate(base, [], vacation, '2026-11-23').length, 1)
 const partial = [{ ...vacation[0], end: '2026-11-09', allDay: false, from: 900, to: 930 }]
 const split = domain.teacherAvailabilityForDate(base, [], partial, '2026-11-09')
 assert.equal(split.length, 2); assert.equal(split[0].to, 900); assert.equal(split[1].from, 930)
 assert.equal(base[0].to, 1260)
})
test('dated schedule and separate rest/meal preferences validate', () => {
 assert.equal(domain.validateTeacherExceptions({ restBreakMinutes: '10', mealBreakMinutes: '30' }), null)
 assert.equal(domain.validateTeacherExceptions({ restBreakMinutes: '30', mealBreakMinutes: '60' }), null)
 assert.ok(domain.validateTeacherExceptions({ mealBreakMinutes: '10' }))
 assert.ok(domain.validateTeacherExceptions({ restBreakMinutes: '0' }))
 assert.ok(domain.validateTeacherExceptions({ timeOff: '[{"id":"v","name":"Vacation","start":"2026-11-31","end":"2026-12-02","allDay":true}]' }))
 assert.ok(domain.validateTeacherExceptions({ timeOff: '[{"id":"v","name":"Vacation","start":"2026-11-10","end":"2026-11-09","allDay":true}]' }))
 assert.ok(domain.validateTeacherExceptions({ availabilityOverrides: '[{"date":"2026-11-09","blocks":[{"from":720,"to":780},{"from":750,"to":800}]}]' }))
 assert.equal(domain.validateTeacherExceptions({ availabilityOverrides: '[{"date":"2026-11-09","blocks":[]}]' }), null)
})
test('duration prices are explicit, validated and included without first-period naming', () => {
 const values = domain.normalizePricing({ ...area('plans').defaults, durationPrices: JSON.stringify([{ minutes: 30, price: '40' }, { minutes: 45, price: '55' }, { minutes: 60, price: '75' }]) })
 assert.match(values.name, /30 min · \$40.00/)
 assert.match(values.name, /60 min · \$75.00/)
 assert.doesNotMatch(values.name, /Remaining scheduled/)
 assert.equal(domain.validateSetup(area('plans'), values), null)
 assert.ok(domain.validateSetup(area('plans'), { ...values, durationPrices: '[{"minutes":60,"price":""}]' }))
 assert.ok(domain.validateSetup(area('plans'), { ...values, durationPrices: '[{"minutes":30,"price":"40"},{"minutes":30,"price":"75"}]' }))
})
test('teacher assignment levels, overlapping availability and closures validate', () => {
 const teacher = { ...area('teachers').records[0].values, assignments: '[{"serviceId":"piano","maxLevel":3}]', availability: '[{"day":0,"from":720,"to":780}]' }
 assert.equal(domain.validateSetup(area('teachers'), teacher), null)
 assert.ok(domain.validateSetup(area('teachers'), { ...teacher, availability: '[{"day":0,"from":720,"to":780},{"day":0,"from":750,"to":800}]' }))
 assert.equal(domain.validateSetup(area('teachers'), { ...teacher, locationIds: '["studio","second-studio"]' }), null)
 assert.ok(domain.validateSetup(area('teachers'), { ...teacher, locationIds: '[]' }))
 const policy = { ...area('policies').defaults, closures: '[{"name":"Break","start":"2027-01-01","end":"2027-01-02","location":"all"}]' }
 assert.equal(domain.validateSetup(area('policies'), policy), null)
 assert.ok(domain.validateSetup(area('policies'), { ...policy, closures: '[{"name":"Break","start":"2027-01-03","end":"2027-01-02"}]' }))
})
test('discount conditions explain thresholds in plain language', () => {
 const family = domain.newDiscountCondition('family')
 assert.equal(domain.discountValueLabels.familyStudents, 'Number of students in the same family')
 assert.equal(domain.discountConditionLabel(family), 'Has another actively enrolled student in the same family.')
 assert.ok(domain.validateDiscountCondition({ ...family, value: '3' }))
 assert.ok(domain.validateDiscountCondition({ ...family, comparison: 'eq' }))
 assert.equal(domain.discountConditionLabel({ ...family, field: 'frequency', comparison: 'neq', value: 'Weekly' }), 'Applies when lessons are not weekly.')
 for (const field of domain.discountFields) {
  assert.ok(domain.discountValueLabels[field.key])
  assert.ok(domain.discountConditionLabel(domain.newDiscountCondition(field.key, field.key)).length > 0)
 }
})
test('structured discount rules evaluate comparisons, all/any and missing data', () => {
 const rule = { id: 'loyalty', name: 'Family loyalty', amount: '15', unit: '%', match: 'all', conditions: [domain.newDiscountCondition('family'), { ...domain.newDiscountCondition('tenure', 'membershipMonths'), comparison: 'gt' }] }
 assert.equal(domain.validateDiscount(rule), null)
 assert.equal(domain.validateDiscount({ ...rule, startsOn: '2026-11-01', endsOn: '2026-12-31' }), null)
 assert.ok(domain.validateDiscount({ ...rule, startsOn: '2026-12-31', endsOn: '2026-11-01' }))
 assert.ok(domain.validateDiscount({ ...rule, endsOn: '2026-02-30' }))
 assert.equal(domain.validateDiscount({ ...rule, unit: '$', amount: '125.50' }), null)
 for (const changes of [{ name: ' ' }, { amount: '0' }, { amount: '-1' }, { amount: '101' }, { amount: '1.999' }, { conditions: [] }]) assert.ok(domain.validateDiscount({ ...rule, ...changes }))
 assert.equal(domain.evaluateDiscount(rule, { familyStudents: '2', membershipMonths: '13' }), 'eligible')
 assert.equal(domain.evaluateDiscount(rule, { familyStudents: '2', membershipMonths: '12' }), 'not-eligible')
 assert.equal(domain.evaluateDiscount(rule, { familyStudents: '2' }), 'missing-data')
 assert.equal(domain.evaluateDiscount(rule, { familyStudents: '1' }), 'not-eligible')
 assert.equal(domain.evaluateDiscount(rule, { familyStudents: '5', membershipMonths: '13' }), 'eligible')
 assert.equal(domain.evaluateDiscount(rule, { familyStudents: '-1', membershipMonths: '13' }), 'missing-data')
 assert.equal(domain.evaluateDiscount({ ...rule, match: 'any' }, { familyStudents: '2' }), 'eligible')
 assert.equal(domain.evaluateDiscount({ ...rule, match: 'any' }, { familyStudents: '1' }), 'missing-data')
 assert.equal(domain.evaluateDiscount(rule, { familyStudents: 'NaN', membershipMonths: '13' }), 'missing-data')
 const choice = { ...rule, conditions: [domain.newDiscountCondition('frequency', 'frequency')] }
 assert.equal(domain.evaluateDiscount(choice, { frequency: 'Weekly' }), 'eligible')
 assert.equal(domain.evaluateDiscount(choice, { frequency: 'One-off' }), 'not-eligible')
 assert.ok(domain.validateDiscount({ ...choice, conditions: [{ ...choice.conditions[0], comparison: 'gte' }] }))
 for (const [comparison, actual, expected] of [['eq', '2', 'eligible'], ['neq', '2', 'not-eligible'], ['lt', '1', 'eligible'], ['lte', '2', 'eligible'], ['gt', '3', 'eligible'], ['gte', '2', 'eligible']]) {
  assert.equal(domain.evaluateDiscount({ ...rule, conditions: [{ ...domain.newDiscountCondition('count', 'activeEnrollments'), value: '2', comparison }] }, { activeEnrollments: actual }), expected)
 }
 assert.equal(domain.createDiscounts('new').length, 0)
 const first = domain.createDiscounts('configured'), second = domain.createDiscounts('configured')
 first[0].conditions[0].value = '3'
 assert.equal(second[0].conditions[0].value, '2')
 assert.ok(domain.discountFields.length > 3)
})
test('pricing fields progressively disclose valid billing options and generate names', () => {
 assert.ok(domain.setupAreas.indexOf(area('plans')) < domain.setupAreas.indexOf(area('services')))
 assert.equal(area('plans').fields.some(field => ['name', 'discount'].includes(field.key)), false)
 const subscription = domain.normalizePricing(area('plans').defaults)
 assert.equal(subscription.name, 'Monthly subscription · $50.00 per lesson')
 assert.equal(domain.pricingFields(subscription).find(field => field.key === 'cadence').options.includes('Once'), false)
 const fixed = domain.normalizePricing({ ...subscription, basis: 'Fixed amount' })
 assert.equal(fixed.first, 'Full amount')
 assert.equal(domain.pricingFields(fixed).find(field => field.key === 'first').options.includes('Remaining scheduled lessons'), false)
 for (const kind of ['Single lesson', 'Lesson pack', 'Prepaid term']) {
  const values = domain.normalizePricing({ ...fixed, kind, discount: '20', service: 'piano' })
  const fields = domain.pricingFields(values).map(field => field.key)
  assert.equal(fields.includes('first'), false)
  assert.equal(fields.includes('cadence'), false)
  assert.equal(fields.includes('basis'), false)
  assert.equal(fields.includes('visits'), kind !== 'Single lesson')
  assert.equal(values.cadence, 'Once')
  assert.equal(values.basis, 'Fixed amount')
  assert.equal(values.first, undefined)
  assert.equal(values.discount, undefined)
  assert.equal(domain.validateSetup(area('plans'), values), null)
  const recurring = domain.normalizePricing({ ...values, kind: 'Subscription' })
  assert.equal(recurring.cadence, 'Monthly')
  assert.equal(recurring.first, 'Full amount')
 }

})
test('pricing models are service agnostic and service selections remain independent', () => {
 const plans = area('plans')
 assert.equal(plans.fields.some(field => field.key === 'service'), false)
 assert.equal('service' in plans.defaults, false)
 for (const plan of plans.records) {
  assert.equal('service' in plan.values, false)
  assert.equal(domain.validateSetup(plans, plan.values), null)
 }
 const data = domain.createSetupData('new')
 assert.equal(data.services.length, 0)
 const values = domain.normalizePricing(plans.defaults)
 assert.equal(domain.validateSetup(plans, values), null)
 data.plans.push({ id: 'shared', values })
 const first = { ...domain.serviceDefaults(), name: 'Piano', planIds: '["shared"]' }
 const second = { ...domain.serviceDefaults(), name: 'Guitar', planIds: '["shared"]' }
 assert.equal(domain.validateSetup(area('services'), first), null)
 assert.equal(domain.validateSetup(area('services'), second), null)
 first.planIds = '[]'
 assert.equal(second.planIds, '["shared"]')
 assert.equal(domain.serviceDefaults({ values: second }).planIds, '[]')
 assert.equal(data.plans[0].values.name, domain.pricingName(values))
})
test('service image suggestions match names and new services never inherit images', () => {
 const images = {}
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').resolve(__dirname, '../../app/content-studio-prototype/school-setup/service-images.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, { exports: images })
 assert.equal(images.suggestedServiceImages('Piano lessons').length, 2)
 assert.equal(images.suggestedServiceImages('DRUMS').length, 1)
 assert.equal(images.suggestedServiceImages('Guitar beginners').length, 2)
 assert.equal(images.suggestedServiceImages('Photography').length, 0)
 assert.equal(domain.serviceDefaults({ values: { image: '/old.jpg', durations: '45' } }).image, '')
 for (const image of images.serviceImages) {
  assert.ok(fs.existsSync(require('node:path').resolve(__dirname, '../../public', image.src.slice(1))))
  assert.match(image.source, /^https:\/\/www.pexels.com\/photo\/\d+\/$/)
 }
})
test('new accounts have no seeded records and remain separate from configured schools', () => {
 const empty = domain.createSetupData('new'), configured = domain.createSetupData('configured')
 for (const records of Object.values(empty)) assert.equal(records.length, 0)
 empty.school.push({ id: 'new-school', values: { name: 'My school' } })
 assert.equal(configured.school[0].values.name, 'Headliner Music')
 assert.equal(domain.createSetupData('new').school.length, 0)
})
test('all seeded owner records validate and independent state is cloned', () => {
 for (const item of domain.setupAreas) for (const record of item.records) assert.equal(domain.validateSetup(item, record.values), null, item.id)
 const first = domain.createSetupData(), second = domain.createSetupData()
 first.school[0].values.name = 'Changed'
 assert.equal(second.school[0].values.name, 'Headliner Music')
})
test('prices, discounts and required names are checked', () => {
 const item = area('plans'), values = { ...item.records[0].values }
 for (const changes of [{ price: '-1' }, { price: 'NaN' }, { price: '1.999' }]) assert.ok(domain.validateSetup(item, { ...values, ...changes }))
 assert.equal(domain.validateSetup(item, domain.normalizePricing({ ...values, price: '12.50', basis: 'Fixed amount' })), null)
})
test('rooms validate names, positive capacity and service references', () => {
 const room = { id: 'one', name: 'Room 101', capacity: '4', serviceIds: ['piano'] }
 assert.equal(domain.validateRooms([room], ['piano']), null)
 assert.equal(domain.validateRooms([], []), null)
 for (const changes of [{ name: ' ' }, { capacity: '0' }, { capacity: '1.5' }, { serviceIds: ['missing'] }]) assert.ok(domain.validateRooms([{ ...room, ...changes }], ['piano']))
 const first = domain.createSetupData(), second = domain.createSetupData()
 first.locations[0].rooms[0].serviceIds.push('new')
 assert.equal(second.locations[0].rooms[0].serviceIds.includes('new'), false)
})
test('packs require a lesson count and one-time billing', () => {
 const item = area('plans'), values = { ...item.records[0].values, kind: 'Lesson pack' }
 assert.ok(domain.validateSetup(item, values))
 assert.ok(domain.validateSetup(item, { ...values, cadence: 'Once', visits: '0' }))
 assert.equal(domain.validateSetup(item, domain.normalizePricing({ ...values, cadence: 'Once', visits: '10' })), null)
})
test('lesson lengths validate without service-level capacity settings', () => {
 const item = area('services'), values = item.records[0].values
 for (const changes of [{ durations: '30, bad' }, { durations: '0' }]) assert.ok(domain.validateSetup(item, { ...values, ...changes }))
 assert.equal(domain.validateSetup(item, { ...values, formats: '["private","group"]' }), null)
 assert.equal(Object.keys(domain.serviceDefaults()).some(key => key.startsWith('capacity_')), false)
})
test('teacher hours and days and closure ranges are validated', () => {
 const item = area('teachers'), values = item.records[0].values
 assert.ok(domain.validateSetup(item, { ...values, to: '13:00' }))
 assert.ok(domain.validateSetup(item, { ...values, days: 'Moonday' }))
 const policy = area('policies')
 assert.ok(domain.validateSetup(policy, { ...policy.records[0].values, end: '2026-01-01' }))
})
test('service prefill copies last saved settings without name or shared mutation', () => {
 const source = { id: 'piano', values: { ...domain.serviceDefaults(), name: 'Piano', formats: '["private","group"]' } }
 const guitar = domain.serviceDefaults(source)
 assert.equal(guitar.name, '')
 assert.equal(guitar.formats, '["private","group"]')
 guitar.formats = '["private"]'
 assert.equal(source.values.formats, '["private","group"]')
 assert.equal(domain.validateSetup(area('services'), { ...guitar, name: 'Guitar' }), null)
 for (const change of [{ formats: '[]' }, { scheduling: '[]' }, { levelIds: '["unknown"]' }]) assert.ok(domain.validateSetup(area('services'), { ...guitar, name: 'Guitar', ...change }))
})
test('all-services rooms remain valid before the catalogue exists', () => {
 assert.equal(domain.validateRooms([{ id: 'room', name: '101', capacity: '4', allServices: true, serviceIds: [] }], []), null)
})

test('curriculum assignment drafts clone independently and material prices validate', () => {
 const source = { level1: ['book'] }, draft = domain.cloneCurriculum(source)
 draft.level1.push('second')
 assert.equal(source.level1.length, 1)
 assert.equal(domain.validateMaterial({ name: 'Book', cost: '15.00' }), null)
 for (const values of [{ name: '', cost: '15' }, { name: 'Book', cost: '-1' }, { name: 'Book', cost: '1.999' }]) assert.ok(domain.validateMaterial(values))
 assert.equal(domain.levelIds.length, 5)
 assert.equal(domain.createMaterials('new').length, 0)
 const first = domain.createSetupData(), second = domain.createSetupData()
 first.services[0].curriculum.level1 = ['other']
 assert.equal(second.services[0].curriculum.level1[0], 'hl-296001')
})

test('scheduling choices explain ongoing slots versus fixed-date courses without changing stored values', () => {
 assert.deepEqual(Array.from(domain.schedulingChoices, option => option.label), ['Ongoing weekly lessons', 'Fixed-date courses', 'One-off lessons'])
 assert.match(domain.schedulingChoices[0].description, /until stopped/)
 assert.match(domain.schedulingChoices[1].description, /defined start and end/)
 assert.equal(domain.validateSetup(area('services'), { ...domain.serviceDefaults(), name: 'Course', scheduling: '["Scheduled class series"]' }), null)
})

test('level materials render as compact icon/name/price lines without table headers or capacity fields', () => {
 const path = require('node:path'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
 const root = path.resolve(__dirname, '../..'), cache = new Map()
 const load = file => {
  if (cache.has(file)) return cache.get(file).exports
  if (file.endsWith('.css')) return new Proxy({}, { get: (_, key) => String(key) })
  const loadedModule = { exports: {} }
  cache.set(file, loadedModule)
  const localRequire = id => {
   if (!id.startsWith('@/') && !id.startsWith('.')) return require(id)
   const target = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(file), id)
   const resolved = [target, `${target}.tsx`, `${target}.ts`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
   assert.ok(resolved, `Resolve ${id}`)
   return load(resolved)
  }
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  vm.runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, { console })(localRequire, loadedModule, loadedModule.exports)
  return loadedModule.exports
 }
 const Editor = load(path.join(root, 'app/content-studio-prototype/school-setup/ServiceEditor.tsx')).default
 const html = renderToStaticMarkup(React.createElement(Editor, {
  values: { ...domain.serviceDefaults(), name: 'Piano' }, levelNames: domain.defaultLevelNames,
  curriculum: { level1: ['pdf', 'book'] },
  materials: [{ id: 'pdf', name: 'Piano Adventures', cost: '15.00', fileName: 'piano.pdf', fileUrl: 'https://example.test/piano.pdf' }, { id: 'book', name: 'Practice book', cost: '9.50' }],
  onValue() {}, onCurriculum() {},
 }))
 assert.match(html, /Piano Adventures, /)
 assert.match(html, /\$15\.00/)
 assert.match(html, /Practice book, /)
 assert.match(html, /\$9\.50/)
 assert.match(html, /href="https:\/\/example.test\/piano.pdf"/)
 assert.match(html, /lucide-file-text/)
 assert.match(html, /lucide-book-open/)
 assert.doesNotMatch(html, /columnheader|role="table"|Student limit|type="number"|New material|<h2[^>]*>Curriculum/)
})

test('configured preview has one material per level while new accounts stay empty', () => {
 const materials = domain.createMaterials('configured'), piano = domain.createSetupData('configured').services[0]
 assert.equal(materials.length, 9)
 for (const id of domain.levelIds.slice(0, 3)) {
  assert.equal(piano.curriculum[id].length, 1)
  assert.ok(materials.some(material => material.id === piano.curriculum[id][0]))
 }
 for (const material of materials) {
  assert.match(material.sourceUrl, /^https:\/\/www.halleonard.com\//)
  assert.equal(material.publisher, 'Hal Leonard Student Piano Library')
  assert.equal(material.fileUrl, undefined, 'Catalogue records must not pretend to include licensed PDFs')
  assert.equal(domain.validateMaterial(material), null)
 }
 assert.equal(domain.createMaterials('new').length, 0)
 assert.equal(Object.keys(domain.cloneCurriculum()).length, 0)
})
