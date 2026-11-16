'use client'

import { createContext, useContext } from 'react'
import type { EnrollmentDraftRecord } from '@/beta-source/lib/academy-enrollment-drafts'
import type { LessonChoice } from '@/beta-source/lib/academy-staff-enrollment'
import { makeupSlots, type MakeupSlotResolver } from '@/beta-source/lib/academy-makeup-preview'

/** Local demo adapter; both existing enrollment surfaces use the same commands. */
export const CalendarEnrollmentContext = createContext<{
  save: (record: EnrollmentDraftRecord, complete: boolean, actor: 'staff' | 'family', accountId?: string) => void
  availability: (date: string, time: string, lesson: LessonChoice) => readonly { name: string }[]
  teachers: readonly { name: string; instruments: string[] }[]
  rescheduleAvailability?: MakeupSlotResolver
} | null>(null)
export const useCalendarEnrollment = () => useContext(CalendarEnrollmentContext)
export const useRescheduleAvailability = () => useContext(CalendarEnrollmentContext)?.rescheduleAvailability || makeupSlots