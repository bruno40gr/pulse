import { lessonPrice, lessonStudent, type StaffEnrollment } from './academy-staff-enrollment'
import { lessonOccursOn, shiftDate } from './academy-enrollment-schedule'

// Fixed local-preview date keeps the sample calendar and billing examples reproducible.
export const pricingPreviewDate = '2026-10-27'

export function enrollmentBillingPreview(draft: StaffEnrollment, today = pricingPreviewDate) {
  const month = today.slice(0, 7)
  const nextMonth = shiftDate(`${month}-28`, 4).slice(0, 7)
  const nextDate = `${nextMonth}-01`
  const followingMonth = shiftDate(`${nextMonth}-28`, 4).slice(0, 7)
  function period(from: string, until: string, next: boolean) {
    const lines = draft.lessons.map(lesson => {
      const dates: string[] = []
      for (let date = from; date < until; date = shiftDate(date, 1)) {
        if (lessonOccursOn(lesson, date) && (!next || lesson.frequency === 'Monthly subscription')) dates.push(date)
      }
      const price = lessonPrice(lesson, lessonStudent(draft, lesson))
      return { lesson, dates, price, total: dates.length * price.total }
    }).filter(line => line.dates.length > 0)
    return { lines, total: lines.reduce((sum, line) => sum + line.total, 0) }
  }
  // One-off lessons are charged today even when their date is in a later month.
  const current = period(today, nextDate, false)
  for (const lesson of draft.lessons.filter(item => item.frequency === 'À-la-carte' && item.start >= nextDate && item.teacher && item.time)) {
    const price = lessonPrice(lesson, lessonStudent(draft, lesson))
    current.lines.push({ lesson, dates: [lesson.start], price, total: price.total })
    current.total += price.total
  }
  return { today, nextDate, current, next: period(nextDate, `${followingMonth}-01`, true) }
}