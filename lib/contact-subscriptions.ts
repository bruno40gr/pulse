import { isNonStudentBooking } from '@/lib/contact-kind'
import { isCurrentEnrollment } from '@/lib/current-enrollment'
import { currentSubscriptionTeacher } from '@/lib/current-subscription-teacher'

type Enrollment = {
  id: string
  status?: string | null
  instrument?: string | null
  service_type?: string | null
  plan_name?: string | null
  session_name?: string | null
  instructor_person_id?: string | null
  lesson_day?: string | null
  lesson_time?: string | null
  custom_fields?: Record<string, unknown> | null
}
export type SubscriptionTeacher = {
  id: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  email?: string | null
  custom_fields?: Record<string, unknown> | null
}

export function currentStudentEnrollments(enrollments: Enrollment[] = []): Enrollment[] {
  return enrollments.filter(entry => !isNonStudentBooking(entry) && isCurrentEnrollment(entry))
}

/** Shared list/detail contract. Historical names never substitute for person identity. */
export function contactSubscriptions(enrollments: Enrollment[] = [], teachers: ReadonlyMap<string, SubscriptionTeacher>) {
  return currentStudentEnrollments(enrollments).map(entry => {
    const instructor = currentSubscriptionTeacher(teachers.get(entry.instructor_person_id ?? ''))
    const value = (key: string) => {
      const field = entry.custom_fields?.[key]
      return typeof field === 'string' || typeof field === 'number' ? field : null
    }
    return {
      id: entry.id, instrument: entry.instrument, service_type: entry.service_type,
      plan_name: entry.plan_name, session_name: entry.session_name,
      instructor_person_id: entry.instructor_person_id,
      appointment_class_name: value('appointment_class_name'),
      lesson_day: entry.lesson_day, lesson_time: entry.lesson_time,
      level: value('level'), duration: value('duration'), instructor,
      teacher_assignment_needs_review: !instructor,
    }
  })
}