'use client'

import { useState } from 'react'
import { LEAD_COUNT_EVENT } from '@/lib/lead-count'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal'

type Student = { id: string; name: string }
type Result = { person_id: string; result: 'created' | 'existing'; lead_ids: string[] }

export default function CreateBandOpportunity({ tenantId, students, onClose }: { tenantId: string; students: Student[]; onClose: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<Result[] | null>(null)
  const create = async () => {
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/contacts/band-opportunities', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, person_ids: students.map(student => student.id) }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not create opportunities.')
      if (!Array.isArray(body.opportunities)) throw new Error('The response could not be verified. Check Opportunities before retrying.')
      setResults(body.opportunities)
      window.dispatchEvent(new Event(LEAD_COUNT_EVENT))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create opportunities.') }
    finally { setSaving(false) }
  }
  return <Modal isOpen onClose={saving ? undefined : onClose} closeOnEscape={!saving} closeOnBackdrop={!saving} ariaLabel="Create Band opportunities">
    <ModalHeader title="Create Band opportunities" onClose={saving ? undefined : onClose} />
    <ModalBody>
      {error && <Notice variant="error">{error}</Notice>}
      {!students.length ? <Notice variant="warning">Select existing students in the Students view first.</Notice> : results ? <>
        <Notice variant="success">Request completed. Existing open opportunities were not duplicated.</Notice>
        <ul>{results.map(row => <li key={row.person_id}>{students.find(student => student.id === row.person_id)?.name || 'Student'}: {row.result === 'created' ? 'Created' : 'Already has an open Band opportunity'}</li>)}</ul>
      </> : <><p>Create one Band service opportunity for each selected student:</p><ul>{students.map(student => <li key={student.id}>{student.name}</li>)}</ul>
        <Notice>Existing open linked Band opportunities will be kept. This does not enroll students or assign them to a band.</Notice></>}
    </ModalBody>
    <ModalFooter><Button variant="secondary" disabled={saving} onClick={onClose}>{results ? 'Close' : 'Cancel'}</Button>
      {!results && <Button disabled={saving || !students.length} onClick={() => void create()}>{saving ? 'Creating…' : 'Create Band opportunities'}</Button>}</ModalFooter>
  </Modal>
}