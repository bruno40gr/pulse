'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, DenseSectionPanel, Notice, SectionTitle, Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ParticipantPicker, type NewParticipant, type ParticipantOption } from '@/components/contacts/ParticipantPicker'
import { ParentFamilyGroup } from '@/beta-source/app/content-studio-prototype/students/ParentFamilyGroup'
import { ConfirmActionButton } from '@/beta-source/app/content-studio-prototype/students/ConfirmActionButton'
import type { FamilyAction, PreviewAccount } from '@/beta-source/lib/academy-family-preview'
import type { PreviewStudent } from '@/beta-source/lib/academy-student-preview'
import { spacing } from '@/lib/tokens'
import { familyAccountId, type FamilyAccountLink } from '@/lib/family-account'

type Person = { id: string; first_name: string; last_name: string; email?: string | null; phone?: string | null; date_of_birth?: string | null; account_id?: string | null; is_student?: boolean; family_revision?: number; family_links?: { account_id: string; relationship: string | null; is_primary: boolean }[] }
type Account = { id: string; name: string; email: string | null; phone: string | null }
type AccountManager = { id: string; account_id: string; person_id: string; relationship: string | null; is_primary: boolean }
const emptyContact: NewParticipant = { firstName: '', lastName: '', email: '', phone: '', birthday: '' }

/** Existing Beta family UI with explicit live account/person IDs and transport. */
export function LiveFamilyManagement({ tenantId, accountId, personId, onChanged, addStudentOnly = false, onCancel }: {
  tenantId: string; accountId?: string | null; personId?: string; onChanged?: () => void; addStudentOnly?: boolean; onCancel?: () => void
}) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [managers, setManagers] = useState<AccountManager[]>([])
  const [accountLinks, setAccountLinks] = useState<FamilyAccountLink[]>([])
  const [accountLinkingSupported, setAccountLinkingSupported] = useState(false)
  const [people, setPeople] = useState<Person[]>([])
  const [members, setMembers] = useState<Person[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)
  const [selectedAccount, setSelectedAccount] = useState('')
  const [existingStudent, setExistingStudent] = useState('')
  const [studentMode, setStudentMode] = useState<'existing' | 'new'>('existing')
  const [studentDraft, setStudentDraft] = useState<NewParticipant>(emptyContact)
  const [activeTask, setActiveTask] = useState<'student' | 'holders' | null>(null)
  const [managerMode, setManagerMode] = useState<'existing' | 'new'>('existing')
  const [manager, setManager] = useState<NewParticipant>(emptyContact)
  const pending = useRef<{ key: string; id: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setLoaded(false); setError('')
    const query = `tenant=${encodeURIComponent(tenantId)}`
    void Promise.all([fetch(`/api/contacts/family?${query}`, { cache: 'no-store', signal: controller.signal }),
      fetch(`/api/contacts?${query}`, { cache: 'no-store', signal: controller.signal })]).then(async responses => {
      if (responses.some(response => !response.ok)) throw new Error('Could not load family accounts and students.')
      const [directory, roster] = await Promise.all(responses.map(response => response.json()))
      if (!Array.isArray(directory.accounts) || !Array.isArray(directory.managers) || !Array.isArray(roster)) throw new Error('Invalid family response.')
      if (controller.signal.aborted) return
      setAccounts(directory.accounts); setManagers(directory.managers); setPeople(roster)
      setAccountLinks(directory.family_account_links || []); setAccountLinkingSupported(directory.account_linking_supported === true)
      // Primary and explicitly linked accounts are both part of the family view.
      setMembers(roster.filter((person: Person & { linked_account_ids?: string[] }) => person.is_student === true
        && (person.account_id === accountId || person.linked_account_ids?.includes(accountId || '')
          || (person.account_id && familyAccountId(person.account_id, directory.family_account_links || []) === accountId))))
      setLoaded(true)
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Family unavailable.') })
    return () => controller.abort()
  }, [tenantId, accountId, version])
  async function change(payload: Record<string, unknown>): Promise<string | null> {
    if (busy) return 'A family change is already being saved.'
    setBusy(true); setError('')
    payload = { ...payload, expectedRevision: people.find(person => person.id === payload.personId)?.family_revision ?? 0 }
    const key = JSON.stringify(payload)
    if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() }
    try {
      const response = await fetch(`/api/contacts/family?tenant=${encodeURIComponent(tenantId)}`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, operationId: pending.current.id }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Family change was not saved.')
      pending.current = null
      onChanged?.(); setVersion(value => value + 1)
      return null
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Family change was not saved.'
      setError(message); return message
    } finally { setBusy(false) }
  }
  if (!loaded) return error ? <Notice variant="error">{error}</Notice> : <LoadingSkeleton label="Loading family relationships" rows={3} />
  const currentAccountId = accountId || people.find(person => person.id === personId)?.account_id
  if (!currentAccountId) return <Notice>This contact has no family account yet. Open an existing account to link them as a dependent.</Notice>
  const account = accounts.find(row => row.id === currentAccountId)
  const previewAccount: PreviewAccount = { id: currentAccountId, name: account?.name || 'Family', holderId: '',
    holderName: account?.name || 'Family', email: account?.email || '', studentIds: members.map(person => person.id),
    dependentRelationships: Object.fromEntries(members.map(person => [person.id, person.family_links?.find(link => link.account_id === currentAccountId)?.relationship || 'Child'])) }
  const students: PreviewStudent[] = members.map(person => ({ id: person.id, firstName: person.first_name, lastName: person.last_name,
    email: person.email || '', phone: person.phone || '', birthday: person.date_of_birth || '', family: [],
    communicationContactId: '', enrollments: [], notes: [], messages: [] }))
  function apply(action: FamilyAction) {
    if (action.kind === 'child') return change({ kind: 'child', accountId: currentAccountId, relationship: 'Child',
      firstName: action.firstName, lastName: action.lastName, email: action.email, phone: action.phone, birthday: action.birthday })
    if (action.kind === 'dependent-relationship' || action.kind === 'unlink-child') return change({ kind: action.kind,
      accountId: currentAccountId, personId: action.studentId, relationship: action.kind === 'dependent-relationship' ? action.relationship : 'Other' })
    return Promise.resolve('This family action is not supported.')
  }
  const accountManagers = managers.filter(manager => manager.account_id === currentAccountId)
  const personOption = (person: Person): ParticipantOption => {
    const linkedIds = [...new Set([person.account_id, ...(person.family_links || []).map(link => link.account_id)].filter((id): id is string => !!id))]
    return { id: person.id, name: `${person.first_name} ${person.last_name}`.trim(),
      detail: [person.email, person.phone, ...linkedIds.map(id => accounts.find(account => account.id === id)?.name || 'Linked account')].filter(Boolean).join(' · ') }
  }
  const closeTask = () => { if (!busy) { setActiveTask(null); setError(''); onCancel?.() } }
  const studentAction = <Button disabled={busy || (studentMode === 'existing' ? !existingStudent : !studentDraft.firstName.trim() || !studentDraft.lastName.trim())} onClick={async () => {
    const message = await change(studentMode === 'existing'
      ? { kind: 'link-child', accountId: currentAccountId, personId: existingStudent, relationship: 'Child' }
      : { kind: 'child', accountId: currentAccountId, relationship: 'Child', ...studentDraft })
    if (!message) { setExistingStudent(''); setStudentDraft(emptyContact); setActiveTask(null); onCancel?.() }
  }}>{busy ? 'Saving…' : studentMode === 'existing' ? 'Link student' : 'Add student'}</Button>
  const holderAction = <Button disabled={busy || (managerMode === 'existing' ? !selectedAccount : !manager.firstName.trim() || !manager.lastName.trim())} onClick={async () => {
    const accountTarget = selectedAccount.startsWith('account:')
    const message = await change(managerMode === 'existing' && accountTarget
      ? { kind: 'family-account-link', accountId: currentAccountId, memberAccountId: selectedAccount.slice('account:'.length) }
      : { kind: managerMode === 'new' ? 'manager-create' : 'manager-link', accountId: currentAccountId,
        personId: selectedAccount, ...manager })
    if (!message) { setSelectedAccount(''); setManager(emptyContact) }
  }}>{busy ? 'Saving…' : managerMode === 'new' ? 'Add account holder' : 'Link account holder'}</Button>
  const studentPicker = <ParticipantPicker label="Students to add" options={people.filter(person => person.is_student === true).map(person => ({ ...personOption(person), disabled: members.some(member => member.id === person.id) }))}
    selectedIds={existingStudent ? [existingStudent] : []} onSelectionChange={ids => setExistingStudent(ids[0] || '')}
    mode={studentMode} onModeChange={setStudentMode} draft={studentDraft} onDraftChange={setStudentDraft} disabled={busy} />
  const task = addStudentOnly ? 'student' : activeTask
  const title = task === 'student' ? 'Add student' : 'Manage account holders'
  const dialog = <Modal isOpen={!!task} layout="fixed" size="lg" onClose={closeTask} ariaLabel={title}>
    <ModalHeader title={title} onClose={closeTask} />
    <ModalBody>
      {error && <Notice variant="error">{error}</Notice>}
      {task === 'student' ? studentPicker : <div style={{ display: 'grid', gap: spacing.lg }}>
        <Notice>Link an existing person or account. Linking accounts keeps each account’s subscription payers and messaging routing unchanged.</Notice>
        {!accountLinkingSupported && <Notice>Existing-account linking requires the family-account database update. Existing people can still be linked.</Notice>}
        <div style={{ display: 'grid', gap: spacing.sm }}>
          <div>{account?.name || 'Current account'} · Current account</div>
          {accountLinks.filter(link => link.family_account_id === currentAccountId).map(link => <div key={link.member_account_id}>
            {accounts.find(row => row.id === link.member_account_id)?.name || 'Linked account'} · Linked account; existing payer retained
          </div>)}
          {accountManagers.map(link => <div key={link.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
            <span>{people.find(person => person.id === link.person_id) ? (() => { const person = people.find(person => person.id === link.person_id)!; return `${person.first_name} ${person.last_name}`.trim() })() : 'Account holder'}{link.is_primary ? ' · Primary' : ''}</span>
            {!link.is_primary && <ConfirmActionButton disabled={busy} variant="secondary" onClick={async () => { await change({ kind: 'manager-unlink', accountId: currentAccountId, personId: link.person_id }) }}>Remove account holder</ConfirmActionButton>}
          </div>)}
        </div>
        <ParticipantPicker label="Account holders" options={[
          ...people.map(person => ({ ...personOption(person), disabled: accountManagers.some(link => link.person_id === person.id) })),
          ...accounts.filter(row => row.id !== currentAccountId).map(row => ({ id: `account:${row.id}`, name: row.name,
            detail: [row.email, row.phone, 'Existing account · payer unchanged'].filter(Boolean).join(' · '),
            disabled: !accountLinkingSupported || accountLinks.some(link => link.member_account_id === row.id || link.family_account_id === row.id) })),
        ]}
          selectedIds={selectedAccount ? [selectedAccount] : []} onSelectionChange={ids => setSelectedAccount(ids[0] || '')}
          mode={managerMode} onModeChange={setManagerMode} draft={manager} onDraftChange={setManager} disabled={busy} />
      </div>}
    </ModalBody>
    <ModalFooter><Button variant="secondary" disabled={busy} onClick={closeTask}>Cancel</Button>{task === 'student' ? studentAction : holderAction}</ModalFooter>
  </Modal>
  if (addStudentOnly) return dialog
  return <>
    <DenseSectionPanel>
    {!personId ? <ParentFamilyGroup account={previewAccount} students={students} canvas="manage" embedded onApply={apply}
      canRemove={id => members.find(person => person.id === id)?.account_id !== currentAccountId}
      addStudentAction={<Button disabled={busy} onClick={() => { setError(''); setActiveTask('student') }}>Add student</Button>}
      accountHolderAction={<Button variant="secondary" disabled={busy} onClick={() => { setError(''); setActiveTask('holders') }}>Manage account holders</Button>} />
      : <section style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }}><SectionTitle as="h2" variant="card">Manage Family Group</SectionTitle><Button variant="secondary" disabled={busy} onClick={() => { setError(''); setActiveTask('holders') }}>Manage account holders</Button></section>}
    </DenseSectionPanel>
    {!task && error && <Notice variant="error">{error}</Notice>}
    {dialog}
  </>
}
