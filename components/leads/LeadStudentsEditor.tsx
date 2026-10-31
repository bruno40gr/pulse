'use client'

import { useState } from 'react'

import { Button, DenseSectionPanel, Input, Modal, ModalBody, ModalFooter, ModalHeader, SectionTitle, Select } from '@/components/ui'
import { LESSON_PROGRAM_GROUPS } from '@/lib/lead-lesson-details'
import { canUseContactAsStudent, emptyStudentPreferences, studentFromContact, syncStudentAvailability, type InquiryStudentContact, type LeadStudent } from '@/lib/lead-students'
import { birthdayAge, validBirthday } from '@/lib/lead-birthday'
import { colors, radius, spacing, typography } from '@/lib/tokens'

import { StudentMultiSelect } from './StudentMultiSelect'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function StudentProgram({ value, index, onChange }: { value: string; index: number; onChange: (value: string) => void }) {
  const selected = value.split(',').map(item => item.trim()).filter(Boolean)
  const category = (item: string) => item.startsWith('Private · ') ? 'Private' : item.startsWith('Semi-private · ') ? 'Semi-private' : LESSON_PROGRAM_GROUPS[2].options.includes(item) ? 'Group' : ''
  const categories = [...new Set(selected.map(category))]
  const recorded = categories.length === 1 ? categories[0] : ''
  const [draftService, setDraftService] = useState('')
  const service = draftService || recorded
  const group = LESSON_PROGRAM_GROUPS[service === 'Private' ? 0 : service === 'Semi-private' ? 1 : 2]
  return <>
    <Select label="Service" aria-label={`Student ${index + 1} service`} value={service} onChange={event => setDraftService(event.target.value)}>
      <option value="">Select…</option><option value="Private">Private</option><option value="Semi-private">Semi-private</option><option value="Group">Group</option>
    </Select>
    <StudentMultiSelect label="Program" ariaLabel={`Student ${index + 1} program`} value={value} options={service ? group.options.map(option => ({ value: option, label: option.replace(/^(Private|Semi-private) · /, '') })) : selected.map(option => ({ value: option, label: option }))} onChange={onChange} />
  </>
}

export function LeadStudentsEditor({ students, onChange, disabled = false, onSave, dirty = false, contact }: {
  students: LeadStudent[]
  onChange: (students: LeadStudent[]) => void
  disabled?: boolean
  onSave?: () => void
  dirty?: boolean
  contact?: InquiryStudentContact
}) {
  const [confirmStudent, setConfirmStudent] = useState<number | null>(null)
  const applyContact = (index: number) => {
    if (!contact || disabled) return
    onChange(students.map((item, i) => i === index ? studentFromContact({ ...item, name: '', email: '', phone: '' }, contact) : item))
    setConfirmStudent(null)
  }
  const isContact = (student: LeadStudent) => Boolean(contact && student.same_as_contact && (['name', 'email', 'phone'] as const).every(key => student[key].trim() === contact[key].trim()))
  const update = (index: number, patch: Partial<LeadStudent>) => onChange(syncStudentAvailability(students.map((student, i) => i === index ? { ...student, ...patch } : student)))
  return <><DenseSectionPanel title={<SectionTitle>Students</SectionTitle>} actions={<div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
    <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => onChange(syncStudentAvailability([...students, { name: '', age: '', instrument_interest: '', date_of_birth: '', relationship_to_contact: '', email: '', phone: '', preferences: emptyStudentPreferences(), same_availability: true }]))}>Add student</Button>
    {onSave && <Button type="button" size="sm" disabled={disabled || !dirty || students.some(student => student.date_of_birth && !validBirthday(student.date_of_birth))} onClick={onSave}>{disabled ? 'Saving…' : 'Save students'}</Button>}
  </div>}>
    <div style={{ display: 'grid', gap: spacing.md }}>
      {students.map((student, index) => <fieldset key={index} disabled={disabled} style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: spacing.md, margin: 0, minWidth: 0 }}>
        <legend style={{ fontSize: typography.sizeSm }}>Student {index + 1}</legend>
        {contact && index === 0 && <label style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, fontSize: typography.sizeSm }}>
          <input type="checkbox" aria-label="Classes are for myself" checked={Boolean(student.same_as_contact)} onChange={event => {
            if (!event.target.checked) return update(index, { same_as_contact: false })
            const conflict = !canUseContactAsStudent(student, contact)
            if (conflict) return setConfirmStudent(index)
            applyContact(index)
          }} />
          Classes are for myself
        </label>}
        <div role="group" aria-label={`Student ${index + 1} personal details`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: spacing.sm }}>
          {(!isContact(student)) && <>
          <Input label="Student name" aria-label={`Student ${index + 1} name`} value={student.name} onChange={e => update(index, { name: e.target.value })} />
          <Input label="Email" type="email" aria-label={`Student ${index + 1} own email`} value={student.email} onChange={e => update(index, { email: e.target.value })} />
          <Input label="Phone" type="tel" aria-label={`Student ${index + 1} own phone`} value={student.phone} onChange={e => update(index, { phone: e.target.value })} />
          </>}
          {!student.same_as_contact && <Input label="Birthday" type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} aria-label={`Student ${index + 1} birthday`} value={student.date_of_birth} onChange={e => update(index, { date_of_birth: e.target.value })} error={student.date_of_birth && !validBirthday(student.date_of_birth) ? 'Enter a valid birthday, not a future date.' : undefined} hint={birthdayAge(student.date_of_birth) !== null ? `Age ${birthdayAge(student.date_of_birth)} (calculated)` : student.age ? `Previously reported age: ${student.age}. Birthday not recorded.` : undefined} />}
          {(!isContact(student)) && <Select label="Relationship" aria-label={`Student ${index + 1} relationship`} value={student.relationship_to_contact} onChange={e => update(index, { relationship_to_contact: e.target.value })}>
            <option value="">Not confirmed</option>
            {student.relationship_to_contact && !['parent', 'guardian', 'self', 'other'].includes(student.relationship_to_contact) && <option value={student.relationship_to_contact}>{student.relationship_to_contact}</option>}
            <option value="parent">Parent</option><option value="guardian">Guardian</option><option value="self">Self</option><option value="other">Other</option>
          </Select>}
        </div>
        <div role="group" aria-label={`Student ${index + 1} lesson preferences`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: spacing.sm, marginTop: spacing.md }}>
          <StudentProgram value={student.instrument_interest} index={index} onChange={value => update(index, { instrument_interest: value })} />
          <Select label="Experience" aria-label={`Student ${index + 1} experience`} value={student.preferences?.experience || ''} onChange={event => update(index, { preferences: { ...emptyStudentPreferences(), ...student.preferences, experience: event.target.value } })}>
            <option value="">Not provided</option>
            {student.preferences?.experience && !['Beginner', 'Intermediate', 'Advanced'].includes(student.preferences.experience) && <option value={student.preferences.experience}>{student.preferences.experience} (previously recorded)</option>}
            <option value="Beginner">Beginner</option><option value="Intermediate">Intermediate</option><option value="Advanced">Advanced</option>
          </Select>
          {index > 0 && <label style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, gridColumn: '1 / -1', fontSize: typography.sizeSm }}>
            <input type="checkbox" aria-label={`Student ${index + 1} same availability preferences`} checked={Boolean(student.same_availability)} onChange={event => update(index, { same_availability: event.target.checked })} />Same availability preferences as Student 1
          </label>}
          {!(index > 0 && student.same_availability) && <>
            <StudentMultiSelect label="Available days" ariaLabel={`Student ${index + 1} available days`} value={student.preferences?.preferredDays || ''} options={WEEKDAYS.map(day => ({ value: day, label: day }))} onChange={value => update(index, { preferences: { ...emptyStudentPreferences(), ...student.preferences, preferredDays: value } })} />
            <StudentMultiSelect label="Preferred times" ariaLabel={`Student ${index + 1} preferred times`} value={student.preferences?.preferredTimes || ''} options={['morning', 'afternoon', 'evening'].map(time => ({ value: time, label: time[0].toUpperCase() + time.slice(1) }))} onChange={value => update(index, { preferences: { ...emptyStudentPreferences(), ...student.preferences, preferredTimes: value } })} />
          </>}
        </div>
      </fieldset>)}
    </div>
  </DenseSectionPanel>
    <Modal isOpen={confirmStudent !== null} onClose={() => setConfirmStudent(null)} size="sm" ariaLabel="Use lead details for this student">
      <ModalHeader title="Use lead details?" onClose={() => setConfirmStudent(null)} />
      <ModalBody>Replace this student’s name, email and phone with the lead’s main details? Birthday, programs and preferences will be kept.</ModalBody>
      <ModalFooter>
        <Button type="button" variant="secondary" onClick={() => setConfirmStudent(null)}>Cancel</Button>
        <Button type="button" disabled={disabled || !contact} onClick={() => confirmStudent !== null && applyContact(confirmStudent)}>Use lead details</Button>
      </ModalFooter>
    </Modal>
  </>
}