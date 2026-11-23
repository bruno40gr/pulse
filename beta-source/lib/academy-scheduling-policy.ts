/** Shared mock scheduling policy. Ten minutes' rest reserves a whole half-hour. */
export type SchedulingPolicy = { maxGap: number; teachingLimit: number; restMinutes: number; publicFrom: string; publicTo: string; publicEnabled: boolean }
export const schedulingDefaults = { maxTeachingGap: '120', teachingBeforeBreak: '240', restBreakMinutes: '10', publicFrom: '09:00', publicTo: '21:00', publicBooking: 'yes' }
export const timeMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
export const minuteTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
export const roundedBreak = (minutes: number) => Math.ceil(minutes / 30) * 30
export function readSchedulingPolicy(values: Record<string, string> = {}, teacher: Record<string, string> = {}): SchedulingPolicy {
  const merged = { ...schedulingDefaults, ...values, ...Object.fromEntries(Object.entries(teacher).filter(([, value]) => value !== '')) }
  return { maxGap: Number(merged.maxTeachingGap), teachingLimit: 240, restMinutes: roundedBreak(10), publicFrom: merged.publicFrom, publicTo: merged.publicTo, publicEnabled: merged.publicBooking !== 'no' }
}
export function validateSchedulingPolicy(values: Record<string, string>): string | null {
  for (const [key, label, min, max] of [['maxTeachingGap', 'maximum teaching gap', 30, 240]] as const) {
    if (values[key] && (!/^\d+$/.test(values[key]) || Number(values[key]) < min || Number(values[key]) > max || Number(values[key]) % 30 !== 0)) return `Check ${label}. Use half-hour increments for teaching and gap limits.`
  }
  const clock = /^(?:[01]\d|2[0-3]):(?:00|30)$/
  if ((values.publicFrom || values.publicTo) && (!clock.test(values.publicFrom) || !clock.test(values.publicTo) || values.publicFrom >= values.publicTo)) return 'Set public booking hours in 30-minute increments, with the end after the start.'
  return null
}

/** Check the proposed teaching run, deduplicating shared class participants. */
export function teachingPolicyReason(existing: { time: string; duration: number }[], time: string, duration: number, policy: SchedulingPolicy, occupied: { time: string; duration: number }[] = []) {
  const proposed = { from: timeMinutes(time), to: timeMinutes(time) + duration, proposed: true }
  const unique = new Map(existing.map(item => [`${item.time}:${item.duration}`, { from: timeMinutes(item.time), to: timeMinutes(item.time) + item.duration, proposed: false }]))
  const sessions = [...unique.values(), proposed].sort((a, b) => a.from - b.from)
  const index = sessions.indexOf(proposed)
  const adjacent = [sessions[index - 1], sessions[index + 1]].filter(Boolean)
  if (adjacent.some(item => (item.to <= proposed.from ? proposed.from - item.to : item.from - proposed.to) > policy.maxGap)) return `This would leave a teacher gap longer than ${policy.maxGap} minutes.`
  let run = 0, containsProposal = false, previousEnd = -Infinity
  for (const session of sessions) {
    const gapStart = Math.ceil(previousEnd / 30) * 30
    const work = occupied.map(item => ({ from: timeMinutes(item.time), to: timeMinutes(item.time) + item.duration })).filter(item => item.from < session.from && item.to > gapStart).sort((a, b) => a.from - b.from)
    let freeFrom = gapStart, rested = session.from - gapStart >= policy.restMinutes
    if (work.length) {
      rested = false
      for (const item of work) {
        if (item.from - freeFrom >= policy.restMinutes) rested = true
        freeFrom = Math.max(freeFrom, item.to)
      }
      if (session.from - freeFrom >= policy.restMinutes) rested = true
    }
    if (rested) { run = 0; containsProposal = false }
    run += session.to - session.from
    containsProposal ||= session.proposed
    if (containsProposal && run > policy.teachingLimit) return `A ${policy.restMinutes}-minute slot must stay free after ${policy.teachingLimit} minutes of teaching.`
    previousEnd = Math.max(previousEnd, session.to)
  }
  return null
}