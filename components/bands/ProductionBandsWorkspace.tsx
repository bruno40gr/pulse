'use client'

import { useCallback, useEffect, useState } from 'react'
import LeadsView from '@/components/leads/LeadsView'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { Notice } from '@/components/ui/Notice'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { ResponsiveDataTable } from '@/components/ui/DataGridTable'
import { Modal, ModalBody, ModalFooter, ModalHeader, SlidePanel, SlidePanelHeader } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { ControlButton } from '@/components/ui/ControlButton'
import { Input } from '@/components/ui/Input'
import { OverflowMenu } from '@/components/ui/OverflowMenu'
import { PersonName } from '@/components/ui/PersonName'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { LESSON_INSTRUMENT_OPTIONS } from '@/lib/lead-lesson-details'
import { useIsMobile } from '@/lib/useMediaQuery'
import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'
import { spacing } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'

type Member = { person_id: string; name: string; instrument: string | null; membership: string }
type Band = { name: string; coach: string | null; members: Member[]; status?: string; schedule?: string | null; image_url?: string | null }
type TentativeGroup = { id: string; name: string; member_count?: number }
type Candidate = { id: string; name: string }
type LoadState = 'loading' | 'ready' | 'error'
type Row = { key: string; name: string; status: 'Active' | 'Forming'; members: number; coach: string | null; band?: Band }
type Status = 'active' | 'forming' | 'external' | 'archived'

const tenantQuery = () => `tenant=${encodeURIComponent(getActiveTenantId())}`
const COMING_SOON = ['scheduling', 'notes', 'curriculum', 'communications'] as const
const STATUS_LABEL: Record<string, string> = { active: 'Active', forming: 'Forming', external: 'Rehearsal client', archived: 'Archived' }

async function readList<T>(url: string, key: string, signal: AbortSignal): Promise<T[]> {
  const response = await fetch(url, { cache: 'no-store', signal })
  if (!response.ok) throw new Error('Unavailable')
  const data = await response.json()
  if (!Array.isArray(data?.[key])) throw new Error('Invalid response')
  return data[key] as T[]
}

export default function ProductionBandsWorkspace() {
  const [view, setView] = useState<'bands' | 'matching'>('bands')
  const [bands, setBands] = useState<Band[]>([])
  const [tentative, setTentative] = useState<TentativeGroup[]>([])
  const [bandsState, setBandsState] = useState<LoadState>('loading')
  const [tentativeState, setTentativeState] = useState<LoadState>('loading')
  const [opened, setOpened] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState<string>('details')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: '', schedule: '', image_url: '', status: 'active' as Status })
  const [adding, setAdding] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const mobile = useIsMobile()

  const load = useCallback((signal: AbortSignal) => {
    setBandsState('loading')
    setTentativeState('loading')
    void readList<Band>(`/api/bands?${tenantQuery()}`, 'bands', signal)
      .then(rows => { if (!signal.aborted) { setBands(rows); setBandsState('ready') } })
      .catch(() => { if (!signal.aborted) { setBands([]); setBandsState('error') } })
    void readList<TentativeGroup>(`/api/leads/tentative-bands/groups?${tenantQuery()}`, 'groups', signal)
      .then(rows => { if (!signal.aborted) { setTentative(rows); setTentativeState('ready') } })
      .catch(() => { if (!signal.aborted) { setTentative([]); setTentativeState('error') } })
  }, [])

  const reload = useCallback(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  useEffect(() => {
    if (view !== 'bands') return
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load, view])

  const band = opened ? bands.find(row => row.name === opened) : undefined
  const rows: Row[] = [
    ...bands.map(row => ({ key: row.name, name: row.name, status: 'Active' as const, members: row.members.length, coach: row.coach, band: row })),
    ...tentative.map(group => ({ key: `forming:${group.id}`, name: group.name, status: 'Forming' as const, members: group.member_count ?? 0, coach: null })),
  ]

  const mutate = async (method: 'POST' | 'PATCH' | 'DELETE', path: string, payload: Record<string, unknown>, quiet = false) => {
    if (!quiet) { setSaving(true); setError('') }
    try {
      const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, tenant_id: getActiveTenantId() }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save that change.')
      reload()
      return true
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save that change.'); return false }
    finally { if (!quiet) setSaving(false) }
  }

  const openEdit = () => {
    if (!band) return
    setDraft({ name: band.name, schedule: band.schedule || '', image_url: band.image_url || '', status: (band.status as Status) || 'active' })
    setError(''); setEditing(true)
  }

  const openAdd = async () => {
    setAdding(true); setPicked([]); setError('')
    try {
      const response = await fetch(`/api/contacts?${tenantQuery()}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok || !Array.isArray(data)) throw new Error('Could not load contacts.')
      const existing = new Set((band?.members || []).map(member => member.person_id))
      setCandidates(data.filter((person: { id: string }) => !existing.has(person.id))
        .map((person: { id: string; first_name: string; last_name: string }) => ({ id: person.id, name: `${person.first_name} ${person.last_name}`.trim() }))
        .filter((person: Candidate) => person.name))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load contacts.') }
  }

  return <PageContainer>
    <PageHeader title="Bands & ensembles" />
    <Tabs ariaLabel="Bands workspace" items={[{ key: 'bands', label: 'Bands & ensembles' }, { key: 'matching', label: 'Students seeking a band' }]} activeKey={view} onChange={setView} />
    {view === 'matching' ? <LeadsView matching /> : <DenseSectionPanel title="Bands & ensembles">
      {bandsState === 'error' ? <Notice variant="error">Could not load the band roster. Reload before making changes.</Notice>
        : bandsState === 'loading' ? <p role="status">Loading bands…</p> : <>
          {tentativeState === 'error' && <Notice variant="warning">Forming bands could not be loaded. Active bands are unaffected.</Notice>}
          <ResponsiveDataTable rows={rows} getRowKey={row => row.key} ariaLabel="Bands" minDesktopWidth={520} emptyContent="No bands yet." columns={[
            { id: 'name', header: 'Group', width: '1.5fr', render: row => row.band
              ? <PersonName as="button" onClick={() => { setPanelTab('details'); setOpened(row.name) }}>{row.name}</PersonName>
              : <PersonName>{row.name}</PersonName> },
            { id: 'status', header: 'Status', width: '.8fr', render: row => row.status },
            { id: 'members', header: 'Members', width: '.7fr', render: row => `${row.members}` },
            { id: 'coach', header: 'Teacher / staff', width: '1fr', render: row => row.coach || 'Unassigned' },
          ]} />
        </>}
    </DenseSectionPanel>}
    {band && <SlidePanel isOpen onClose={() => setOpened(null)} fullScreen={mobile} width={PROFILE_PANEL_WIDTH}>
      <SlidePanelHeader title={band.name}
        subtitle={`${band.members.length} ${band.members.length === 1 ? 'member' : 'members'}${band.coach ? ` · Coach ${band.coach}` : ''}`}
        actions={<Button variant="secondary" onClick={openEdit} disabled={saving}>Edit band</Button>}
        onClose={() => setOpened(null)} />
      <div style={{ overflowX: 'auto', flexShrink: 0 }}>
        <Tabs ariaLabel="Band sections" items={[
          { key: 'details', label: 'Details' },
          { key: 'members', label: 'Members' },
          ...COMING_SOON.map(key => ({ key, label: key[0].toUpperCase() + key.slice(1) })),
        ]} activeKey={panelTab} onChange={setPanelTab} style={{ minWidth: 'max-content' }} />
      </div>
      <div style={{ padding: spacing.lg, overflowY: 'auto', minHeight: 0, display: 'grid', gap: spacing.lg }}>
        {error && <Notice variant="error">{error}</Notice>}
        {panelTab === 'details' ? <DenseSectionPanel title="Details">
          <div style={{ display: 'grid', gap: spacing.lg }}>
            {band.image_url
              ? <img src={band.image_url} alt={`${band.name} logo`} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12 }} />
              : <div role="img" aria-label={`${band.name} has no picture`} style={{ width: 96, height: 96, borderRadius: 12, background: '#EEF2F6', display: 'grid', placeItems: 'center', fontSize: 12, color: '#5B6B7A' }}>No picture</div>}
            <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: `${spacing.sm} ${spacing.xl}`, margin: 0 }}>
              <dt>Status</dt><dd style={{ margin: 0 }}>{STATUS_LABEL[band.status || 'active'] || band.status}</dd>
              <dt>Rehearsal</dt><dd style={{ margin: 0 }}>{band.schedule || 'Not scheduled'}</dd>
              <dt>Instructor</dt><dd style={{ margin: 0 }}>{band.coach || 'Unassigned'}</dd>
              <dt>Members</dt><dd style={{ margin: 0 }}>{band.members.length}</dd>
            </dl>
          </div>
        </DenseSectionPanel> : panelTab === 'members' ? <DenseSectionPanel title="Members" actions={<Button onClick={() => void openAdd()} disabled={saving}>Add students</Button>}>
          <ResponsiveDataTable rows={band.members} getRowKey={row => row.person_id} ariaLabel="Band members" minDesktopWidth={560} emptyContent="No members yet." columns={[
            { id: 'name', header: 'Student', width: '1.2fr', render: row => <PersonName>{row.name}</PersonName> },
            { id: 'instrument', header: 'Instrument', width: '1fr', render: row => <Select aria-label={`Instrument for ${row.name}`} value={row.instrument || ''} disabled={saving}
              onChange={event => void mutate('PATCH', '/api/bands/members', { band: band.name, person_id: row.person_id, instrument: event.target.value })}>
              <option value="">Not set</option>
              {[...new Set([...LESSON_INSTRUMENT_OPTIONS, ...(row.instrument ? [row.instrument] : [])])].map(option => <option key={option} value={option}>{option}</option>)}
            </Select> },
            { id: 'membership', header: 'Membership', width: '.8fr', render: row => row.membership === 'confirmed' ? 'Confirmed' : 'Pending' },
            { id: 'menu', header: '', width: '56px', render: row => (
              <OverflowMenu label={`Actions for ${row.name}`} items={[
                ...(row.membership === 'confirmed' ? [] : [
                  { label: 'Enroll student', onSelect: () => void mutate('POST', '/api/bands/members', { band: band.name, person_id: row.person_id, action: 'enroll' }) },
                  { label: 'Request enrollment', onSelect: () => void mutate('POST', '/api/bands/members', { band: band.name, person_id: row.person_id, action: 'request' }) },
                ]),
                { label: 'Remove from band', onSelect: () => void mutate('DELETE', '/api/bands/members', { band: band.name, person_id: row.person_id }) },
              ]} />) },
          ]} />
        </DenseSectionPanel> : <DenseSectionPanel title={panelTab[0].toUpperCase() + panelTab.slice(1)}>
          <Notice>Coming soon. This band keeps the same records; this section is not available yet.</Notice>
        </DenseSectionPanel>}
      </div>
    </SlidePanel>}
    {editing && band && <Modal isOpen onClose={() => setEditing(false)} ariaLabel="Edit band">
      <ModalHeader title="Edit band" onClose={() => setEditing(false)} />
      <ModalBody style={{ display: 'grid', gap: spacing.lg }}>
        {error && <Notice variant="error">{error}</Notice>}
        <Input label="Band name" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} maxLength={200} />
        <Select label="Status" value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as Status })}>
          <option value="active">Active</option>
          <option value="forming">Forming</option>
          <option value="external">Rehearsal client</option>
          <option value="archived">Archived</option>
        </Select>
        <Textarea label="Rehearsal schedule" value={draft.schedule} onChange={event => setDraft({ ...draft, schedule: event.target.value })}
          placeholder="For example: Tuesdays 6:00–7:00 PM" />
        <Input label="Picture link" type="url" value={draft.image_url} onChange={event => setDraft({ ...draft, image_url: event.target.value })} />
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" disabled={saving} onClick={async () => {
          if (await mutate('DELETE', '/api/bands/profile', { band: band.name }, true)) { setEditing(false); setOpened(null) }
        }}>Delete band</Button>
        <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
        <Button disabled={saving || !draft.name.trim()} onClick={async () => {
          const saved = await mutate('PATCH', '/api/bands/profile', { band: band.name, name: draft.name.trim(), schedule: draft.schedule, image_url: draft.image_url, status: draft.status })
          if (saved) { setEditing(false); setOpened(draft.name.trim()) }
        }}>{saving ? 'Saving…' : 'Save'}</Button>
      </ModalFooter>
    </Modal>}
    {adding && band && <Modal isOpen onClose={() => setAdding(false)} ariaLabel="Add students">
      <ModalHeader title={`Add students to ${band.name}`} onClose={() => setAdding(false)} />
      <ModalBody>
        {!candidates.length ? <Notice>Everyone in Contacts is already in this band.</Notice>
          : candidates.map(candidate => <Checkbox key={candidate.id} label={candidate.name} checked={picked.includes(candidate.id)}
              onChange={event => setPicked(current => event.target.checked ? [...current, candidate.id] : current.filter(id => id !== candidate.id))} />)}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={() => setAdding(false)} disabled={saving}>Cancel</Button>
        <Button disabled={saving || !picked.length} onClick={async () => {
          for (const personId of picked) { if (!(await mutate('POST', '/api/bands/members', { band: band.name, person_id: personId }))) return }
          setAdding(false)
        }}>{saving ? 'Adding…' : 'Add to band'}</Button>
      </ModalFooter>
    </Modal>}
  </PageContainer>
}
