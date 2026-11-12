/** Fictional records, not live configuration. */
export type TeacherAvailability = { id: string; day: number; from: number; to: number }
export type TeacherDateOverride = { date: string; blocks: TeacherAvailability[] }
export type TeacherWeekSchedule = { week: string; blocks: TeacherAvailability[] }
export function teacherWeekAvailability(base: TeacherAvailability[], weeks: TeacherWeekSchedule[], date: string) {
  return [...weeks].filter(item => item.week <= date).sort((a, b) => b.week.localeCompare(a.week))[0]?.blocks ?? base
}
export type TeacherTimeOff = { id: string; name?: string; sickLeave?: boolean; start: string; end: string; allDay: boolean; from: number; to: number }
export function teacherDayIndex(date: string) { return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7 }
export function teacherAvailabilityForDate(base: TeacherAvailability[], overrides: TeacherDateOverride[], timeOff: TeacherTimeOff[], date: string) {
  let blocks = (overrides.find(item => item.date === date)?.blocks ?? base.filter(item => item.day === teacherDayIndex(date))).map(block => ({ ...block }))
  for (const off of timeOff.filter(item => item.start <= date && item.end >= date)) {
    const from = off.allDay ? 360 : off.from, to = off.allDay ? 1320 : off.to
    blocks = blocks.flatMap(block => {
      if (block.to <= from || block.from >= to) return [block]
      return [...(block.from < from ? [{ ...block, to: from }] : []), ...(block.to > to ? [{ ...block, id: `${block.id}:after:${off.id}`, from: to }] : [])]
    })
  }
  return blocks
}
export function validateTeacherExceptions(values: Record<string, string>): string | null {
  const validDate = (value: string) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  const validTimes = (block: TeacherAvailability) => block && Number.isInteger(block.from) && Number.isInteger(block.to) && block.from >= 360 && block.to <= 1320 && block.from < block.to
  try {
    const weeks: TeacherWeekSchedule[] = JSON.parse(values.availabilityWeeks || '[]')
    if (!Array.isArray(weeks) || weeks.some(item => !item || !validDate(item.week) || teacherDayIndex(item.week) !== 0 || !Array.isArray(item.blocks) || item.blocks.some(block => !validTimes(block) || !Number.isInteger(block.day) || block.day < 0 || block.day > 6) || item.blocks.some((block, i) => item.blocks.some((other, j) => i !== j && block.day === other.day && block.from < other.to && other.from < block.to))) || new Set(weeks.map(item => item.week)).size !== weeks.length) return 'Check weekly availability and overlapping times.'
    const overrides: TeacherDateOverride[] = JSON.parse(values.availabilityOverrides || '[]')
    if (!Array.isArray(overrides) || overrides.some(item => !item || !validDate(item.date) || !Array.isArray(item.blocks) || item.blocks.some(block => !validTimes(block)) || item.blocks.some((block, index) => item.blocks.some((other, j) => index !== j && block.from < other.to && other.from < block.to))) || new Set(overrides.map(item => item.date)).size !== overrides.length) return 'Check date-specific availability and overlapping times.'
    const timeOff: TeacherTimeOff[] = JSON.parse(values.timeOff || '[]')
    if (!Array.isArray(timeOff) || timeOff.some(item => !item || !item.id || (item.sickLeave !== undefined && typeof item.sickLeave !== 'boolean') || !validDate(item.start) || !validDate(item.end) || item.end < item.start || typeof item.allDay !== 'boolean' || (!item.allDay && !validTimes(item as unknown as TeacherAvailability)))) return 'Check time-off dates, hours and sick-leave selection.'
  } catch { return 'Check date-specific availability and time off.' }
  if (values.restBreakMinutes && !['10', '30'].includes(values.restBreakMinutes)) return 'Choose a 10- or 30-minute rest break.'
  if (values.mealBreakMinutes && !['30', '45', '60'].includes(values.mealBreakMinutes)) return 'Choose a meal break of at least 30 minutes.'
  return null
}
export type SetupRoom = { conferenceUrl?: string; id: string; name: string; capacity: string; serviceIds: string[]; allServices?: boolean }
export type SetupMaterial = { id: string; name: string; cost: string; fileName?: string; fileUrl?: string; sourceUrl?: string; publisher?: string }
export type SetupCurriculum = Record<string, string[]>
export type SetupRecord = { id: string; values: Record<string, string>; rooms?: SetupRoom[]; curriculum?: SetupCurriculum }
export type SetupField = { key: string; label: string; options?: string[]; type?: 'email' | 'number' | 'time' | 'date'; optional?: boolean }
export type SetupArea = { id: string; title: string; singular: string; fields: SetupField[]; defaults: Record<string, string>; records: SetupRecord[]; singleton?: boolean }
const f = (key: string, label: string, options?: string[]): SetupField => ({ key, label, options })
export const setupAreas: SetupArea[] = [
  { id: 'school', title: 'School details', singular: 'school details', singleton: true, fields: [f('name', 'School name'), { key: 'email', label: 'Contact email', type: 'email' }, f('phone', 'Phone'), f('timezone', 'Timezone', ['America/Los_Angeles', 'America/New_York', 'Europe/London']), { key: 'ein', label: 'EIN / tax number', optional: true }, { key: 'salesTaxId', label: 'Sales tax ID', optional: true }], defaults: { name: '', email: '', phone: '', timezone: 'America/Los_Angeles', ein: '', salesTaxId: '', logo: '' }, records: [{ id: 'school', values: { name: 'Headliner Music', email: 'hello@example.test', phone: '202-555-0100', timezone: 'America/Los_Angeles', level1: 'Level 1', level2: 'Level 2', level3: 'Level 3' } }] },
  { id: 'locations', title: 'Locations & rooms', singular: 'location', fields: [f('name', 'Location name'), f('address', 'Street address'), { key: 'city', label: 'City', optional: true }, { key: 'state', label: 'State / region', optional: true }, { key: 'postal', label: 'Postal code', optional: true }, { key: 'phone', label: 'Location phone', optional: true }, { key: 'email', label: 'Location email', type: 'email', optional: true }], defaults: { name: '', address: '', city: '', state: '', postal: '' }, records: [{ id: 'studio', values: { name: 'Headliner Rocklin', address: 'Sample studio address', city: 'Rocklin', state: 'CA', postal: '' }, rooms: [{ id: 'piano-room', name: 'Piano room', capacity: '1', serviceIds: ['piano'] }, { id: 'ensemble-room', name: 'Ensemble room', capacity: '8', serviceIds: ['piano', 'tiny'] }] }] },
  { id: 'plans', title: 'Plans & prices', singular: 'plan', fields: [f('kind', 'Purchase option', ['Subscription', 'Single lesson', 'Lesson pack', 'Prepaid term']), f('basis', 'Price calculation', ['Per scheduled lesson', 'Fixed amount']), { key: 'price', label: 'Price (USD)', type: 'number' }, f('cadence', 'Bill', ['Monthly', 'Weekly', 'Every two weeks']), f('first', 'First billing period', ['Remaining scheduled lessons', 'Full amount', 'Prorate by calendar days', 'Prorate by scheduled lessons']), { key: 'visits', label: 'Included lessons', type: 'number' }, { key: 'fee', label: 'Sign-up fee (USD)', type: 'number' }, { key: 'deposit', label: 'Deposit (USD)', type: 'number' }], defaults: { kind: 'Subscription', basis: 'Per scheduled lesson', price: '50', cadence: 'Monthly', first: 'Remaining scheduled lessons', visits: '10', fee: '0', deposit: '0' }, records: [{ id: 'monthly', values: { name: 'Monthly per lesson', kind: 'Subscription', basis: 'Per scheduled lesson', price: '50', cadence: 'Monthly', first: 'Remaining scheduled lessons', visits: '10', fee: '0', deposit: '0' } }, { id: 'flat', values: { name: 'Monthly fixed amount', kind: 'Subscription', basis: 'Fixed amount', price: '160', cadence: 'Monthly', first: 'Full amount', visits: '10', fee: '0', deposit: '0' } }] },
  { id: 'services', title: 'Services & programs', singular: 'service', fields: [f('name', 'Service name'), f('durations', 'Lesson lengths (minutes, comma-separated)'),], defaults: { name: '', durations: '30, 45, 60' }, records: [{ id: 'piano', values: { name: 'Piano', durations: '30, 45, 60', formats: '["private"]', levelIds: '["level1","level2","level3"]', scheduling: '["Recurring appointments"]' } }, { id: 'tiny', values: { name: 'Tiny Keys', durations: '45', formats: '["group"]', levelIds: '["level1","level2","level3"]', scheduling: '["Scheduled class series"]' } }] },
  { id: 'teachers', title: 'Teachers', singular: 'teacher', fields: [f('name', 'Teacher name'), f('service', 'Service'),  f('location', 'Location'), f('days', 'Working days (comma-separated)'), { key: 'from', label: 'Start time', type: 'time' }, { key: 'to', label: 'End time', type: 'time' }], defaults: { name: '', service: 'piano', levels: 'Beginner, Intermediate', location: 'studio', days: 'Monday, Tuesday', from: '14:00', to: '18:00' }, records: [{ id: 'jordan', values: { name: 'Jordan Vale', service: 'piano', levels: 'Beginner, Intermediate, Advanced', location: 'studio', days: 'Monday, Tuesday, Wednesday, Thursday', from: '14:00', to: '18:00' } }] },
  { id: 'policies', title: 'Policies', singular: 'school policies', singleton: true, fields: [f('name', 'Policy name'), { key: 'notice', label: 'Cancellation notice (hours)', type: 'number' }, f('timely', 'With sufficient notice', ['Issue a makeup', 'No makeup']), f('late', 'Late cancellations', ['No makeup', 'Issue a makeup']), { key: 'expiry', label: 'Makeup expiry (months; 0 means no expiry)', type: 'number' }, { key: 'closure', label: 'Closure name', optional: true }, { key: 'start', label: 'Closed from', type: 'date', optional: true }, { key: 'end', label: 'Closed through', type: 'date', optional: true }], defaults: { name: 'School defaults', notice: '24', timely: 'Issue a makeup', late: 'No makeup', expiry: '6', closure: '', start: '', end: '' }, records: [{ id: 'policy', values: { name: 'School defaults', notice: '24', timely: 'Issue a makeup', late: 'No makeup', expiry: '6', closure: 'Winter break', start: '2026-12-24', end: '2027-01-01' } }] },
]
export type SetupExperience = 'new' | 'configured'
export const levelIds = ['level1', 'level2', 'level3', 'level4', 'level5']
export const defaultLevelNames: Record<string, string> = { level1: 'Level 1', level2: 'Level 2', level3: 'Level 3', level4: 'Level 4', level5: 'Level 5' }
/** Catalogue metadata checked against Hal Leonard on November 9, 2026.
 * Preview records only: retail USD prices, no licensed files or live catalogue sync.
 */
export function createMaterials(experience: SetupExperience): SetupMaterial[] {
  if (experience === 'new') return []
  const publisher = 'Hal Leonard Student Piano Library'
  return [
    { id: 'hl-296001', name: 'Piano Lessons – Book 1', cost: '8.99', publisher, sourceUrl: 'https://www.halleonard.com/product/296001/piano-lessons-book-1' },
    { id: 'hl-296006', name: 'Piano Lessons Book 2', cost: '8.99', publisher, sourceUrl: 'https://www.halleonard.com/product/296006/piano-lessons-book-2' },
    { id: 'hl-296011', name: 'Piano Lessons Book 3 – Revised Edition', cost: '9.99', publisher, sourceUrl: 'https://www.halleonard.com/feature/12130005/level-3' },
    { id: 'hl-296002', name: 'Piano Practice Games Book 1 (with Online Audio)', cost: '10.99', publisher, sourceUrl: 'https://www.halleonard.com/product/296002/piano-practice-games-book-1-with-online-audio' },
    { id: 'hl-296007', name: 'Piano Practice Games Book 2', cost: '10.99', publisher, sourceUrl: 'https://www.halleonard.com/feature/12130004/level-2' },
    { id: 'hl-296106', name: 'Piano Technique Book 2', cost: '8.99', publisher, sourceUrl: 'https://www.halleonard.com/feature/12130004/level-2' },
    { id: 'hl-296008', name: 'Piano Solos Book 2', cost: '8.99', publisher, sourceUrl: 'https://www.halleonard.com/feature/12130004/level-2' },
    { id: 'hl-296024', name: 'Piano Theory Workbook – Book 2', cost: '8.99', publisher, sourceUrl: 'https://www.halleonard.com/feature/12130004/level-2' },
    { id: 'hl-296025', name: 'Piano Theory Workbook – Book 3 – Revised Edition', cost: '8.99', publisher, sourceUrl: 'https://www.halleonard.com/feature/12130005/level-3' },
  ]
}
export function cloneCurriculum(curriculum: SetupCurriculum = {}): SetupCurriculum {
  return Object.fromEntries(Object.entries(curriculum).map(([id, materials]) => [id, [...materials]]))
}
export function validateMaterial(material: Pick<SetupMaterial, 'name' | 'cost'>): string | null {
  if (!material.name.trim()) return 'Enter a material name.'
  if (!/^\d+(\.\d{1,2})?$/.test(material.cost)) return 'Enter a non-negative cost with up to two decimal places.'
  return null
}
export const lessonFormats = [{ id: 'private', label: 'Private' }, { id: 'semi', label: 'Semi-private' }, { id: 'group', label: 'Group' }]
export const schedulingChoices = [
  { value: 'Recurring appointments', label: 'Ongoing weekly lessons', description: 'A repeating time slot for each student, continuing until stopped.' },
  { value: 'Scheduled class series', label: 'Fixed-date courses', description: 'Students enroll in a set of class dates with a defined start and end.' },
  { value: 'Single appointments', label: 'One-off lessons', description: 'A single lesson booked independently, with no repeating schedule.' },
]
export const schedulingOptions = schedulingChoices.map(option => option.value)
export function selection(value?: string): string[] { return value ? JSON.parse(value) : [] }
export function serviceDefaults(source?: SetupRecord): Record<string, string> {
  return { durations: '30, 45, 60', formats: '["private"]', levelIds: JSON.stringify(levelIds.slice(0, 3)), scheduling: '["Recurring appointments"]', ...source?.values, name: '', image: '', planIds: '[]' }
}
export function createSetupData(experience: SetupExperience = 'configured'): Record<string, SetupRecord[]> {
  return Object.fromEntries(setupAreas.map(area => [area.id, experience === 'new' ? [] : area.records.map((record): SetupRecord => ({
    id: record.id,
    values: area.id === 'school' ? { ...defaultLevelNames, ...record.values } : area.id === 'services' ? { ...serviceDefaults(), ...record.values, planIds: JSON.stringify(record.id === 'piano' ? ['monthly'] : ['flat']) } : area.id === 'teachers' ? { ...record.values, levelIds: JSON.stringify(levelIds) } : area.id === 'plans' ? normalizePricing(record.values) : { ...record.values },
    ...(record.rooms ? { rooms: record.rooms.map(room => ({ ...room, serviceIds: [...room.serviceIds] })) } : {}),
    ...(area.id === 'services' ? { curriculum: record.id === 'piano' ? { level1: ['hl-296001'], level2: ['hl-296006'], level3: ['hl-296011'] } : {} } : {}),
  }))]))
}
export function pricingName(values: Record<string, string>): string {
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(values.price) || 0) + ' USD'
  const rates = durationRates(values)
  const rateLabel = rates.map(rate => `${rate.minutes} min · ${rate.price ? `$${Number(rate.price).toFixed(2)} USD` : 'Price not set'}`).join(' / ')
  const label = values.kind === 'Subscription'
    ? `${values.cadence} subscription · ${rates.length ? `${rateLabel} per lesson` : `${amount}${values.basis === 'Per scheduled lesson' ? ' per lesson' : ' fixed'}`}`
    : values.kind === 'Single lesson' ? `Single lesson · ${amount}` : `${values.kind} · ${values.visits} lessons · ${amount}`
  const extras = [Number(values.fee) > 0 ? `$${values.fee} sign-up fee` : '', Number(values.deposit) > 0 ? `$${values.deposit} deposit` : ''].filter(Boolean)
  return [label, ...extras].join(' · ')
}
export type DurationRate = { minutes: number; price: string }
export function durationRates(values: Record<string, string>): DurationRate[] {
  if (values.kind !== 'Subscription' || values.basis !== 'Per scheduled lesson') return []
  try {
    const parsed: unknown = JSON.parse(values.durationPrices || '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is DurationRate => !!item && typeof item === 'object' && Number.isInteger(item.minutes) && typeof item.price === 'string') : []
  } catch { return [] }
}
export function pricingSummary(values: Record<string, string>): string {
  const rates = durationRates(values)
  return rates.length ? rates.map(rate => `${rate.minutes} min: ${rate.price ? `$${Number(rate.price).toFixed(2)} USD` : 'Price not set'}`).join(' · ') + ` · ${values.cadence}` : `$${Number(values.price).toFixed(2)} USD · ${values.basis} · ${values.cadence}`
}
export function pricingFields(values: Record<string, string>): SetupField[] {
  const subscription = values.kind === 'Subscription'
  return setupAreas.find(area => area.id === 'plans')!.fields.filter(field => {
    if (field.key === 'price' && durationRates(values).length) return false
    if (['cadence', 'first', 'basis'].includes(field.key)) return subscription
    if (field.key === 'visits') return ['Lesson pack', 'Prepaid term'].includes(values.kind)
    return true
  }).map(field => field.key === 'first' ? { ...field, options: values.basis === 'Per scheduled lesson'
    ? ['Remaining scheduled lessons', 'Full amount']
    : ['Full amount', 'Prorate by calendar days', 'Prorate by scheduled lessons'] } : field)
}
export function normalizePricing(values: Record<string, string>): Record<string, string> {
  const next = { ...values }
  delete next.discount
  delete next.service
  if (next.kind !== 'Subscription') { next.cadence = 'Once'; next.basis = 'Fixed amount'; delete next.first }
  else {
    if (!['Monthly', 'Weekly', 'Every two weeks'].includes(next.cadence)) next.cadence = 'Monthly'
    const options = pricingFields(next).find(field => field.key === 'first')!.options!
    if (!options.includes(next.first)) next.first = options[0]
  }
  if (!['Lesson pack', 'Prepaid term'].includes(next.kind)) delete next.visits
  else if (!next.visits) next.visits = '10'
  next.name = pricingName(next)
  return next
}
export const discountFields = [
  { key: 'staffMember', label: 'Family · active staff member', type: 'choice', unit: '', min: 0, options: ['Yes', 'No'], description: 'The student is a staff member or belongs to an active staff member’s household.' },
  { key: 'familyStudents', label: 'Has another actively enrolled student in the same family', type: 'number', unit: 'students', min: 0, description: 'Applies when two or more students in the family are actively enrolled. Paused, cancelled and pending enrollments do not count.' },
  { key: 'activeEnrollments', label: 'Student · active enrollments', type: 'number', unit: 'enrollments', min: 0, description: 'Count this student’s active enrollments, excluding pending, frozen and cancelled enrollments.' },
  { key: 'membershipMonths', label: 'Student · membership duration', type: 'number', unit: 'completed months', min: 0, description: 'Completed calendar months since this student’s recorded Member since date. Missing dates require data before eligibility can be determined.' },
  { key: 'ageYears', label: 'Student · age', type: 'number', unit: 'completed years', min: 0, description: 'Completed years since the student’s birthday, evaluated on the eligibility date.' },
  { key: 'lessonMinutes', label: 'Enrollment · lesson length', type: 'number', unit: 'minutes', min: 1, description: 'The lesson duration of the enrollment receiving the discount.' },
  { key: 'level', label: 'Enrollment · progression level', type: 'number', unit: 'level number', min: 1, description: 'The stable progression level number of the enrollment receiving the discount, not its editable display name.' },
  { key: 'frequency', label: 'Enrollment · frequency', type: 'choice', unit: '', min: 0, options: ['Weekly', 'One-off'], description: 'The recurring or one-off frequency of the enrollment receiving the discount.' },
  { key: 'status', label: 'Enrollment · status', type: 'choice', unit: '', min: 0, options: ['active', 'pending'], description: 'The status of the enrollment receiving the discount.' },
] as const
export type DiscountField = typeof discountFields[number]['key']
export const discountComparisons = [
  { value: 'gte', label: 'At least' }, { value: 'gt', label: 'More than' },
  { value: 'eq', label: 'Equals' }, { value: 'neq', label: 'Does not equal' },
  { value: 'lte', label: 'At most' }, { value: 'lt', label: 'Less than' },
] as const
export type DiscountCondition = { id: string; field: DiscountField; comparison: typeof discountComparisons[number]['value']; value: string }
export type DiscountPolicy = { combination: 'best' | 'combine'; order: 'percentage-first' | 'fixed-first' }
export type SetupDiscount = { id: string; name: string; amount: string; unit: '%' | '$'; match: 'all' | 'any'; conditions: DiscountCondition[]; startsOn?: string; endsOn?: string }
export type DiscountFacts = Partial<Record<DiscountField, string>>
export function conditionComparisons(field: DiscountField) {
  return discountFields.find(item => item.key === field)?.type === 'choice' ? discountComparisons.filter(item => ['eq', 'neq'].includes(item.value)) : discountComparisons
}
export function newDiscountCondition(id: string, field: DiscountField = 'familyStudents'): DiscountCondition {
  const definition = discountFields.find(item => item.key === field)!
  return { id, field, comparison: definition.type === 'choice' ? 'eq' : 'gte', value: definition.type === 'choice' ? definition.options[0] : field === 'familyStudents' ? '2' : field === 'membershipMonths' ? '12' : String(definition.min) }
}
export function createDiscounts(experience: SetupExperience): SetupDiscount[] {
  return experience === 'new' ? [] : [{ id: 'family-discount', name: 'Sibling discount', amount: '10', unit: '%', match: 'all', conditions: [newDiscountCondition('family-size')] }, { id: 'staff-discount', name: 'Staff discount', amount: '50', unit: '%', match: 'all', conditions: [newDiscountCondition('staff-member', 'staffMember')] }]
}
export function validateDiscountCondition(condition: DiscountCondition): string | null {
  if (condition.field === 'familyStudents') return condition.comparison === 'gte' && condition.value === '2' ? null : 'Choose the family discount condition.'
  const definition = discountFields.find(item => item.key === condition.field)
  if (!definition || !conditionComparisons(condition.field).some(item => item.value === condition.comparison)) return 'Choose a valid field and comparison.'
  if (definition.type === 'choice') return (definition.options as readonly string[]).includes(condition.value) ? null : 'Choose a valid condition value.'
  return /^\d+$/.test(condition.value) && Number.isSafeInteger(Number(condition.value)) && Number(condition.value) >= definition.min ? null : `Enter a whole number of ${definition.unit}, at least ${definition.min}.`
}
export function validateDiscount(discount: SetupDiscount): string | null {
  if (!discount.name.trim()) return 'Enter a discount name.'
  for (const date of [discount.startsOn, discount.endsOn]) {
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) return 'Enter a valid discount date.'
  }
  if (discount.startsOn && discount.endsOn && discount.endsOn < discount.startsOn) return 'End date must be on or after the start date.'
  if (!['%', '$'].includes(discount.unit) || !/^\d+(\.\d{1,2})?$/.test(discount.amount) || !Number.isFinite(Number(discount.amount)) || Number(discount.amount) <= 0 || (discount.unit === '%' && Number(discount.amount) > 100)) return 'Enter a positive discount amount, up to 100 for a percentage.'
  if (!['all', 'any'].includes(discount.match)) return 'Choose whether all or any conditions must match.'
  if (!discount.conditions.length) return 'Add at least one eligibility condition.'
  for (const condition of discount.conditions) {
    const message = validateDiscountCondition(condition)
    if (message) return message
  }
  return null
}
export function discountConditionLabel(condition: DiscountCondition): string {
  const comparison = { gte: 'at least', gt: 'more than', eq: 'exactly', neq: 'not exactly', lte: 'at most', lt: 'fewer than' }[condition.comparison]
  const value = condition.value || '…'
  const plural = (singular: string) => `${value} ${singular}${condition.value === '1' ? '' : 's'}`
  switch (condition.field) {
    case 'staffMember': return `Applies when the student or their household ${condition.comparison === 'neq' ? 'does not match' : 'matches'} active staff membership: ${value}.`
    case 'familyStudents': return 'Has another actively enrolled student in the same family.'
    case 'activeEnrollments': return `Applies when a student has ${comparison} ${plural('active enrollment')}.`
    case 'membershipMonths': return `Applies when a student has been a member for ${comparison} ${plural('month')}.`
    case 'ageYears': return `Applies when a student is ${comparison} ${plural('year')} old.`
    case 'lessonMinutes': return `Applies when the lesson length is ${comparison} ${plural('minute')}.`
    case 'level': return `Applies when the progression level is ${comparison} ${value}.`
    case 'frequency': return `Applies when lessons are ${condition.comparison === 'neq' ? 'not ' : ''}${value.toLowerCase()}.`
    case 'status': return `Applies when the enrollment is ${condition.comparison === 'neq' ? 'not ' : ''}${value.toLowerCase()}.`
  }
}
export const discountValueLabels: Record<DiscountField, string> = {
  staffMember: 'Student or household has an active staff member',
  familyStudents: 'Number of students in the same family',
  activeEnrollments: 'Number of active enrollments per student',
  membershipMonths: 'Membership duration (months)',
  ageYears: 'Student age (years)',
  lessonMinutes: 'Lesson length (minutes)',
  level: 'Progression level number',
  frequency: 'Lesson frequency',
  status: 'Enrollment status',
}
export function evaluateDiscount(discount: SetupDiscount, facts: DiscountFacts): 'eligible' | 'not-eligible' | 'missing-data' {
  if (validateDiscount(discount)) return 'missing-data'
  const results = discount.conditions.map(condition => {
    const actual = facts[condition.field]
    if (actual === undefined || actual === '') return null
    if (condition.field === 'familyStudents') return /^\d+$/.test(actual) && Number.isSafeInteger(Number(actual)) ? Number(actual) >= 2 : null
    if (validateDiscountCondition({ ...condition, value: actual })) return null
    const definition = discountFields.find(item => item.key === condition.field)!
    const a = definition.type === 'number' ? Number(actual) : actual
    const b = definition.type === 'number' ? Number(condition.value) : condition.value
    switch (condition.comparison) {
      case 'eq': return a === b
      case 'neq': return a !== b
      case 'gte': return a >= b
      case 'gt': return a > b
      case 'lte': return a <= b
      case 'lt': return a < b
    }
  })
  if (discount.match === 'all' && results.includes(false)) return 'not-eligible'
  if (discount.match === 'any' && results.includes(true)) return 'eligible'
  if (results.includes(null)) return 'missing-data'
  return discount.match === 'all' ? 'eligible' : 'not-eligible'
}
export function visibleFields(area: SetupArea, values: Record<string, string>) { return area.id === 'plans' ? pricingFields(values) : area.id === 'policies' ? area.fields.filter(field => !['closure', 'start', 'end'].includes(field.key)) : area.fields }
export function validateSetup(area: SetupArea, values: Record<string, string>): string | null {
  if (area.id === 'plans' && values.durationPrices && values.kind === 'Subscription' && values.basis === 'Per scheduled lesson') {
    const rates = durationRates(values)
    if (!rates.length || new Set(rates.map(rate => rate.minutes)).size !== rates.length || rates.some(rate => rate.minutes < 5 || rate.minutes > 480 || !/^\d+(\.\d{1,2})?$/.test(rate.price))) return 'Set a valid price for each lesson duration, with no duplicate durations.'
  }
  for (const item of (area.id === 'policies' && values.timelyAction !== undefined ? [] : visibleFields(area, values))) {
    const value = values[item.key]?.trim() || ''
    if (!value && !item.optional) return `Enter ${item.label.toLowerCase()}.`
    if (value && item.options && !item.options.includes(value)) return `Choose ${item.label.toLowerCase()}.`
    if (value && item.type === 'number' && (!Number.isFinite(Number(value)) || Number(value) < 0 || (!['price', 'fee', 'deposit'].includes(item.key) && !Number.isInteger(Number(value))))) return `Check ${item.label.toLowerCase()}.`
    if (value && ['capacity', 'visits'].includes(item.key) && Number(value) < 1) return 'Enter a positive capacity or lesson count.'
    if (item.key === 'discount' && Number(value) > 100) return 'Discount cannot exceed 100%.'
    if (value && ['price', 'fee', 'deposit'].includes(item.key) && !/^\d+(\.\d{1,2})?$/.test(value)) return 'Enter amounts with no more than two decimal places.'
    if (value && item.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid contact email.'
  }
  if (area.id === 'services' && !values.durations.split(',').every(v => /^\d+$/.test(v.trim()) && Number(v) >= 5 && Number(v) <= 480)) return 'Enter lesson lengths from 5 to 480 minutes, separated by commas.'
  if (area.id === 'services') {
    const formats = selection(values.formats)
    if (!formats.length || formats.some(id => !lessonFormats.some(format => format.id === id))) return 'Choose at least one lesson format.'
    if (!selection(values.scheduling).length || selection(values.scheduling).some(value => !schedulingOptions.includes(value))) return 'Choose an available scheduling option.'
    if (!selection(values.levelIds).length || selection(values.levelIds).some(id => !levelIds.includes(id))) return 'Choose at least one school level.'
  }
  if (area.id === 'school' && levelIds.some(id => !(values[id] ?? defaultLevelNames[id])?.trim())) return 'Enter a name for each school level.'
  if (area.id === 'teachers') {
    const scheduleError = validateTeacherExceptions(values)
    if (scheduleError) return scheduleError
    if (values.locationIds) {
      try { const ids = JSON.parse(values.locationIds); if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string' || !id.trim())) return 'Choose at least one teaching location.' } catch { return 'Choose teaching locations.' }
    }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return 'Enter a valid teacher email.'
    if (values.assignments) {
      try {
        const assignments = JSON.parse(values.assignments)
        if (!Array.isArray(assignments) || !assignments.length || assignments.some(item => !item.serviceId || !Number.isInteger(item.maxLevel) || item.maxLevel < 1 || item.maxLevel > levelIds.length)) return 'Choose a teaching assignment and maximum level.'
      } catch { return 'Check teaching assignments.' }
    }
    if (values.availability) {
      try {
        const blocks = JSON.parse(values.availability)
        if (!Array.isArray(blocks) || !blocks.length || blocks.some(item => !Number.isInteger(item.day) || item.day < 0 || item.day > 6 || !Number.isInteger(item.from) || !Number.isInteger(item.to) || item.from < 360 || item.to > 1320 || item.to <= item.from)) return 'Set availability between 6am and 10pm, with end times after start times.'
        if (blocks.some((item, index) => blocks.some((other, otherIndex) => index !== otherIndex && item.day === other.day && item.from < other.to && other.from < item.to))) return 'Availability blocks on the same day cannot overlap.'
      } catch { return 'Check weekly availability.' }
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.from) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.to) || values.to <= values.from) return 'End time must be after start time.'
    if (!values.days.split(',').every(day => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(day.trim()))) return 'Enter full working-day names separated by commas.'
  }
  if (area.id === 'plans' && values.kind !== 'Subscription' && (values.cadence !== 'Once' || values.basis !== 'Fixed amount')) return 'Choose Once for a single lesson, pack or prepaid term.'
  if (area.id === 'policies' && (values.closure || values.start || values.end) && (!values.closure?.trim() || !values.start || !values.end || values.end < values.start)) return 'Enter a closure name and a valid start/end date range.'
  if (area.id === 'policies' && values.closures) {
    try {
      const rows = JSON.parse(values.closures)
      if (!Array.isArray(rows) || rows.some(row => !row.name?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(row.start) || !/^\d{4}-\d{2}-\d{2}$/.test(row.end) || !Number.isFinite(Date.parse(row.start)) || !Number.isFinite(Date.parse(row.end)) || row.end < row.start || !row.location)) return 'Complete each closure with a name, valid dates and location.'
    } catch { return 'Check closure dates.' }
  }
  return null
}
export function validateRooms(rooms: SetupRoom[], serviceIds: string[]): string | null {
  for (const [index, room] of rooms.entries()) {
    if (room.conferenceUrl) {
      try { if (new URL(room.conferenceUrl).protocol !== 'https:') return `Use an HTTPS online lesson link for room ${index + 1}.` }
      catch { return `Enter a valid online lesson link for room ${index + 1}.` }
    }
    if (!room.name.trim()) return `Enter a name for room ${index + 1}.`
    if (!/^\d+$/.test(room.capacity) || Number(room.capacity) < 1) return `Enter a positive capacity for room ${index + 1}.`
    if (!room.allServices && room.serviceIds.some(id => !serviceIds.includes(id))) return `Choose available services for room ${index + 1}.`
  }
  return null
}
