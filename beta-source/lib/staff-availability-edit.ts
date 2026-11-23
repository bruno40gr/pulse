import { shiftDate, weekStart } from './academy-enrollment-schedule'
import { teacherDayIndex, teacherWeekAvailability, type TeacherAvailability, type TeacherDateOverride, type TeacherWeekSchedule } from '@/beta-source/app/content-studio-prototype/school-setup/setup-content'

export type AvailabilityScope = 'week' | 'future'

/** A temporary week restores the prior effective schedule unless a later boundary exists. */
export function editStaffAvailability(values: Record<string, string>, base: TeacherAvailability[], date: string, blocks: TeacherAvailability[], scope: AvailabilityScope) {
  const week = weekStart(date)
  const weeks: TeacherWeekSchedule[] = JSON.parse(values.availabilityWeeks || '[]')
  const overrides: TeacherDateOverride[] = JSON.parse(values.availabilityOverrides || '[]')
  const nextWeek = shiftDate(week, 7)
  const result = [...weeks.filter(item => item.week !== week), { week, blocks }]
  if (scope === 'week' && !weeks.some(item => item.week === nextWeek)) result.push({ week: nextWeek, blocks: teacherWeekAvailability(base, weeks, nextWeek) })
  // Keep existing exceptions. Only the edited day is replaced explicitly.
  const nextOverrides = overrides.filter(item => item.date !== date)
  if (overrides.some(item => item.date === date)) nextOverrides.push({ date, blocks: blocks.filter(block => block.day === teacherDayIndex(date)) })
  return { ...values, availabilityWeeks: JSON.stringify(result.sort((a, b) => a.week.localeCompare(b.week))), availabilityOverrides: JSON.stringify(nextOverrides) }
}