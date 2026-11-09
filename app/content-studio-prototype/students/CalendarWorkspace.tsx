'use client'

import { AccountWorkspace } from './AccountWorkspace'
import { WeeklySchedule } from './WeeklySchedule'
import type { ComponentProps } from 'react'
import { previewStudentName } from '@/lib/academy-student-preview'

export function CalendarWorkspace({ onBack, accountName, profileSubtitle, ...props }: ComponentProps<typeof WeeklySchedule> & { onBack: () => void; accountName?: string; profileSubtitle?: string }) {
  const student = props.data.students.find(person => person.id === props.location.studentId)
  const account = props.data.accounts.find(item => item.id === props.location.accountId)
  return <AccountWorkspace profileSubtitle={profileSubtitle} title="Calendar" accountName={accountName || (student ? previewStudentName(student) : account?.holderName) || 'Account'} onBack={onBack}><WeeklySchedule {...props} taskLayout /></AccountWorkspace>
}
