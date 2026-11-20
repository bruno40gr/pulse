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
import { Avatar } from '@/components/ui/Avatar'
import { DetailField } from '@/components/ui/DetailField'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { PersonName } from '@/components/ui/PersonName'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { LESSON_INSTRUMENT_OPTIONS } from '@/lib/lead-lesson-details'
import { useIsMobile } from '@/lib/useMediaQuery'
import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'
import { spacing } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'

type Member = { person_id: string; name: string; instruments: string[]; membership: string; source: 'enrollment' | 'membership' }
type Band = { name: string; coach: string | null; members: Member[]; status?: string; schedule?: string | null; image_url?: string | null }
type TentativeGroup = { id: string; name: string; member_count?: number; members?: { person_id: string; name: string }[] }
type Candidate = { id: string; name: string }
type LoadState = 'loading' | 'ready' | 'error'
type Row = { key: string; name: string; status: 'Active' | 'Forming'; members: number; coach: string | null; band?: Band }
type Status = 'draft' | 'active' | 'forming' | 'external' | 'archived'

const tenantQuery = () => `tenant=${encodeURIComponent(getActiveTenantId())}`
const COMING_SOON = ['scheduling', 'notes', 'curriculum', 'communications'] as const
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', active: 'Active', forming: 'Forming', external: 'Rehearsal client', archived: 'Archived' }
const MEMBERSHIP_LABEL: Record<string, string> = { confirmed: 'Confirmed', pending: 'Pending', prospect: 'Prospect' }

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
  const [prospects, setProspects] = useState<Candidate[]>([])
  const [pickedProspects, setPickedProspects] = useState<string[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [addQuery, setAddQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<Member | null>(null)
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

  const formingBand = (group: TentativeGroup): Band => ({
    name: group.name,
    coach: null,
    status: 'forming',
    members: (group.members || []).map(member => ({ person_id: member.person_id, name: member.name, instruments: [], membership: 'prospect', source: 'membership' as const })),
  })

  const allBands = [...bands, ...tentative.map(formingBand)]
  const band = opened ? allBands.find(row => row.name === opened) : undefined
  // Every band opens its panel: a forming band is still a band.
  const rows: Row[] = [
    ...bands.map(row => ({ key: row.name, name: row.name, status: 'Active' as const, members: row.members.length, coach: row.coach, band: row })),
    ...tentative.map(group => ({ key: `forming:${group.id}`, name: group.name, status: 'Forming' as const, members: group.member_count ?? 0, coach: null, band: formingBand(group) })),
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

  const createDraft = async () => {
    const taken = new Set([...bands.map(row => row.name.toLowerCase()), ...tentative.map(row => row.name.toLowerCase())])
    let name = 'New band'
    for (let index = 2; taken.has(name.toLowerCase()); index += 1) name = `New band ${index}`
    if (!(await mutate('PATCH', '/api/bands/profile', { band: name, name, status: 'draft' }, true))) return
    setDraft({ name, schedule: '', image_url: '', status: 'draft' })
    setOpened(name)
    setEditing(true)
  }

  const openEdit = () => {
    if (!band) return
    setDraft({ name: band.name, schedule: band.schedule || '', image_url: band.image_url || '', status: (band.status as Status) || 'active' })
    setError(''); setEditing(true)
  }

  const openAdd = async () => {
    setAdding(true); setPicked([]); setPickedProspects([]); setAddQuery(''); setError('')
    const existing = new Set((band?.members || []).map(member => member.person_id))
    try {
      const [contactsResponse, prospectResponse] = await Promise.all([
        fetch(`/api/contacts?${tenantQuery()}`, { cache: 'no-store' }),
        fetch(`/api/bands/candidates?${tenantQuery()}`, { cache: 'no-store' }),
      ])
      const contacts = contactsResponse.ok ? await contactsResponse.json() : null
      if (!Array.isArray(contacts)) throw new Error('Could not load contacts.')
      setCandidates(contacts.filter((person: { id: string }) => !existing.has(person.id))
        .map((person: { id: string; first_name: string; last_name: string }) => ({ id: person.id, name: `${person.first_name} ${person.last_name}`.trim() }))
        .filter((person: Candidate) => person.name))
      const pool = prospectResponse.ok ? await prospectResponse.json() : null
      setProspects(Array.isArray(pool?.prospects)
        ? pool.prospects.filter((person: { person_id: string }) => !existing.has(person.person_id)).map((person: { person_id: string; name: string }) => ({ id: person.person_id, name: person.name }))
        : [])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load contacts.') }
  }

  return <PageContainer>
    <PageHeader title="BandOS" right={<Button onClick={() => void createDraft()} disabled={saving}>Create new band</Button>} />
    <Tabs ariaLabel="Bands workspace" items={[{ key: 'bands', label: 'BandOS' }, { key: 'matching', label: 'Students seeking a band' }]} activeKey={view} onChange={setView} />
    {view === 'matching' ? <LeadsView matching /> : <>
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
    </>}
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
        {panelTab === 'details' ? <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.lg }}>
            <Avatar firstName={band.name} lastName="" src={band.image_url || undefined} size={64} />
            <div style={{ flex: 1, minWidth: 0 }}>
            <FieldGrid columns={2}>
              <DetailField label="Status" value={STATUS_LABEL[band.status || 'active'] || band.status} />
              <DetailField label="Instructor" value={band.coach || 'Unassigned'} />
              <DetailField label="Rehearsal" value={band.schedule || 'Not scheduled'} />
              <DetailField label="Members" value={String(band.members.length)} />
            </FieldGrid>
            </div>
          </div>
        </div> : panelTab === 'members' ? <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={() => void openAdd()} disabled={saving}>Add students</Button></div>
          <ResponsiveDataTable rows={band.members} getRowKey={row => row.person_id} ariaLabel="Band members" minDesktopWidth={560} emptyContent="No members yet." columns={[
            { id: 'name', header: 'Student', width: '1.2fr', render: row => <PersonName>{row.name}</PersonName> },
            { id: 'instrument', header: 'Instruments', width: '1.3fr', render: row => (
              <Select multiple size={3} aria-label={`Instruments for ${row.name}`} value={row.instruments} disabled={saving}
                onChange={event => void mutate('PATCH', '/api/bands/members', { band: band.name, person_id: row.person_id, instruments: Array.from(event.target.selectedOptions, option => option.value) })}>
                {[...new Set([...LESSON_INSTRUMENT_OPTIONS, ...row.instruments])].map(option => <option key={option} value={option}>{option}</option>)}
              </Select>) },
            { id: 'membership', header: 'Membership', width: '.8fr', render: row => band.status === 'forming' ? 'Prospect' : (MEMBERSHIP_LABEL[row.membership] || row.membership) },
            { id: 'menu', header: '', width: '56px', render: row => (
              <OverflowMenu label={`Actions for ${row.name}`} items={[
                ...(band.status === 'forming' || row.membership !== 'confirmed' ? [
                  { label: 'Enroll student', onSelect: () => void mutate('PATCH', '/api/bands/members', { band: band.name, person_id: row.person_id, membership: 'confirmed' }) },
                  { label: 'Request enrollment', onSelect: () => void mutate('PATCH', '/api/bands/members', { band: band.name, person_id: row.person_id, membership: 'pending' }) },
                ] : []),
                ...(band.status === 'forming' ? [] : [{ label: 'Remove from band', onSelect: () => setRemoving(row) }]),
              ]} />) },
          ]} />
        </> : <Notice>Coming soon.</Notice>}
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
      <ModalBody style={{ display: 'grid', gap: spacing.lg }}>
        <Input label="Search contacts" placeholder="Name or email" value={addQuery} onChange={event => setAddQuery(event.target.value)} />
        <div>
          <strong>Students seeking a band</strong>
          {!prospects.length ? <Notice>No student is currently seeking a band.</Notice>
            : prospects.filter(candidate => candidate.name.toLowerCase().includes(addQuery.trim().toLowerCase())).map(candidate => <Checkbox key={candidate.id} label={candidate.name} checked={pickedProspects.includes(candidate.id)}
                onChange={event => setPickedProspects(current => event.target.checked ? [...current, candidate.id] : current.filter(id => id !== candidate.id))} />)}
        </div>
        <div>
          <strong>Contacts</strong>
          {!candidates.length ? <Notice>Everyone in Contacts is already in this band.</Notice>
            : candidates.filter(candidate => candidate.name.toLowerCase().includes(addQuery.trim().toLowerCase())).map(candidate => <Checkbox key={candidate.id} label={candidate.name} checked={picked.includes(candidate.id)}
                onChange={event => setPicked(current => event.target.checked ? [...current, candidate.id] : current.filter(id => id !== candidate.id))} />)}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={() => setAdding(false)} disabled={saving}>Cancel</Button>
        <Button disabled={saving || (!picked.length && !pickedProspects.length)} onClick={async () => {
          for (const personId of pickedProspects) { if (!(await mutate('POST', '/api/bands/members', { band: band.name, person_id: personId, membership: 'prospect' }))) return }
          for (const personId of picked) { if (!(await mutate('POST', '/api/bands/members', { band: band.name, person_id: personId, membership: 'confirmed' }))) return }
          setAdding(false)
        }}>{saving ? 'Adding…' : 'Add to band'}</Button>
      </ModalFooter>
    </Modal>}
    {removing && band && <Modal isOpen onClose={() => setRemoving(null)} ariaLabel="Remove from band">
      <ModalHeader title="Remove from band" onClose={() => setRemoving(null)} />
      <ModalBody>
        <p>Remove {removing.name} from {band.name}? This ends their band enrolment for this band.</p>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={() => setRemoving(null)} disabled={saving}>Cancel</Button>
        <Button disabled={saving} onClick={async () => {
          if (await mutate('DELETE', '/api/bands/members', { band: band.name, person_id: removing.person_id })) setRemoving(null)
        }}>{saving ? 'Removing…' : 'Remove'}</Button>
      </ModalFooter>
    </Modal>}
  </PageContainer>
}
