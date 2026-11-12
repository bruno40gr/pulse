/** Transport-independent billing contracts. Dates are ISO calendar dates; ranges are
 * half-open [start, end). No clock, database, fixture, payment or UI dependencies. */
export type BillingRange = { start: string; end: string }
export type BillingSelection = { subscriptionId: string; ranges: BillingRange[] }
export type BillingConflict = BillingRange & { subscriptionId: string; invoiceId: string; status: string }
export type BillingSchedule = {
  start: string; coverageMonths: number; cadenceMonths: number; advanceDays: number
  paymentDays: number; mode: 'manual' | 'automatic'; end?: string; occurrences?: number
  custom: { issueDate: string; selections: BillingSelection[] }[]
  overrides?: Record<string, { offsetMonths: number; coverageMonths: number }>
}
export type BillingArrangement = {
  id: string; accountId: string; payerId: string; billTo?: string; billingDetails?: string
  subscriptionIds: string[]; schedule: BillingSchedule; status: 'active' | 'paused' | 'cancelled'
  proration: 'whole-month' | 'calendar-days'; generatedKeys: string[]
  revision?: number; fullBillingMonths?: boolean
}
export function billingDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
export function addBillingDays(value: string, days: number) {
  if (!billingDate(value) || !Number.isSafeInteger(days)) throw new Error('Choose a valid date and day interval.')
  const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
export function addBillingMonths(value: string, months: number) {
  if (!billingDate(value) || !Number.isSafeInteger(months)) throw new Error('Choose a valid month interval.')
  const date = new Date(`${value}T12:00:00Z`), day = date.getUTCDate()
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months)
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, last)); return date.toISOString().slice(0, 10)
}
export function monthCoverage(start: string, count: number): BillingRange {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(start) || !Number.isInteger(count) || count < 1 || count > 24) throw new Error('Choose a start month and 1–24 months.')
  return { start: `${start}-01`, end: addBillingMonths(`${start}-01`, count) }
}
export function rangesOverlap(a: BillingRange, b: BillingRange) { return a.start < b.end && b.start < a.end }
export function validateBillingRanges(ranges: BillingRange[]) {
  if (!ranges.length || ranges.length > 24) throw new Error('Choose 1–24 service periods.')
  const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start))
  for (let index = 0; index < sorted.length; index++) {
    const range = sorted[index]
    if (!billingDate(range.start) || !billingDate(range.end) || range.start >= range.end || range.end > addBillingMonths(range.start, 24)) throw new Error('Choose a valid coverage range of up to 24 months.')
    if (index && rangesOverlap(sorted[index - 1], range)) throw new Error('Selected service periods overlap.')
  }
  return sorted
}
export function splitBillingMonths(ranges: BillingRange[]) {
  return validateBillingRanges(ranges).flatMap(range => {
    const result: BillingRange[] = []
    for (let start = range.start; start < range.end;) {
      const next = addBillingMonths(`${start.slice(0, 7)}-01`, 1), end = next < range.end ? next : range.end
      result.push({ start, end }); start = end
    }
    return result
  })
}
/** Return uncovered segments; never replace an issued invoice as a side effect. */
export function subtractBillingCoverage(range: BillingRange, covered: BillingRange[]) {
  return covered.reduce<BillingRange[]>((remaining, block) => remaining.flatMap(item => !rangesOverlap(item, block) ? [item] : [
    ...(item.start < block.start ? [{ start: item.start, end: block.start }] : []),
    ...(block.end < item.end ? [{ start: block.end, end: item.end }] : []),
  ]), [range])
}
export function priceBillingSegment(range: BillingRange, basis: { quantity: number; unitMinor: number; proration: 'whole-month' | 'calendar-days' }) {
  validateBillingRanges([range])
  const monthStart = `${range.start.slice(0, 7)}-01`, monthEnd = addBillingMonths(monthStart, 1)
  if (range.end > monthEnd || !Number.isSafeInteger(basis.quantity) || basis.quantity < 1 || !Number.isSafeInteger(basis.unitMinor) || basis.unitMinor < 0 || !['whole-month', 'calendar-days'].includes(basis.proration)) throw new Error('Check pricing basis and service period.')
  const partial = range.start !== monthStart || range.end !== monthEnd
  if (partial && basis.proration === 'whole-month') throw new Error('Partial-month coverage requires an explicit proration rule.')
  const total = basis.quantity * basis.unitMinor
  if (!Number.isSafeInteger(total)) throw new Error('Charge exceeds supported precision.')
  const ratio = (Date.parse(range.end) - Date.parse(range.start)) / (Date.parse(monthEnd) - Date.parse(monthStart))
  return { quantity: partial ? 1 : basis.quantity, unitMinor: partial ? Math.round(total * ratio) : basis.unitMinor, partial }
}
export function validateBillingSchedule(schedule: BillingSchedule, subscriptionIds: string[]) {
  monthCoverage(schedule.start.slice(0, 7), schedule.coverageMonths)
  if (schedule.start !== `${schedule.start.slice(0, 7)}-01` || !billingDate(schedule.start) || !Number.isInteger(schedule.cadenceMonths) || schedule.cadenceMonths < 1 || schedule.cadenceMonths > 24 || !Number.isInteger(schedule.advanceDays) || schedule.advanceDays < 0 || schedule.advanceDays > 365 || !Number.isInteger(schedule.paymentDays) || schedule.paymentDays < 0 || schedule.paymentDays > 365 || !['manual', 'automatic'].includes(schedule.mode)) throw new Error('Check schedule intervals, timing and payment terms.')
  if (schedule.end && (!billingDate(schedule.end) || schedule.end < schedule.start)) throw new Error('Schedule end must follow its start.')
  if (schedule.occurrences !== undefined && (!Number.isInteger(schedule.occurrences) || schedule.occurrences < 1 || schedule.occurrences > 120)) throw new Error('Choose 1–120 invoices.')
  if (schedule.custom.length > 24) throw new Error('Use up to 24 custom invoices.')
  for (const [id, override] of Object.entries(schedule.overrides || {})) {
    if (!subscriptionIds.includes(id) || !Number.isInteger(override.offsetMonths) || override.offsetMonths < 0 || override.offsetMonths > 24) throw new Error('Check subscription schedule overrides.')
    monthCoverage(schedule.start.slice(0, 7), override.coverageMonths)
  }
  for (const row of schedule.custom) {
    if (!billingDate(row.issueDate) || !row.selections.length || new Set(row.selections.map(item => item.subscriptionId)).size !== row.selections.length) throw new Error('Check custom invoice dates and subscriptions.')
    for (const selection of row.selections) { if (!subscriptionIds.includes(selection.subscriptionId)) throw new Error('Custom schedule subscription unavailable.'); validateBillingRanges(selection.ranges) }
  }
}
export function previewBillingSchedule(schedule: BillingSchedule, subscriptionIds: string[], limit = 6) {
  validateBillingSchedule(schedule, subscriptionIds)
  if (!subscriptionIds.length || new Set(subscriptionIds).size !== subscriptionIds.length) throw new Error('Choose unique subscriptions for the schedule.')
  const rows: { key: string; issueDate: string; dueDate: string; selections: BillingSelection[] }[] = []
  for (let index = 0; index < Math.min(limit, schedule.occurrences ?? limit); index++) {
    const custom = schedule.custom[index], regularIndex = index - schedule.custom.length
    const start = addBillingMonths(schedule.start, Math.max(0, regularIndex) * schedule.cadenceMonths)
    const selections = custom?.selections ?? subscriptionIds.map(subscriptionId => {
      const override = schedule.overrides?.[subscriptionId]
      return { subscriptionId, ranges: [monthCoverage(addBillingMonths(start, override?.offsetMonths || 0).slice(0, 7), override?.coverageMonths || schedule.coverageMonths)] }
    })
    const serviceStart = selections.flatMap(item => item.ranges).sort((a, b) => a.start.localeCompare(b.start))[0].start
    if (schedule.end && serviceStart > schedule.end) break
    if (schedule.end && selections.some(item => item.ranges.some(range => addBillingDays(range.end, -1) > schedule.end!))) break
    const issueDate = custom?.issueDate ?? addBillingDays(start, -schedule.advanceDays)
    rows.push({ key: String(index), issueDate, dueDate: addBillingDays(issueDate, schedule.paymentDays), selections })
  }
  return rows
}
export function billingScheduleWarnings(rows: ReturnType<typeof previewBillingSchedule>) {
  const warnings = new Set<string>()
  const bySubscription = new Map<string, BillingRange[]>()
  for (const row of rows) for (const selection of row.selections) bySubscription.set(selection.subscriptionId, [...(bySubscription.get(selection.subscriptionId) || []), ...selection.ranges])
  for (const ranges of bySubscription.values()) {
    const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start))
    for (let index = 1; index < sorted.length; index++) {
      if (rangesOverlap(sorted[index - 1], sorted[index])) warnings.add('Scheduled coverage overlaps. Already invoiced dates will be excluded.')
      if (sorted[index - 1].end < sorted[index].start) warnings.add('There are gaps between scheduled service periods.')
    }
  }
  return [...warnings]
}