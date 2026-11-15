import type { FamilyPreviewData } from './academy-family-preview'
import type { MakeupPreviewState } from './academy-makeup-preview'
import type { SetupRecord } from '../app/content-studio-prototype/school-setup/setup-content'

export const demoDatasetVersion = 2
export type DemoSnapshot = { data: FamilyPreviewData; makeups: MakeupPreviewState }
const addedId = (id: string) => id.startsWith('demo:dense-')

/** Append the new population once; never replace tester records or resurrect
 * deleted legacy records. Do not infer identity from booking details. */
export function upgradeDemoDensity(saved: DemoSnapshot, setup: Record<string, SetupRecord[]>, fresh: DemoSnapshot, freshSetup: Record<string, SetupRecord[]>) {
  if ((saved.data.datasetVersion || 0) >= demoDatasetVersion) return { snapshot: saved, setup }
  const append = <T extends { id: string }>(existing: T[], incoming: T[]) => {
    const ids = new Set(existing.map(item => item.id))
    return [...existing, ...incoming.filter(item => !ids.has(item.id))]
  }
  const data = saved.data
  const newStudents = fresh.data.students.filter(item => addedId(item.id) && !data.students.some(student => student.id === item.id))
  const enrollmentIds = new Set(newStudents.flatMap(student => student.enrollments.map(item => item.id)))
  const merged: FamilyPreviewData = {
    ...data, datasetVersion: demoDatasetVersion,
    students: append(data.students, newStudents),
    accounts: append(data.accounts, fresh.data.accounts.filter(item => addedId(item.id))),
    contacts: append(data.contacts || [], (fresh.data.contacts || []).filter(item => addedId(item.id))),
    cards: append(data.cards, fresh.data.cards.filter(item => addedId(item.id))),
    lessons: append(data.lessons, fresh.data.lessons.filter(item => enrollmentIds.has(item.enrollmentId))),
    invoices: append(data.invoices, fresh.data.invoices.filter(item => item.lines.every(line => enrollmentIds.has(line.enrollmentId)))),
  }
  const teacherIds = new Set(freshSetup.teachers.slice(10).map(item => item.id))
  return { snapshot: { ...saved, data: merged }, setup: { ...setup, teachers: append(setup.teachers || [], freshSetup.teachers.filter(item => teacherIds.has(item.id))) } }
}