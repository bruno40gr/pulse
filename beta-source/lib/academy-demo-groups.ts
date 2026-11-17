import type { FamilyPreviewData } from './academy-family-preview'
import type { AcademyGroup } from './academy-explorer'

/** Bands are projections of existing enrollment series, not a second roster seed. */
export function demoBandGroups(data: FamilyPreviewData): AcademyGroup[] {
  const groups = new Map<string, AcademyGroup>()
  for (const student of data.students) for (const enrollment of student.enrollments) {
    if (enrollment.serviceId !== 'band' || !enrollment.seriesId) continue
    let group = groups.get(enrollment.seriesId)
    if (!group) {
      group = { id: `demo:group:${enrollment.seriesId}`, seriesId: enrollment.seriesId, typeId: 'group-type-0', name: [enrollment.program || 'Band', enrollment.teacher].filter(Boolean).join(' · '), leader: enrollment.teacher, capacity: 8, trialMax: 1, memberIds: [], schedule: `${enrollment.day} · ${enrollment.time}`, dailySchedule: { days: [enrollment.day], from: enrollment.time, to: `${String(Number(enrollment.time.slice(0, 2)) + 1).padStart(2, '0')}:${enrollment.time.slice(3)}` }, resources: [], eventIds: [], message: '', stage: 'In Development' }
      groups.set(enrollment.seriesId, group)
    }
    if (!group.memberIds.includes(student.id)) group.memberIds.push(student.id)
  }
  return [...groups.values()]
}