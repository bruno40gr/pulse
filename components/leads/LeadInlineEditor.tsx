'use client'

import { useState, type ReactNode } from 'react'
import { Button, DenseSectionPanel, Input, Modal, ModalBody, ModalFooter, ModalHeader, SectionTitle, Select, SlidePanelHeader } from '@/components/ui'
import { isLessonLead } from '@/lib/lead-lesson-details'
import { leadStudentsPatch, readLeadStudents, syncStudentContact } from '@/lib/lead-students'
import { validBirthday } from '@/lib/lead-birthday'
import { colors, spacing } from '@/lib/tokens'
import { LeadStudentsEditor } from './LeadStudentsEditor'

type Contact = { id: string; full_name: string; email: string | null; phone: string | null }
type Inquiry = { id: string; intake_type: string; contact_id: string; contact?: Contact | null; payload: Record<string, unknown>; program_label: string | null; status: string; updated_at: string }

/** Inquiry-scoped editor using the authenticated lead API. */
export function LeadInlineEditor({ lead, onClose, onSaved, renderHeader }: {
  lead: Inquiry
  onClose: () => void
  onSaved: () => Promise<void>
  renderHeader?: (onRequestClose: () => void) => ReactNode
}) {
  const [type, setType] = useState(lead.intake_type)
  const [contact, setContact] = useState({ name: lead.contact?.full_name || '', email: lead.contact?.email || '', phone: lead.contact?.phone || '' })
  const [students, setStudents] = useState(() => readLeadStudents(lead.payload, lead.program_label))
  const [discard, setDiscard] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const originalContact = { name: lead.contact?.full_name || '', email: lead.contact?.email || '', phone: lead.contact?.phone || '' }
  const dirty = type !== lead.intake_type || JSON.stringify(contact) !== JSON.stringify(originalContact) || JSON.stringify(students) !== JSON.stringify(readLeadStudents(lead.payload, lead.program_label))
  const valid = contact.name.trim() && (!isLessonLead(type) || students.every(student => !student.date_of_birth || validBirthday(student.date_of_birth)))
  const changeContact = (next: typeof contact) => {
    setContact(next)
    // An explicit self learner follows typo corrections, never a different person.
    setStudents(current => syncStudentContact(current, next))
  }
  const save = async () => {
    if (!valid || saving) return
    setSaving(true)
    setError('')
    try {
      const studentPatch = isLessonLead(type) ? leadStudentsPatch(students, lead.payload) : {}
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expected_updated_at: lead.updated_at, intake_type: type,
          full_name: contact.name.trim(), email: contact.email.trim(), phone: contact.phone.trim(), ...studentPatch }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not save correction')
      await onSaved()
      onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save correction') }
    finally { setSaving(false) }
  }
  return <>
    {renderHeader ? renderHeader(() => { if (!saving) { if (dirty) setDiscard(true); else onClose() } }) : <SlidePanelHeader title={lead.contact?.full_name || 'Lead'} onClose={() => !saving && (dirty ? setDiscard(true) : onClose())} />}
    <div style={{ padding: spacing.lg, overflowY: 'auto', minHeight: 0, display: 'grid', gap: spacing.lg }}>
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'grid', gap: spacing.lg }}>
        <Select label="Lead type" aria-label="Lead type" value={type} onChange={event => setType(event.target.value)}>
          <option value="lesson_inquiry">Lesson inquiry</option><option value="tour_request">Tour request</option><option value="service_inquiry">Service inquiry</option>
          {!['lesson_inquiry', 'tour_request', 'service_inquiry'].includes(type) && <option value={type}>{type}</option>}
        </Select>
        <DenseSectionPanel title={<SectionTitle>Contact</SectionTitle>}>
          <div style={{ display: 'grid', gap: spacing.md }}>
            <Input label="Contact name" aria-label="Contact name" value={contact.name} onChange={event => changeContact({ ...contact, name: event.target.value })} />
            <Input label="Email" aria-label="Email" type="email" value={contact.email} onChange={event => changeContact({ ...contact, email: event.target.value })} />
            <Input label="Phone" aria-label="Phone" type="tel" value={contact.phone} onChange={event => changeContact({ ...contact, phone: event.target.value })} />

          </div>
        </DenseSectionPanel>
        {isLessonLead(type) ? <LeadStudentsEditor students={students} onChange={setStudents} disabled={saving} contact={contact} /> : null}
      </fieldset>
    </div>
    <div style={{ padding: spacing.lg, borderTop: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'flex-end', gap: spacing.md }}>
      <Button variant="secondary" disabled={saving} onClick={() => dirty ? setDiscard(true) : onClose()}>Cancel</Button>
      <Button disabled={saving || !dirty || !valid} onClick={() => void save()}>{saving ? 'Saving…' : 'Save changes'}</Button>
    </div>
    <Modal isOpen={discard} onClose={() => setDiscard(false)} ariaLabel="Discard lead changes">
      <ModalHeader title="Discard unsaved changes?" onClose={() => setDiscard(false)} />
      <ModalBody>Your changes have not been saved.</ModalBody>
      <ModalFooter><Button variant="secondary" onClick={() => setDiscard(false)}>Keep editing</Button><Button onClick={onClose}>Discard changes</Button></ModalFooter>
    </Modal>
  </>
}