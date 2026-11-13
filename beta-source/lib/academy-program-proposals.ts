import type { AcademyKind } from './academy-explorer'
import type { ExplorerInquiry, ExplorerPerson } from './event-explorer'

export type AvailabilityBlock = { id: string; date: string; from: string; to: string }
export type ProgramPlan = {
  leadProposalId?: string; name: string; groupId: string; memberIds: string[]; leader: string; roles: Record<string, string>;
  week: string; date: string; time: string; duration: number; mode: 'once' | 'ongoing'; price: string; discount: number;
}
export type ProgramTask = {
  id: string; institution: AcademyKind; proposalId: string; proposalName: string; studentId: string; week: string;
  blocks: AvailabilityBlock[]; submitted: boolean; schedule?: string; confirmedSchedule?: string;
}
export type ProgramBooking = { id: string; institution: AcademyKind; proposalId: string; groupId: string; plan: ProgramPlan; totalPerPerson: number }
export function newProgramPlan(): ProgramPlan {
  return { name: '', groupId: '', memberIds: [], leader: '', roles: {}, week: '2026-11-16', date: '', time: '', duration: 60, mode: 'once', price: '40', discount: 0 }
}
export function scheduleSignature(plan: ProgramPlan) {
  return `${plan.date}|${plan.time}|${plan.duration}|${plan.mode}|${plan.leader}`
}
export function programTotal(plan: ProgramPlan) {
  const price = Number(plan.price)
  if (!plan.price.trim() || !Number.isFinite(price) || price < 0 || !Number.isFinite(plan.discount) || plan.discount < 0 || plan.discount > 100) throw new Error('Enter a valid price and discount between 0 and 100%.')
  return Math.round(price * (1 - plan.discount / 100) * 100) / 100
}
export function availabilityError(blocks: AvailabilityBlock[], week: string) {
  if (!blocks.length) return 'Add at least one available time.'
  const end = new Date(`${week}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 6)
  const last = end.toISOString().slice(0, 10)
  if (blocks.some(block => !/^\d{4}-\d{2}-\d{2}$/.test(block.date) || block.date < week || block.date > last || !/^\d{2}:\d{2}$/.test(block.from) || !/^\d{2}:\d{2}$/.test(block.to) || block.from < '06:00' || block.to > '22:00' || block.from >= block.to)) return 'Choose times within the requested week, between 6am and 10pm.'
  if (blocks.some((block, index) => blocks.some((other, otherIndex) => index !== otherIndex && block.date === other.date && block.from < other.to && other.from < block.to))) return 'Availability blocks must not overlap.'
  return ''
}
export function requestProgramAvailability(tasks: ProgramTask[], proposalId: string, institution: AcademyKind, plan: ProgramPlan): ProgramTask[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.week) || !Number.isFinite(Date.parse(`${plan.week}T12:00:00Z`))) throw new Error('Choose a valid requested week.')
  return [...tasks.filter(task => task.proposalId !== proposalId || task.institution !== institution), ...plan.memberIds.map(studentId => {
    const existing = tasks.find(task => task.proposalId === proposalId && task.studentId === studentId && task.institution === institution && task.week === plan.week)
    return existing ? { ...existing, proposalName: plan.name } : { id: crypto.randomUUID(), institution, proposalId, proposalName: plan.name, studentId, week: plan.week, blocks: [], submitted: false }
  })]
}
export function submitProgramAvailability(tasks: ProgramTask[], taskId: string, allowedStudentIds: string[], blocks: AvailabilityBlock[]): ProgramTask[] {
  const task = tasks.find(task => task.id === taskId && allowedStudentIds.includes(task.studentId))
  if (!task) throw new Error('Availability request unavailable for this family.')
  const error = availabilityError(blocks, task.week)
  if (error) throw new Error(error)
  return tasks.map(item => item.id === taskId ? { ...item, blocks: blocks.map(block => ({ ...block })), submitted: true, confirmedSchedule: undefined } : item)
}
export function taskCoversSchedule(task: ProgramTask, plan: ProgramPlan) {
  const start = Number(plan.time.slice(0, 2)) * 60 + Number(plan.time.slice(3))
  const end = start + plan.duration
  return task.submitted && task.blocks.some(block => block.date === plan.date && Number(block.from.slice(0, 2)) * 60 + Number(block.from.slice(3)) <= start && Number(block.to.slice(0, 2)) * 60 + Number(block.to.slice(3)) >= end)
}
export function programScheduleError(plan: ProgramPlan, tasks: ProgramTask[]) {
  if (!plan.date || !/^\d{2}:\d{2}$/.test(plan.time) || !Number.isInteger(plan.duration) || plan.duration < 15 || plan.duration > 180 || plan.time < '06:00' || Number(plan.time.slice(0, 2)) * 60 + Number(plan.time.slice(3)) + plan.duration > 1320) return 'Choose a session date, time and duration between 6am and 10pm.'
  if (plan.memberIds.some(id => !tasks.some(task => task.studentId === id && taskCoversSchedule(task, plan)))) return 'Choose a time covered by every participant’s submitted availability.'
  try { programTotal(plan) } catch (error) { return (error as Error).message }
  return ''
}
export function confirmProgramSchedule(tasks: ProgramTask[], taskId: string, allowedStudentIds: string[], plan: ProgramPlan): ProgramTask[] {
  const task = tasks.find(task => task.id === taskId && allowedStudentIds.includes(task.studentId))
  if (!task || task.schedule !== scheduleSignature(plan) || !taskCoversSchedule(task, plan)) throw new Error('This schedule is unavailable or has changed. Review the current proposal.')
  return tasks.map(item => item.id === taskId ? { ...item, confirmedSchedule: item.schedule } : item)
}
export function syncProgramLeads(inquiries: ExplorerInquiry[], proposalId: string, plan: ProgramPlan): ExplorerInquiry[] {
  proposalId = plan.leadProposalId || proposalId
  return [...inquiries.filter(inquiry => inquiry.proposalId !== proposalId || plan.memberIds.includes(inquiry.personId)).map(inquiry => inquiry.proposalId === proposalId ? { ...inquiry, interest: plan.name || 'Band / group program proposal' } : inquiry), ...plan.memberIds.filter(id => !inquiries.some(inquiry => inquiry.proposalId === proposalId && inquiry.personId === id)).map(personId => ({ id: crypto.randomUUID(), proposalId, personId, origin: 'staff_initiated' as const, interest: plan.name || 'Band / group program proposal', stage: 'New' as const, category: 'Program inquiries', followUp: '', note: 'Added to a program proposal. One-session booking does not confirm ongoing enrollment.' }))]
}
export function createProgramStudent(people: ExplorerPerson[], input: { name: string; email: string; guardian: string; instruments: string; accountId?: string }): ExplorerPerson {
  if (!input.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Enter a student name and valid contact email.')
  if (people.some(person => person.name.trim().toLowerCase() === input.name.trim().toLowerCase() && person.email.toLowerCase() === input.email.toLowerCase())) throw new Error('This student already exists. Find and select their record.')
  return { id: crypto.randomUUID(), name: input.name.trim(), email: input.email.trim(), family: input.guardian.trim() || 'Self', accountId: input.accountId || crypto.randomUUID(), instruments: input.instruments.split(',').map(value => value.trim()).filter(Boolean), roles: ['Student'], enrolled: false, customer: false }
}