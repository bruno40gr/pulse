'use client'

import { useCallback, useEffect, useState } from 'react'
import { RichDataTable } from '@/components/ui/RichDataTable'
import { useTablePreferences } from '@/components/ui/TableDisplayControls'
import { TableSearchControl, TableResultCount } from '@/components/ui/TableWorkspaceControls'
import LeadsView from '@/components/leads/LeadsView'
import { CreateBandWizard } from '@/components/bands/CreateBandWizard'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { Notice } from '@/components/ui/Notice'
import { ResponsiveDataTable } from '@/components/ui/DataGridTable'
import { Modal, ModalBody, ModalFooter, ModalHeader, SlidePanel, SlidePanelHeader } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { BandStudentPicker } from '@/components/bands/BandStudentPicker'
import BandNotes from '@/components/bands/BandNotes'
import BandCommunications from '@/components/bands/BandCommunications'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { SlidePanelContent } from '@/components/ui/SlidePanelContent'
import { SlidePanelActionBar } from '@/components/ui/SlidePanelActionBar'
import { Mail, MessageSquare, Pencil } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { OverflowMenu } from '@/components/ui/OverflowMenu'
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
import type { BandCreationDraft } from '@/lib/band-creation-draft'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'

type Member = { person_id: string; name: string; instruments: string[]; membership: string; source: 'enrollment' | 'membership' }
type Band = { name: string; coach: string | null; members: Member[]; status?: string; description?: string | null; schedule?: string | null; image_url?: string | null }
type TentativeGroup = { id: string; name: string; member_count?: number; members?: { person_id: string; name: string }[] }
type Candidate = { id: string; name: string; detail?: string }
type LoadState = 'loading' | 'ready' | 'error'
type Row = { key: string; name: string; status: 'Active' | 'Forming'; members: number; coach: string | null; band?: Band }
type Status = 'draft' | 'active' | 'forming' | 'external' | 'archived'

const BAND_TABLE_SCHEMA = { columnIds: ['name', 'status', 'members', 'coach'], defaultColumns: ['name', 'status', 'members', 'coach'], requiredColumns: ['name'], storagePrefix: 'pulse-band-table' } as const

const tenantQuery = () => `tenant=${encodeURIComponent(getActiveTenantId())}`
const COMING_SOON = ['scheduling', 'curriculum'] as const
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
  const tablePreferences = useTablePreferences(BAND_TABLE_SCHEMA)
  const [bandSearch, setBandSearch] = useState('')
  const [bandQuery, setBandQuery] = useState('')
  const [view, setView] = useState<'bands' | 'matching'>('bands')
  const [creationDrafts, setCreationDrafts] = useState<{ id: string; revision: number; state: BandCreationDraft }[]>([])
  const [draftState, setDraftState] = useState<LoadState>('loading')
  const [resumeDraft, setResumeDraft] = useState<{ revision: number; state: BandCreationDraft } | undefined>()
  const [bands, setBands] = useState<Band[]>([])
  const [tentative, setTentative] = useState<TentativeGroup[]>([])
  const [bandsState, setBandsState] = useState<LoadState>('loading')
  const [tentativeState, setTentativeState] = useState<LoadState>('loading')
  const [opened, setOpened] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState<string>('details')
  const [communicationChannel, setCommunicationChannel] = useState<'sms' | 'email'>('sms')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: '', schedule: '', image_url: '', status: 'active' as Status })
  const [adding, setAdding] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [prospects, setProspects] = useState<Candidate[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [candidateState, setCandidateState] = useState<LoadState>('loading')
  const [candidateError, setCandidateError] = useState('')
  const [creatingStudent, setCreatingStudent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<Member | null>(null)
  const [creating, setCreating] = useState(false)
  const mobile = useIsMobile()

  const load = useCallback((signal: AbortSignal) => {
    setDraftState('loading')
    void readList<{ id: string; revision: number; state: BandCreationDraft }>(`/api/bands/drafts?${tenantQuery()}`, 'drafts', signal)
      .then(rows => { if (!signal.aborted) { setCreationDrafts(rows); setDraftState('ready') } })
      .catch(() => { if (!signal.aborted) setDraftState('error') })
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
    ...bands.map(row => ({ key: row.name, name: row.name, status: row.status === 'forming' || row.status === 'draft' ? 'Forming' as const : 'Active' as const, members: row.members.length, coach: row.coach, band: row })),
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

  const openEdit = () => {
    if (!band) return
    setDraft({ name: band.name, schedule: band.schedule || '', image_url: band.image_url || '', status: (band.status as Status) || 'active' })
    setError(''); setEditing(true)
  }

  const openAdd = async () => {
    setCandidateState('loading'); setCandidateError(''); setCandidates([]); setProspects([]); setAdding(true); setPicked([]); setError('')
    const existing = new Set((band?.members || []).map(member => member.person_id))
    try {
      const [contactsResponse, prospectResponse] = await Promise.all([
        fetch(`/api/contacts?${tenantQuery()}`, { cache: 'no-store' }),
        fetch(`/api/bands/candidates?${tenantQuery()}`, { cache: 'no-store' }),
      ])
      const contacts = contactsResponse.ok ? await contactsResponse.json() : null
      if (!Array.isArray(contacts)) throw new Error('Could not load contacts.')
      setCandidates(contacts.filter((person: { id: string }) => !existing.has(person.id))
        .map((person: { id: string; first_name?: string; last_name?: string; email?: string }) => ({ id: person.id, name: `${person.first_name || ''} ${person.last_name || ''}`.trim(), detail: person.email || '' }))
        .filter((person: Candidate) => person.name))
      const pool = prospectResponse.ok ? await prospectResponse.json() : null
      if (!Array.isArray(pool?.prospects)) throw new Error('Could not load students seeking a band.')
      setProspects(Array.isArray(pool?.prospects)
        ? pool.prospects.filter((person: { person_id: string }) => !existing.has(person.person_id)).map((person: { person_id: string; name: string }) => ({ id: person.person_id, name: person.name }))
        : [])
      setCandidateState('ready')
    } catch (cause) { setCandidateState('error'); setCandidateError(cause instanceof Error ? cause.message : 'Could not load contacts.') }
  }

  if (creating) return <CreateBandWizard initialDraft={resumeDraft} onClose={() => { setCreating(false); setResumeDraft(undefined); reload() }} onCreated={name => { setCreating(false); setResumeDraft(undefined); setOpened(name); reload() }} />

  return <PageContainer>
    <PageHeader title="BandOS" right={<Button onClick={() => setCreating(true)} disabled={saving || draftState !== 'ready'}>Create new band</Button>} />
    <Tabs style={{ marginBottom: spacing.lg }} ariaLabel="Bands workspace" items={[{ key: 'bands', label: 'BandOS' }, { key: 'matching', label: 'Students seeking a band' }]} activeKey={view} onChange={setView} />
    {view === 'matching' ? <LeadsView matching /> : <>
      {draftState === 'loading' || tentativeState === 'loading' || bandsState === 'loading' ? <LoadingSkeleton label="Loading bands and drafts" rows={5} /> : <>
      {draftState === 'error' && <Notice variant="error">Band drafts could not be loaded. Check the band drafts migration before creating a band.</Notice>}
      {draftState === 'ready' && creationDrafts.length > 0 && <DenseSectionPanel title="Band drafts" headingLevel="h2">
        <ResponsiveDataTable rows={creationDrafts} getRowKey={row => row.id} ariaLabel="Band drafts" minDesktopWidth={500} emptyContent="No band drafts." columns={[
          { id: 'name', header: 'Name', width: '2fr', render: row => <PersonName as="button" onClick={() => { setResumeDraft(row); setCreating(true) }}>{row.state.data.name || 'Unnamed group'}</PersonName> },
          { id: 'progress', header: 'Progress', width: '1fr', render: row => `${row.state.reviewedSteps.length} / 2 complete` },
          { id: 'actions', header: 'Actions', width: '1fr', render: row => <Button variant="secondary" onClick={() => { setResumeDraft(row); setCreating(true) }}>Continue</Button> },
        ]} />
      </DenseSectionPanel>}
      {bandsState === 'error' ? <Notice variant="error">Could not load the band roster. Reload before making changes.</Notice>
        : <>
          {tentativeState === 'error' && <Notice variant="warning">Forming bands could not be loaded. Active bands are unaffected.</Notice>}
          <RichDataTable preferenceSchema={BAND_TABLE_SCHEMA} preferenceState={tablePreferences}
            search={<TableSearchControl label="Search bands" placeholder="Search bands or teachers" value={bandSearch} onChange={setBandSearch} onSearch={() => setBandQuery(bandSearch)} onClear={() => { setBandSearch(''); setBandQuery('') }} />}
            beforeTable={<TableResultCount>{rows.filter(row => `${row.name} ${row.coach || ''} ${row.status}`.toLowerCase().includes(bandQuery.trim().toLowerCase())).length} bands</TableResultCount>}
            rows={rows.filter(row => `${row.name} ${row.coach || ''} ${row.status}`.toLowerCase().includes(bandQuery.trim().toLowerCase()))} getRowKey={row => row.key} ariaLabel="Bands" emptyContent="No bands yet." columns={[
            { id: 'name', header: 'Group', width: 'minmax(220px, 1.5fr)', render: row => row.band
              ? <PersonName as="button" onClick={() => { setPanelTab('details'); setOpened(row.name) }}>{row.name}</PersonName>
              : <PersonName>{row.name}</PersonName> },
            { id: 'status', header: 'Status', width: 'minmax(120px, .8fr)', render: row => row.status },
            { id: 'members', header: 'Members', width: 'minmax(300px, 1.3fr)', render: row => row.band ? `${row.band.members.filter(member => member.membership === 'confirmed').length} confirmed · ${row.band.members.filter(member => member.membership === 'pending').length} pending · ${row.band.members.filter(member => member.membership === 'prospect').length} prospects` : `${row.members}` },
            { id: 'coach', header: 'Teacher / staff', width: 'minmax(180px, 1fr)', render: row => row.coach || 'Unassigned' },
          ]} />
        </>}
    </>}
    </>}
    {band && <SlidePanel isOpen onClose={() => setOpened(null)} fullScreen={mobile} width={PROFILE_PANEL_WIDTH}>
      <SlidePanelHeader title={band.name}
        avatar={{ firstName: band.name, lastName: '', src: band.image_url || undefined, size: 48 }}
        subtitle={`${band.members.length} ${band.members.length === 1 ? 'member' : 'members'}${band.coach ? ` · Coach ${band.coach}` : ''}`}
        onClose={() => setOpened(null)} />
      <SlidePanelActionBar isMobile={mobile}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button variant="secondary" onClick={() => { setCommunicationChannel('sms'); setPanelTab('communications') }}><MessageSquare size={14} />Send SMS</Button>
          <Button variant="secondary" onClick={() => { setCommunicationChannel('email'); setPanelTab('communications') }}><Mail size={14} />Send email</Button>
        </div>
        <div style={{ marginLeft: mobile ? 0 : 'auto' }}><Button variant="ghost" onClick={openEdit} disabled={saving}><Pencil size={14} />Edit band</Button></div>
      </SlidePanelActionBar>
      <div style={{ overflowX: 'auto', flexShrink: 0, paddingInline: mobile ? spacing.lg : spacing.xl }}>
        <Tabs ariaLabel="Band sections" items={[
          { key: 'details', label: 'Details' },
          { key: 'members', label: 'Members' },
          { key: 'notes', label: 'Notes' },
          ...COMING_SOON.map(key => ({ key, label: key[0].toUpperCase() + key.slice(1) })),
          { key: 'communications', label: 'Communications' },
        ]} activeKey={panelTab} onChange={setPanelTab} style={{ width: 'max-content', minWidth: '100%' }} />
      </div>
      <SlidePanelContent>
        {error && <Notice variant="error">{error}</Notice>}
        {panelTab === 'details' ? <DenseSectionPanel title="Band details" actions={<Button variant="secondary" size="sm" onClick={openEdit}>Edit details</Button>}>
            <FieldGrid columns={2}>
              <DetailField label="Status" value={STATUS_LABEL[band.status || 'active'] || band.status} />
              <DetailField label="Description" value={band.description || 'Not added'} />
              <DetailField label="Instructor" value={band.coach || 'Unassigned'} />
              <DetailField label="Rehearsal" value={band.schedule || 'Not scheduled'} />
              <DetailField label="Members" value={String(band.members.length)} />
            </FieldGrid>
        </DenseSectionPanel> : panelTab === 'members' ? <DenseSectionPanel title={`Members (${band.members.length})`} actions={<Button onClick={() => void openAdd()} disabled={saving}>Add students</Button>}>
          <ResponsiveDataTable style={{ border: 'none', borderRadius: 0 }} rows={band.members} getRowKey={row => row.person_id} ariaLabel="Band members" minDesktopWidth={560} emptyContent="No members yet." columns={[
            { id: 'name', header: 'Student', width: '1.2fr', render: row => <PersonName>{row.name}</PersonName> },
            { id: 'instrument', header: 'Instruments', width: '1.3fr', render: row => (
              <MultiSelect label="" ariaLabel={`Instruments for ${row.name}`} appearance="subtle" menuMinWidth={220} disabled={saving}
                value={row.instruments}
                options={[...new Set([...LESSON_INSTRUMENT_OPTIONS, ...row.instruments])].map(option => ({ value: option, label: option }))}
                onChange={next => void mutate('PATCH', '/api/bands/members', { band: band.name, person_id: row.person_id, instruments: next })} />) },
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
        </DenseSectionPanel> : panelTab === 'notes' ? <DenseSectionPanel>
          <BandNotes key={`${getActiveTenantId()}:${band.name}`} bandName={band.name} />
        </DenseSectionPanel> : panelTab === 'communications' ? <BandCommunications key={`${band.name}:${communicationChannel}`} bandName={band.name} members={band.members} initialChannel={communicationChannel} />
          : <DenseSectionPanel title={panelTab === 'scheduling' ? 'Scheduling' : 'Curriculum'}><Notice>{panelTab === 'scheduling' ? 'Band scheduling is coming soon. Rehearsal information is available in Details.' : 'Band curriculum is coming soon.'}</Notice></DenseSectionPanel>}
      </SlidePanelContent>
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
    {adding && band && <Modal isOpen layout="fixed" size="lg" onClose={() => { if (!saving && !creatingStudent) setAdding(false) }} ariaLabel="Add students">
      <ModalHeader title={`Add students to ${band.name}`} onClose={() => { if (!saving && !creatingStudent) setAdding(false) }} />
      <ModalBody>
        <BandStudentPicker options={[
          ...prospects.map(person => ({ ...person, detail: candidates.find(candidate => candidate.id === person.id)?.detail, group: 'Seeking a band' })),
          ...candidates.filter(person => !prospects.some(prospect => prospect.id === person.id)),
        ]} selectedIds={picked} onSelectionChange={setPicked} state={candidateState} error={candidateError}
          disabled={saving} onBusyChange={setCreatingStudent}
          onCreated={person => { setCandidates(current => [...current, person]); setPicked(current => [...current, person.id]) }} />
        {candidateState === 'error' && <Button variant="secondary" onClick={() => void openAdd()}>Try again</Button>}
        {error && <Notice variant="error">{error}</Notice>}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={() => setAdding(false)} disabled={saving || creatingStudent}>Cancel</Button>
        <Button disabled={saving || creatingStudent || candidateState !== 'ready' || !picked.length} onClick={async () => {
          // Save once before refreshing: a reload must not unmount this dialog mid-batch.
          setSaving(true); setError('')
          try {
            for (const personId of picked) {
              const response = await fetch('/api/bands/members', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: getActiveTenantId(), band: band.name, person_id: personId, membership: prospects.some(person => person.id === personId) ? 'prospect' : 'confirmed' }) })
              const data = await response.json().catch(() => null)
              if (!response.ok) throw new Error(data?.error || 'Could not add that student.')
              setPicked(current => current.filter(id => id !== personId))
            }
            setAdding(false); reload()
          } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add students.') }
          finally { setSaving(false) }
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
