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
import { PersonName } from '@/components/ui/PersonName'
import { Select } from '@/components/ui/Select'
import { LESSON_INSTRUMENT_OPTIONS } from '@/lib/lead-lesson-details'
import { useIsMobile } from '@/lib/useMediaQuery'
import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'
import { spacing } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'

type Member = { person_id: string; name: string; instrument: string | null; membership: string }
type Band = { name: string; coach: string | null; members: Member[] }
type TentativeGroup = { id: string; name: string; member_count?: number }
type Candidate = { id: string; name: string }
type LoadState = 'loading' | 'ready' | 'error'

const tenantQuery = () => `tenant=${encodeURIComponent(getActiveTenantId())}`

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

  const mutate = async (method: 'POST' | 'PATCH' | 'DELETE', payload: Record<string, unknown>) => {
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/bands/members', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, tenant_id: getActiveTenantId() }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save that change.')
      reload()
      return true
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save that change.'); return false }
    finally { setSaving(false) }
  }

  const openAdd = async () => {
    setAdding(true); setPicked([]); setError('')
    try {
      const response = await fetch(`/api/contacts?${tenantQuery()}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok || !Array.isArray(data)) throw new Error('Could not load students.')
      const existing = new Set((band?.members || []).map(member => member.person_id))
      setCandidates(data.filter((person: { is_student?: boolean; id: string }) => person.is_student && !existing.has(person.id))
        .map((person: { id: string; first_name: string; last_name: string }) => ({ id: person.id, name: `${person.first_name} ${person.last_name}`.trim() })))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load students.') }
  }

  return <PageContainer>
    <PageHeader title="Bands & ensembles" />
    <Tabs ariaLabel="Bands workspace" items={[{ key: 'bands', label: 'Bands & ensembles' }, { key: 'matching', label: 'Students seeking a band' }]} activeKey={view} onChange={setView} />
    {view === 'matching' ? <LeadsView matching /> : <>
      <DenseSectionPanel title="Bands & ensembles">
        {bandsState === 'error' ? <Notice variant="error">Could not load the band roster. Reload before making changes.</Notice>
          : bandsState === 'loading' ? <p role="status">Loading bands…</p>
            : <ResponsiveDataTable rows={bands} getRowKey={row => row.name} ariaLabel="Bands" minDesktopWidth={460} emptyContent="No bands have enrolled members yet." columns={[
              { id: 'name', header: 'Band', width: '1.4fr', render: row => <PersonName as="button" onClick={() => setOpened(row.name)}>{row.name}</PersonName> },
              { id: 'members', header: 'Members', width: '.8fr', render: row => `${row.members.length} ${row.members.length === 1 ? 'member' : 'members'}` },
              { id: 'coach', header: 'Teacher / staff', width: '1fr', render: row => row.coach || 'Unassigned' },
            ]} />}
      </DenseSectionPanel>
      <DenseSectionPanel title="Tentative bands">
        {tentativeState === 'error' ? <Notice variant="error">Could not load tentative bands. The band roster above is unaffected.</Notice>
          : tentativeState === 'loading' ? <p role="status">Loading tentative bands…</p>
            : <ResponsiveDataTable rows={tentative} getRowKey={row => row.id} ariaLabel="Tentative bands" minDesktopWidth={400} emptyContent="No tentative bands yet." columns={[
              { id: 'name', header: 'Tentative band', width: '1.2fr', render: row => row.name },
              { id: 'members', header: 'Candidates', width: '.6fr', render: row => row.member_count ?? 0 },
            ]} />}
      </DenseSectionPanel>
    </>}
    {band && <SlidePanel isOpen onClose={() => setOpened(null)} fullScreen={mobile} width={PROFILE_PANEL_WIDTH}>
      <SlidePanelHeader title={band.name} subtitle={`${band.members.length} ${band.members.length === 1 ? 'member' : 'members'}${band.coach ? ` · Coach ${band.coach}` : ''}`} onClose={() => setOpened(null)} />
      <div style={{ padding: spacing.lg, overflowY: 'auto', minHeight: 0, display: 'grid', gap: spacing.lg }}>
        {error && <Notice variant="error">{error}</Notice>}
        <DenseSectionPanel title="Members" actions={<Button onClick={() => void openAdd()} disabled={saving}>Add students</Button>}>
          <ResponsiveDataTable rows={band.members} getRowKey={row => row.person_id} ariaLabel="Band members" minDesktopWidth={520} emptyContent="No members yet." columns={[
            { id: 'name', header: 'Student', width: '1.2fr', render: row => <PersonName>{row.name}</PersonName> },
            { id: 'instrument', header: 'Instrument', width: '1fr', render: row => <Select aria-label={`Instrument for ${row.name}`} value={row.instrument || ''} disabled={saving}
              onChange={event => void mutate('PATCH', { band: band.name, person_id: row.person_id, instrument: event.target.value })}>
              <option value="">Not set</option>
              {[...new Set([...LESSON_INSTRUMENT_OPTIONS, ...(row.instrument ? [row.instrument] : [])])].map(option => <option key={option} value={option}>{option}</option>)}
            </Select> },
            { id: 'membership', header: 'Membership', width: '.8fr', render: row => row.membership === 'confirmed' ? 'Confirmed' : 'Pending' },
            { id: 'remove', header: '', width: '110px', render: row => <Button variant="ghost" disabled={saving} onClick={() => void mutate('DELETE', { band: band.name, person_id: row.person_id })}>Remove</Button> },
          ]} />
        </DenseSectionPanel>
      </div>
    </SlidePanel>}
    {adding && band && <Modal isOpen onClose={() => setAdding(false)} ariaLabel="Add students">
      <ModalHeader title={`Add students to ${band.name}`} onClose={() => setAdding(false)} />
      <ModalBody>
        {!candidates.length ? <Notice>Every current student is already in this band.</Notice>
          : candidates.map(candidate => <Checkbox key={candidate.id} label={candidate.name} checked={picked.includes(candidate.id)}
              onChange={event => setPicked(current => event.target.checked ? [...current, candidate.id] : current.filter(id => id !== candidate.id))} />)}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={() => setAdding(false)} disabled={saving}>Cancel</Button>
        <Button disabled={saving || !picked.length} onClick={async () => {
          for (const personId of picked) { if (!(await mutate('POST', { band: band.name, person_id: personId }))) return }
          setAdding(false)
        }}>{saving ? 'Adding…' : 'Add to band'}</Button>
      </ModalFooter>
    </Modal>}
  </PageContainer>
}
