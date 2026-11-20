'use client'

import { useState } from 'react'
import { Button, DenseSectionPanel, Notice, Select, SlidePanel, SlidePanelHeader } from '@/components/ui'
import { ResponsiveDataTable } from '@/components/ui/DataGridTable'
import { PersonName } from '@/components/ui/PersonName'
import { TableContextActionBar, TableResultCount, TableSearchControl } from '@/components/ui/TableWorkspaceControls'
import { spacing } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'
import type { BandReviewData } from '@/lib/band-review-data'
import styles from './explorer.module.css'
import BandSlidePanel from './BandSlidePanel'
import BulkEmailPreview from './BulkEmailPreview'
import type { ExplorerPerson } from '@/beta-source/lib/event-explorer'
import { getActiveTenantId } from '@/lib/tenant'
import type { reconcileBandCandidates } from '@/lib/band-reconciliation'

const noop = () => {}

export default function BandReview({ data, view }: { data: BandReviewData; view: 'bands' | 'matching' }) {
  const [opened, setOpened] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [tentativeBand, setTentativeBand] = useState('all')
  const mobile = useIsMobile()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [recipients, setRecipients] = useState<BandReviewData['pool']>([])
  const [matches, setMatches] = useState<ReturnType<typeof reconcileBandCandidates> | null>(null)
  const [reconciling, setReconciling] = useState(false)
  const [reconcileError, setReconcileError] = useState('')
  const proposal = data.proposals.find(row => row.id === opened)
  const candidates = data.pool.filter(row => (!query || `${row.name} ${row.sourceName} ${row.instrument}`.toLowerCase().includes(query.toLowerCase())) &&
    (tentativeBand === 'all' || (tentativeBand === 'none' ? !data.proposals.some(band => band.candidateIds.includes(row.id)) : data.proposals.some(band => band.id === tentativeBand && band.candidateIds.includes(row.id)))))
  const allSelected = candidates.length > 0 && candidates.every(row => selected.has(row.id))
  const selection = data.pool.filter(row => selected.has(row.id))
  const groups = [{ id: 'sunkast', name: 'SunKast', status: 'Existing band', members: `${data.members.length} active memberships`, instructor: [...new Set(data.members.map(item => item.instructor).filter(Boolean))].join(', ') || 'Not recorded' },
    ...data.proposals.map(row => ({ id: row.id, name: row.name, status: 'Proposed', members: `${row.candidateIds.length} candidates`, instructor: 'Not assigned' }))]
  const members = data.members.map((row, index): ExplorerPerson => ({ id: `review-member-${index}`, name: row.name, email: '', family: '', enrolled: true, customer: false, roles: ['Student'] }))
  const proposed = (proposal?.candidateIds ?? []).flatMap(id => data.pool.filter(row => row.id === id))
  const proposedPeople = proposed.map((row): ExplorerPerson => ({ id: row.id, name: row.name, email: '', family: '', enrolled: false, customer: false, roles: ['Student'] }))
  const group = groups.find(item => item.id === opened)
  const checkMatches = async () => {
    setReconciling(true); setReconcileError(''); setMatches(null)
    try {
      const tenant = getActiveTenantId()
      const response = await fetch(`/odeon-demo/band-review-reconciliation?tenant=${encodeURIComponent(tenant)}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not check possible matches.')
      setMatches(result.matches)
    } catch (error) { setReconcileError(error instanceof Error ? error.message : 'Could not check possible matches.') }
    finally { setReconciling(false) }
  }
  return <>
    {view === 'bands' ? <ResponsiveDataTable rows={groups} getRowKey={row => row.id} ariaLabel="Groups" minDesktopWidth={650} emptyContent="No bands to review." columns={[
      { id: 'name', header: 'Group', width: '1.5fr', render: row => <PersonName as="button" onClick={() => setOpened(row.id)}>{row.name}</PersonName> },
      { id: 'status', header: 'Status', width: '1fr', render: row => row.status },
      { id: 'members', header: 'Roster', width: '1fr', render: row => row.members },
      { id: 'instructor', header: 'Teacher / staff', width: '1fr', render: row => row.instructor },
    ]} /> : <div className={styles.stack}>
      <DenseSectionPanel title="Candidate pool" contentStyle={{ display: 'grid', gap: spacing.md }}>
        <Notice>Spreadsheet review only. These rows are not linked to Opportunities; status and follow-up are not shown until the records are reconciled.</Notice>
        <div><Button variant="secondary" disabled={reconciling} onClick={() => void checkMatches()}>{reconciling ? 'Checking…' : 'Check possible matches'}</Button></div>
        {reconcileError && <Notice variant="error">{reconcileError}</Notice>}
        {matches && <Notice>Possible matches are based on names only. They are not verified or linked; review every match before taking action.</Notice>}
        <TableSearchControl label="Search candidates" placeholder="Name or preferred band instrument" value={search} onChange={setSearch} onSearch={() => setQuery(search.trim())} onClear={() => { setSearch(''); setQuery('') }} />
        <Select label="Tentative bands" value={tentativeBand} onChange={event => setTentativeBand(event.target.value)}><option value="all">All candidates</option><option value="none">No tentative band</option>{data.proposals.map(band => <option key={band.id} value={band.id}>{band.name}</option>)}</Select>
        <TableResultCount>{candidates.length} of {data.pool.length} candidates</TableResultCount>
        {selection.length > 0 && <TableContextActionBar selectedCount={selection.length} selectionNoun="students" onClear={() => setSelected(new Set())} actions={[
          { id: 'email', label: 'Email', onClick: () => setRecipients(selection) },
        ]} />}
        <ResponsiveDataTable rows={candidates} getRowKey={row => row.id} ariaLabel="Band candidates" minDesktopWidth={850} emptyContent="No matching candidates." selection={{
          selectedKeys: selected, allSelected, someSelected: !allSelected && candidates.some(row => selected.has(row.id)), selectAllLabel: 'Select all matching students', getRowLabel: row => row.name,
          onToggle: (row, _index, event) => { const checked = event.target.checked; setSelected(current => { const next = new Set(current); if (checked) next.add(row.id); else next.delete(row.id); return next }) },
          onToggleAll: () => setSelected(current => { const next = new Set(current); for (const row of candidates) { if (allSelected) next.delete(row.id); else next.add(row.id) } return next }),
        }} columns={[
          { id: 'name', header: 'Student', width: '1.6fr', render: row => <PersonName>{row.name}</PersonName> },
          { id: 'age', header: 'Age', width: '.6fr', render: row => row.age },
          { id: 'instrument', header: 'Band instrument', width: '1fr', render: row => row.instrument },
          { id: 'band', header: 'Tentative bands', width: '1.45fr', render: row => data.proposals.filter(band => band.candidateIds.includes(row.id)).map(band => band.name).join(', ') || '—' },
          ...(matches ? [{ id: 'matches', header: 'Possible matches', width: '1.8fr', render: (row: BandReviewData['pool'][number]) => {
            const match = matches.find(item => item.candidateId === row.id)
            if (!match) return 'Not checked'
            return <div>{match.personIds.length ? match.personIds.map((id, index) => <div key={id}><a href={`/dashboard/contacts?contact=${encodeURIComponent(id)}`} target="_blank" rel="noreferrer">Possible contact {index + 1}</a></div>) : <div>No contact name match</div>}
              {match.opportunityIds.length ? match.opportunityIds.map((id, index) => <div key={id}><a href={`/dashboard/leads?lead=${encodeURIComponent(id)}`} target="_blank" rel="noreferrer">Possible opportunity {index + 1}</a></div>) : <div>No opportunity name match</div>}</div>
          } }] : []),
        ]} />
      </DenseSectionPanel>
      <DenseSectionPanel title="Band teacher availability" contentStyle={{ display: 'grid', gap: spacing.md }}>
        <p className={styles.muted}>Open teaching windows from the staff sheet. These are not booked rehearsals or student availability.</p>
        <ResponsiveDataTable rows={data.openings} getRowKey={row => `${row.teacher}:${row.window}`} ariaLabel="Band teacher openings" minDesktopWidth={460} emptyContent="No openings recorded." columns={[
          { id: 'teacher', header: 'Teacher', width: '1fr', render: row => row.teacher },
          { id: 'window', header: 'Available window', width: '2fr', render: row => row.window },
        ]} />
      </DenseSectionPanel>
    </div>}
    {group && <BandSlidePanel key={group.id} band={{ id: group.id, name: group.name, typeId: 'band', leader: proposal ? '' : 'review-instructor', capacity: 0, trialMax: 0, memberIds: proposal ? [] : members.map(member => member.id), pendingMemberIds: proposed.map(row => row.id), memberInstruments: Object.fromEntries(proposed.filter(row => row.instrument !== 'Not recorded').map(row => [row.id, row.instrument])), schedule: proposal ? '' : 'Wednesday · Regular start time unconfirmed', resources: [], eventIds: [], message: '' }}
      people={proposal ? proposedPeople : members} staff={[{ id: 'review-instructor', values: { name: group.instructor } }]} tasks={[]} enrollments={[]} requests={[]}
      review={{ proposed: !!proposal, room: data.rooms.join(', ') }}
      onClose={() => setOpened(null)} onAdd={noop} onChange={noop} onEnroll={noop} onRemove={noop} onStudent={noop} onRequest={noop} onResponse={noop} onPortal={noop} onBook={noop} onEnrollmentRequest={noop} />}
    {recipients.length > 0 && <SlidePanel isOpen fullScreen={mobile} onClose={() => setRecipients([])}>
      <SlidePanelHeader title="Send email" onClose={() => setRecipients([])} />
      <div style={{ padding: spacing.lg, overflowY: 'auto', minHeight: 0 }}>
        <BulkEmailPreview recipients={recipients} onClose={() => setRecipients([])} onSimulate={() => setRecipients([])} />
      </div>
    </SlidePanel>}
  </>
}
