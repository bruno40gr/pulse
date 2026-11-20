'use client'

import { useCallback, useEffect, useState } from 'react'
import LeadsView from '@/components/leads/LeadsView'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { Notice } from '@/components/ui/Notice'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { ResponsiveDataTable } from '@/components/ui/DataGridTable'
import { SlidePanel, SlidePanelHeader } from '@/components/ui'
import { PersonName } from '@/components/ui/PersonName'
import { useIsMobile } from '@/lib/useMediaQuery'
import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'
import { spacing } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'

type Member = { person_id: string; name: string }
type Band = { name: string; coach: string | null; members: Member[] }
type TentativeGroup = { id: string; name: string; member_count?: number }
type LoadState = 'loading' | 'ready' | 'error'

const tenantQuery = () => `tenant=${encodeURIComponent(getActiveTenantId())}`

async function readList<T>(url: string, key: string, signal: AbortSignal): Promise<T[]> {
  const response = await fetch(url, { cache: 'no-store', signal })
  if (!response.ok) throw new Error('Unavailable')
  const data = await response.json()
  if (!Array.isArray(data?.[key])) throw new Error('Invalid response')
  return data[key] as T[]
}

/** Operational transport only. Beta sample stores are never loaded here. */
export default function ProductionBandsWorkspace() {
  const [view, setView] = useState<'bands' | 'matching'>('bands')
  const [bands, setBands] = useState<Band[]>([])
  const [tentative, setTentative] = useState<TentativeGroup[]>([])
  const [bandsState, setBandsState] = useState<LoadState>('loading')
  const [tentativeState, setTentativeState] = useState<LoadState>('loading')
  const [opened, setOpened] = useState<string | null>(null)
  const mobile = useIsMobile()

  // Roster and tentatives are independent reads: a missing tentative table or an
  // unreadable roster must never blank the other section.
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

  useEffect(() => {
    if (view !== 'bands') return
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load, view])

  const band = opened ? bands.find(row => row.name === opened) : undefined

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
              { id: 'coach', header: 'Coach', width: '1fr', render: row => row.coach || '—' },
            ]} />}
      </DenseSectionPanel>
      <DenseSectionPanel title="Tentative bands">
        <Notice>Possible groups from band review. A tentative band is not an enrollment.</Notice>
        {tentativeState === 'error' ? <Notice variant="error">Could not load tentative bands. The band roster above is unaffected.</Notice>
          : tentativeState === 'loading' ? <p role="status">Loading tentative bands…</p>
            : <ResponsiveDataTable rows={tentative} getRowKey={row => row.id} ariaLabel="Tentative bands" minDesktopWidth={400} emptyContent="No tentative bands yet." columns={[
              { id: 'name', header: 'Tentative band', width: '1.2fr', render: row => row.name },
              { id: 'members', header: 'Candidates', width: '.6fr', render: row => row.member_count ?? 0 },
            ]} />}
      </DenseSectionPanel>
    </>}
    {band && <SlidePanel isOpen onClose={() => setOpened(null)} fullScreen={mobile} width={PROFILE_PANEL_WIDTH}>
      <SlidePanelHeader title={band.name} subtitle={band.coach ? `${band.members.length} ${band.members.length === 1 ? 'member' : 'members'} · Coach ${band.coach}` : `${band.members.length} ${band.members.length === 1 ? 'member' : 'members'}`} onClose={() => setOpened(null)} />
      <div style={{ padding: spacing.lg, overflowY: 'auto', minHeight: 0 }}>
        <DenseSectionPanel title="Members">
          <ResponsiveDataTable rows={band.members} getRowKey={row => row.person_id} ariaLabel="Band members" minDesktopWidth={320} emptyContent="No enrolled members." columns={[
            { id: 'name', header: 'Member', width: '1fr', render: row => <PersonName>{row.name}</PersonName> },
          ]} />
        </DenseSectionPanel>
      </div>
    </SlidePanel>}
  </PageContainer>
}
