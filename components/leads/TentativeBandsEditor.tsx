'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Notice } from '@/components/ui/Notice'
import { Input } from '@/components/ui/Input'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal'

type Group = { id: string; name: string }
export default function TentativeBandsEditor({ tenantId, leadId, onClose, onSaved }: { tenantId: string; leadId: string; onClose: () => void; onSaved: () => void }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const [newName, setNewName] = useState('')
  useEffect(() => {
    const controller = new AbortController(), tenant = encodeURIComponent(tenantId)
    void Promise.all([
      fetch(`/api/leads/tentative-bands/groups?tenant=${tenant}`, { signal: controller.signal, cache: 'no-store' }),
      fetch(`/api/leads/tentative-bands?tenant=${tenant}&lead_id=${encodeURIComponent(leadId)}`, { signal: controller.signal, cache: 'no-store' }),
    ]).then(async ([groupResponse, linkResponse]) => {
      if (!groupResponse.ok || !linkResponse.ok) throw new Error('Could not load tentative bands.')
      const [groupData, linkData] = await Promise.all([groupResponse.json(), linkResponse.json()])
      if (!Array.isArray(groupData.groups) || !Array.isArray(linkData.associations)) throw new Error('Could not verify tentative bands.')
      const ids = new Set(groupData.groups.map((group: Group) => group.id))
      if (linkData.associations.some((item: { lead_id: string; band_id: string }) => item.lead_id !== leadId || !ids.has(item.band_id))) throw new Error('Could not verify tentative bands.')
      if (!controller.signal.aborted) { setGroups(groupData.groups); setSelected(linkData.associations.map((item: { band_id: string }) => item.band_id)); setLoading(false) }
    }).catch(() => { if (!controller.signal.aborted) { setError('Could not load tentative bands. No changes were made.'); setLoadFailed(true); setLoading(false) } })
    return () => controller.abort()
  }, [leadId, tenantId])
  const save = async () => {
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/leads/tentative-bands', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tenantId, lead_id: leadId, band_ids: selected }) })
      const data = await response.json()
      if (!response.ok || data.saved !== selected.length) throw new Error('Could not confirm the update. Reload before retrying.')
      onSaved(); onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update tentative bands.') }
    finally { setSaving(false) }
  }
  const createGroup = async () => {
    if (!newName.trim()) return
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/leads/tentative-bands/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tenantId, name: newName.trim() }) })
      const data = await response.json()
      if (!response.ok || typeof data.group?.id !== 'string' || typeof data.group?.name !== 'string') throw new Error(data.error || 'Could not create the tentative band. Check the list before retrying.')
      setGroups(current => [...current, data.group]); setSelected(current => [...current, data.group.id]); setNewName('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create the tentative band.') }
    finally { setSaving(false) }
  }
  return <Modal isOpen onClose={saving ? undefined : onClose} closeOnEscape={!saving} closeOnBackdrop={!saving} ariaLabel="Edit tentative bands">
    <ModalHeader title="Edit tentative bands" onClose={saving ? undefined : onClose} />
    <ModalBody>{error && <Notice variant="error">{error}</Notice>}{loading ? <p role="status">Loading…</p> : !loadFailed && <>
      <p>Select any tentative bands. This does not enroll the student.</p>
      {!groups.length && <Notice>No tentative bands are available yet.</Notice>}
      {groups.map(group => <Checkbox key={group.id} label={group.name} checked={selected.includes(group.id)} onChange={event => setSelected(current => event.target.checked ? [...current, group.id] : current.filter(id => id !== group.id))} />)}
      <Input label="New tentative band name" value={newName} onChange={event => setNewName(event.target.value)} maxLength={200} disabled={saving} />
      <Button variant="secondary" onClick={() => void createGroup()} disabled={saving || !newName.trim()}>Create tentative band</Button>
    </>}</ModalBody>
    <ModalFooter><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={() => void save()} disabled={loading || saving || loadFailed}>{saving ? 'Saving…' : 'Save'}</Button></ModalFooter>
  </Modal>
}