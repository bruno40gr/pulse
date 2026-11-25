'use client'

import { useEffect, useRef, useState } from 'react'
import WorkflowEditor from '@/beta-source/app/content-studio-prototype/event-explorer/WorkflowEditor'
import { newWorkflowDraft, type WorkflowContext, type WorkflowDraft } from '@/beta-source/lib/academy-workflow-drafts'
import { offeringCatalog, type AcademySettings } from '@/beta-source/lib/academy-explorer'
import type { SetupRecord } from '@/beta-source/app/content-studio-prototype/school-setup/setup-content'
import type { BandCreationDraft } from '@/lib/band-creation-draft'
import { Notice } from '@/components/ui'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { getActiveTenantId } from '@/lib/tenant'
import { BandStudentPicker } from './BandStudentPicker'

const academy: AcademySettings = { kind: 'music', name: '', ...offeringCatalog('music'), groups: [], trialDiscount: 0, singleLessons: [] }
const unavailable = () => { throw new Error('This action is not available in band creation.') }
const programActions = { onStudent: unavailable, onRequest: unavailable, onPropose: unavailable,
  onPortal: unavailable, onResponse: unavailable, onConfirm: unavailable }

/** Production transport around the original Beta workflow, not a parallel form. */
export function CreateBandWizard({ initialName = '', initialDraft, onClose, onCreated }: {
  initialName?: string; initialDraft?: { state: BandCreationDraft; revision: number }
  onClose: () => void; onCreated: (name: string) => void
}) {
  const [tenantId] = useState(getActiveTenantId)
  const [draft] = useState(() => {
    const record = initialDraft?.state || newWorkflowDraft('group', academy, 'groups') as BandCreationDraft
    return { ...record, data: { ...record.data, name: initialDraft ? record.data.name : initialName } }
  })
  const revision = useRef(initialDraft?.revision || 0)
  const inFlight = useRef(false)
  const [busy, setBusy] = useState(false)
  const [context, setContext] = useState<WorkflowContext | null>(null)
  const [staff, setStaff] = useState<SetupRecord[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    const query = `tenant=${encodeURIComponent(tenantId)}`
    void Promise.all([fetch(`/api/contacts?${query}`, { cache: 'no-store', signal: controller.signal }),
      fetch(`/api/staff?${query}`, { cache: 'no-store', signal: controller.signal })]).then(async responses => {
      if (responses.some(response => !response.ok)) throw new Error('Could not load students and teachers. Reopen the draft to retry.')
      const [people, teachers] = await Promise.all(responses.map(response => response.json()))
      if (!Array.isArray(people) || !Array.isArray(teachers)) throw new Error('Invalid student or teacher response.')
      if (controller.signal.aborted) return
      const assigned = teachers.filter((row: { person_id?: string; is_active?: boolean }) => row.person_id && row.is_active !== false)
        .map((row: { person_id: string; first_name?: string; last_name?: string }) => ({ id: row.person_id, values: { name: `${row.first_name || ''} ${row.last_name || ''}`.trim() } })) as SetupRecord[]
      setStaff(assigned)
      setContext({ academy, staffIds: assigned.map(row => row.id), events: [], people: people.filter((row: { is_student?: boolean }) => row.is_student === true)
        .map((row: { id: string; first_name?: string; last_name?: string; email?: string; account_holder_name?: string }) => ({
          id: row.id, name: `${row.first_name || ''} ${row.last_name || ''}`.trim(), email: row.email || '', family: row.account_holder_name || '',
          roles: ['Student'], enrolled: true, customer: true,
        })) })
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load band creation.') })
    return () => controller.abort()
  }, [tenantId])
  async function save(record: WorkflowDraft, complete: boolean) {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError('')
    try {
      const response = await fetch(`/api/bands/drafts?tenant=${encodeURIComponent(tenantId)}`, { method: 'PUT',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft: record, revision: revision.current, complete }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not save this band draft.')
      revision.current = result.revision
      if (complete || result.completed) onCreated(result.band)
      else onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this band draft.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  if (!context) return error ? <Notice variant="error">{error}</Notice> : <LoadingSkeleton label="Loading band creation" rows={5} />
  return <>
    {error && <Notice variant="error">{error}</Notice>}
    <WorkflowEditor initial={draft} context={context} staff={staff} persistenceBusy={busy}
      bandCandidatePicker={(selectedIds, onChange) => <BandStudentPicker options={context.people.map(person => ({ id: person.id, name: person.name, relationship: 'Student', searchText: `${person.email} ${person.family}` }))} selectedIds={selectedIds} onSelectionChange={onChange} state="ready" disabled={busy}
        onBusyChange={setBusy} onCreated={person => { setContext(current => current ? { ...current, people: [...current.people, { id: person.id, name: person.name, email: person.detail || '', family: '', roles: ['Student'], enrolled: true, customer: true }] } : current); onChange([...selectedIds, person.id]) }} />}
      onUpdate={() => { /* The shared editor owns unsaved fields until Save & close. */ }}
      onSave={record => void save(record, false)} onComplete={record => void save(record, true)}
      onCancel={onClose} onCreate={unavailable} programActions={programActions} />
  </>
}