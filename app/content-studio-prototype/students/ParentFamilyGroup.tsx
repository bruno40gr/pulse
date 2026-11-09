'use client'

import { ConfirmActionButton } from './ConfirmActionButton'

import { useState } from 'react'
import { Button, DenseSectionPanel, EmptyState, FieldGrid, Input, Select, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui'
import { BackControl } from '@/components/ui/BackControl'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { SectionHeader } from './SectionHeader'
import { AccountWorkspace } from './AccountWorkspace'
import { ContactEditor } from './ContactEditor'
import { previewStudentName, type PreviewStudent } from '@/lib/academy-student-preview'
import type { FamilyAction, PreviewAccount } from '@/lib/academy-family-preview'
import { spacing } from '@/lib/tokens'
import styles from './ParentPortal.module.css'
import familyStyles from './ParentFamilyGroup.module.css'

export function ParentFamilyGroup({ account, students, onApply, canvas, onBack, embedded = false }: { account: PreviewAccount; students: PreviewStudent[]; onApply: (action: FamilyAction) => string | null; embedded?: boolean; canvas?: 'manage' | 'add'; onBack?: () => void }) {
  const [view, setView] = useState<'dependents' | 'manage' | 'add'>(canvas || 'dependents')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState({ firstName: '', lastName: '', email: '', phone: '', birthday: '' })
  const removing = students.find(student => student.id === removingId)
  function changeView(next: typeof view) { setView(next); setError('') }

  const addAction = <Button onClick={() => { setDraft({ firstName: '', lastName: '', email: '', phone: '', birthday: '' }); changeView('add') }}>Add Dependent</Button>
  const body = <section aria-label="Dependents" className={styles.stack}>
    {(!canvas || embedded) && <SectionHeader actions={view === 'dependents' ? <div className={styles.lessonActions}><Button variant="secondary" onClick={() => changeView('manage')}>Manage Family Group</Button><Button onClick={() => { setDraft({ firstName: '', lastName: '', email: '', phone: '', birthday: '' }); changeView('add') }}>Add Dependent</Button></div> : view === 'manage' ? addAction : undefined}>
      <SectionTitle as="h2" variant="card">{view === 'manage' ? 'Manage Family Group' : view === 'add' ? 'Add Dependent' : 'Dependents'}</SectionTitle>
    </SectionHeader>}
    {!canvas && view !== 'dependents' && <BackControl label="Back to dependents" showLabel onClick={() => changeView('dependents')} />}
    {view === 'dependents' ? students.map(student => <section key={student.id} aria-label={`${previewStudentName(student)} contact details`}><ContactEditor title={previewStudentName(student)} contact={student} accountId={account.id} onApply={onApply} /></section>) : view === 'manage' ? <div aria-label="Family group members" className={familyStyles.members}>{students.map(student => <div key={student.id} className={familyStyles.member} aria-label={`${previewStudentName(student)} family membership`}>
      <SectionTitle as="h3" variant="card">{previewStudentName(student)}</SectionTitle>
      <Select aria-label={`${previewStudentName(student)} relationship`} value={account.dependentRelationships?.[student.id] || 'Child'} onChange={event => setError(onApply({ kind: 'dependent-relationship', accountId: account.id, studentId: student.id, relationship: event.target.value }) || '')}>{['Child', 'Spouse', 'Sibling', 'Other'].map(value => <option key={value}>{value}</option>)}</Select>
      <Button variant="secondary" onClick={() => { setRemovingId(student.id); setError('') }}>Remove from Family Group</Button>
    </div>)}</div> : <DenseSectionPanel title="Contact details" actions={<div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}><Button type="button" variant="secondary" onClick={() => canvas === 'manage' ? changeView('manage') : onBack ? onBack() : changeView('dependents')}>Cancel</Button><Button type="submit" form="parent-add-dependent">Add Dependent</Button></div>}><form id="parent-add-dependent" onSubmit={event => {
      event.preventDefault()
      const message = onApply({ kind: 'child', accountId: account.id, id: `preview:${crypto.randomUUID()}`, ...draft })
      setError(message || '')
      if (!message) { if (canvas === 'manage') changeView('manage'); else if (onBack) onBack(); else setView('dependents') }
    }}>
      <FieldGrid>{(['firstName', 'lastName', 'email', 'phone', 'birthday'] as const).map(field => <Input key={field} label={{ firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone', birthday: 'Birthday' }[field]} required={field === 'firstName' || field === 'lastName'} type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : field === 'birthday' ? 'date' : 'text'} value={draft[field]} onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))} />)}</FieldGrid>
    </form></DenseSectionPanel>}
    {!students.length && view !== 'add' && <EmptyState title="No dependents" />}
    {error && !removing && <p role="alert">{error}</p>}
    <Modal size="sm" layout="content" isOpen={Boolean(removing)} onClose={() => { setRemovingId(null); setError('') }} ariaLabel="Remove from Family Group">
      <ModalHeader title="Remove from Family Group" onClose={() => { setRemovingId(null); setError('') }} />
      <ModalBody>
        {removing && <p>Unlink {previewStudentName(removing)} from {account.holderName}’s account? {removing.firstName} will remain a standalone student record, with their subscriptions, outstanding balance, and history.</p>}
        {error && <p role="alert">{error}</p>}
      </ModalBody>
      <ModalFooter><Button variant="secondary" onClick={() => { setRemovingId(null); setError('') }}>Cancel</Button><ConfirmActionButton onClick={() => {
          if (!removing) return
          const message = onApply({ kind: 'unlink-child', accountId: account.id, studentId: removing.id })
          setError(message || '')
          if (!message) setRemovingId(null)
        }}>Confirm</ConfirmActionButton></ModalFooter>
    </Modal>
  </section>
  return canvas && !embedded ? <AccountWorkspace title={view === 'manage' ? 'Manage Family Group' : 'Add Dependent'} actions={view === 'manage' ? addAction : undefined} accountName={account.holderName} profileSubtitle="Account manager" onBack={() => canvas === 'manage' && view === 'add' ? changeView('manage') : onBack?.()}>{body}</AccountWorkspace> : body
}