type EnrollmentLike = {
  service_type?: string | null
  plan_name?: string | null
  session_name?: string | null
  lesson_day?: string | null
  lesson_time?: string | null
  custom_fields?: Record<string, unknown> | null
}

function norm(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

export function isNonStudentBooking(enrollment?: EnrollmentLike | null): boolean {
  if (!enrollment) return false

  const instructor = norm(enrollment.custom_fields?.instructor)
  const planName = norm(enrollment.plan_name ?? enrollment.custom_fields?.plan_name)
  const sessionName = norm(enrollment.session_name ?? enrollment.custom_fields?.session_name)
  const serviceType = norm(enrollment.service_type ?? enrollment.custom_fields?.service_type)
  const instrument = norm(enrollment.custom_fields?.instrument)
  const lessonDay = norm(enrollment.lesson_day ?? enrollment.custom_fields?.lesson_day)
  const lessonTime = norm(enrollment.lesson_time ?? enrollment.custom_fields?.lesson_time)
  const combined = [planName, sessionName, serviceType, instrument].filter(Boolean).join(' ')

  if (/(rehearsal|rehearse|room rental|room booking|studio rental|studio booking|booking)/.test(combined)) {
    return true
  }

  return instructor === 'admin staff'
    && !planName
    && !!sessionName
    && !lessonDay
    && !lessonTime
    && instrument === 'band'
    && serviceType === 'private'
}
