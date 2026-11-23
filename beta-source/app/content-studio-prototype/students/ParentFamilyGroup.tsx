'use client'

import { ConfirmActionButton } from './ConfirmActionButton'
import { OverflowMenu } from '@/components/ui/OverflowMenu'
import { PersonName } from '@/components/ui/PersonName'

import { useState } from 'react'
import { Button, DenseSectionPanel, EmptyState, FieldGrid, Input, Select, Modal, ModalBody, ModalFooter, ModalHeader } from '@/beta-source/components/ui'
import { BackControl } from '@/beta-source/components/ui/BackControl'
import { SectionTitle } from '@/beta-source/components/ui/SectionTitle'
import { SectionHeader } from './SectionHeader'
import { AccountWorkspace } from './AccountWorkspace'
import { ContactEditor } from './ContactEditor'
import { previewStudentName, type PreviewStudent } from '@/beta-source/lib/academy-student-preview'
import type { FamilyAction, PreviewAccount } from '@/beta-source/lib/academy-family-preview'
import { spacing } from '@/beta-source/lib/tokens'
import styles from './ParentPortal.module.css'
import familyStyles from './ParentFamilyGroup.module.css'

export function ParentFamilyGroup({ account, students, onApply, canvas, onBack, embedded = false, existingDependent, addDependent, canRemove, addStudentAction, accountHolderAction, accountHolderContent }: { account: PreviewAccount; students: PreviewStudent[]; onApply: (action: FamilyAction) => string | null | Promise<string | null>; embedded?: boolean; canvas?: 'manage' | 'add'; onBack?: () => void; existingDependent?: React.ReactNode; addDependent?: React.ReactNode; canRemove?: (id: string) => boolean; addStudentAction?: React.ReactNode; accountHolderAction?: React.ReactNode; accountHolderContent?: React.ReactNode }) {
  const [view, setView] = useState<'dependents' | 'manage' | 'add'>(canvas || 'dependents')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState({ firstName: '', lastName: '', email: '', phone: '', birthday: '' })
  const removing = students.find(student => student.id === removingId)
  function changeView(next: typeof view) { setView(next); setError('') }

  const addAction = <div className={styles.lessonActions}>{addStudentAction || <Button onClick={() => { setDraft({ firstName: '', lastName: '', email: '', phone: '', birthday: '' }); changeView('add') }}>Add student</Button>}{accountHolderAction}</div>
  const body = <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><section aria-label="Dependents" className={styles.stack}>
    {(!canvas || embedded) && <SectionHeader actions={view === 'dependents' ? <div className={styles.lessonActions}><Button variant="secondary" onClick={() => changeView('manage')}>Manage Family Group</Button><Button onClick={() => { setDraft({ firstName: '', lastName: '', email: '', phone: '', birthday: '' }); changeView('add') }}>Add Dependent</Button></div> : view === 'manage' ? addAction : undefined}>
      <SectionTitle as="h2" variant="card">{view === 'manage' ? 'Manage Family Group' : view === 'add' ? 'Add student' : 'Dependents'}</SectionTitle>
    </SectionHeader>}
    {!canvas && view !== 'dependents' && <BackControl label="Back to dependents" showLabel onClick={() => changeView('dependents')} />}
    {addDependent && canvas === 'manage' && view === 'add' && <BackControl label="Back to family group" showLabel onClick={() => changeView('manage')} />}
    {view === 'dependents' ? students.map(student => <section key={student.id} aria-label={`${previewStudentName(student)} contact details`}><ContactEditor title={previewStudentName(student)} contact={student} accountId={account.id} onApply={onApply} /></section>) : view === 'manage' ? <div aria-label="Family group members" className={familyStyles.members}>{students.map(student => <div key={student.id} className={familyStyles.member} aria-label={`${previewStudentName(student)} family membership`}>
      <PersonName>{previewStudentName(student)}</PersonName>
      <Select aria-label={`${previewStudentName(student)} relationship`} value={account.dependentRelationships?.[student.id] || 'Child'} onChange={async event => { setBusy(true); try { setError(await onApply({ kind: 'dependent-relationship', accountId: account.id, studentId: student.id, relationship: event.target.value }) || '') } finally { setBusy(false) } }}>{['Child', 'Spouse', 'Sibling', 'Other'].map(value => <option key={value}>{value}</option>)}</Select>
      <fieldset disabled={canRemove ? !canRemove(student.id) : false} title={canRemove && !canRemove(student.id) ? 'Primary account links require reassignment before removal.' : undefined} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <OverflowMenu label={`Actions for ${previewStudentName(student)}`} items={[{ label: 'Remove from family group', onSelect: () => { setRemovingId(student.id); setError('') } }]} />
      </fieldset>
    </div>)}</div> : addDependent || <>{existingDependent}<DenseSectionPanel title="Contact details" actions={<div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}><Button type="button" variant="secondary" onClick={() => canvas === 'manage' ? changeView('manage') : onBack ? onBack() : changeView('dependents')}>Cancel</Button><Button type="submit" form="parent-add-dependent">Add Dependent</Button></div>}><form id="parent-add-dependent" onSubmit={async event => {
      event.preventDefault()
      if (busy) return
      setBusy(true)
      let message: string | null
      try { message = await onApply({ kind: 'child', accountId: account.id, id: `preview:${crypto.randomUUID()}`, ...draft }) }
      finally { setBusy(false) }
      setError(message || '')
      if (!message) { if (canvas === 'manage') changeView('manage'); else if (onBack) onBack(); else setView('dependents') }
    }}>
      <FieldGrid>{(['firstName', 'lastName', 'email', 'phone', 'birthday'] as const).map(field => <Input key={field} label={{ firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone', birthday: 'Birthday' }[field]} required={field === 'firstName' || field === 'lastName'} type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : field === 'birthday' ? 'date' : 'text'} value={draft[field]} onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))} />)}</FieldGrid>
    </form></DenseSectionPanel></>}
    {!students.length && view !== 'add' && <EmptyState title="No dependents" />}
    {view === 'manage' && accountHolderContent}
    {error && !removing && <p role="alert">{error}</p>}
    <Modal size="sm" layout="content" isOpen={Boolean(removing)} onClose={() => { setRemovingId(null); setError('') }} ariaLabel="Remove from Family Group">
      <ModalHeader title="Remove from Family Group" onClose={() => { setRemovingId(null); setError('') }} />
      <ModalBody>
        {removing && <p>Unlink {previewStudentName(removing)} from {account.holderName}’s account? {removing.firstName} will remain a standalone student record, with their subscriptions, outstanding balance, and history.</p>}
        {error && <p role="alert">{error}</p>}
      </ModalBody>
      <ModalFooter><Button variant="secondary" onClick={() => { setRemovingId(null); setError('') }}>Cancel</Button><ConfirmActionButton onClick={async () => {
          if (!removing) return
          setBusy(true)
          let message: string | null
          try { message = await onApply({ kind: 'unlink-child', accountId: account.id, studentId: removing.id }) }
          finally { setBusy(false) }
          setError(message || '')
          if (!message) setRemovingId(null)
        }}>Confirm</ConfirmActionButton></ModalFooter>
    </Modal>
  </section></fieldset>
  return canvas && !embedded ? <AccountWorkspace title={view === 'manage' ? 'Manage Family Group' : 'Add Dependent'} actions={view === 'manage' ? addAction : undefined} accountName={account.holderName} profileSubtitle="Account manager" onBack={() => canvas === 'manage' && view === 'add' ? changeView('manage') : onBack?.()}>{body}</AccountWorkspace> : body
}