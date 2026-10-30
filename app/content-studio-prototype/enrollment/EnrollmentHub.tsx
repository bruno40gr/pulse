'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button, EmptyState, Input, Notice, PageHeader, ResponsiveDataTable, type DataTableColumn, type DataTableSort } from '@/components/ui'
import { ControlButton } from '@/components/ui/ControlButton'
import { PersonName } from '@/components/ui/PersonName'
import { ProgressStepper } from '@/components/ui/ProgressStepper'
import { colors, spacing, typography } from '@/lib/tokens'
import {
  enrollmentDraftName, enrollmentDraftProgress, enrollmentDraftStorageKey, mergeEnrollmentQueue,
  newEnrollmentDraft, readEnrollmentDrafts, writeEnrollmentDrafts,
  type EnrollmentDraftRecord, type EnrollmentLead,
} from '@/lib/academy-enrollment-drafts'
import type { StaffEnrollment as EnrollmentData } from '@/lib/academy-staff-enrollment'
import { createEnrollmentHubFixtures, normalizeEnrollmentHubFixtures } from '@/lib/academy-enrollment-hub-fixtures'

// The list never loads the calendar, pricing editor or payment preview per row.
const StaffEnrollment = dynamic(() => import('./StaffEnrollment'), { loading: () => <p role="status">Loading enrollment…</p> })
type SortKey = 'name' | 'updated'

export default function EnrollmentHub({ storageScope, tenantId, mock = false }: { storageScope: string; tenantId: string; mock?: boolean }) {
  const key = enrollmentDraftStorageKey(mock ? `${storageScope}:mock-v1` : storageScope)
  const [saved, setSaved] = useState<EnrollmentDraftRecord[]>([])
  const [leads, setLeads] = useState<EnrollmentLead[]>([])
  const [previous, setPrevious] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sourceError, setSourceError] = useState('')
  const [active, setActive] = useState<EnrollmentDraftRecord | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<DataTableSort<SortKey>>({ key: 'updated', direction: 'desc' })

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      const records = raw === null && mock ? createEnrollmentHubFixtures() : readEnrollmentDrafts(raw)
      setSaved(mock ? normalizeEnrollmentHubFixtures(records) : records); setPrevious(raw); setReady(true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Browser storage is unavailable. Drafts cannot be saved.') }
  }, [key, mock])

  useEffect(() => {
    if (mock) { setLoading(false); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 30000)
    async function load() {
      try {
        const result: EnrollmentLead[] = []
        const pageSize = 100
        for (let offset = 0; ; offset += pageSize) {
          const params = new URLSearchParams({ tenant: tenantId, intake_type: 'enrolled', include_activity: '0', limit: String(pageSize), offset: String(offset) })
          const response = await fetch(`/api/leads?${params}`, { signal: controller.signal, cache: 'no-store' })
          if (!response.ok) throw new Error('Won leads could not be loaded. Your saved drafts are still available.')
          const page: unknown = await response.json()
          if (!Array.isArray(page)) throw new Error('Unexpected lead response. Your saved drafts are still available.')
          result.push(...page)
          if (page.length < pageSize) break
        }
        setLeads(result)
      } catch (cause) {
        if (!controller.signal.aborted) setSourceError(cause instanceof Error ? cause.message : 'Could not load won leads.')
        else setSourceError('Loading won leads was interrupted. Reload to try again.')
      } finally { window.clearTimeout(timer); setLoading(false) }
    }
    void load()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [tenantId, mock])

  function open(record: EnrollmentDraftRecord) { setError(''); setActive(record) }
  function saveAndClose(draft: EnrollmentData, step: number, reviewedSteps: number[]) {
    if (!active || !ready) return
    const record = { ...active, draft, step, reviewedSteps, started: true, updatedAt: new Date().toISOString() }
    const records = [...saved.filter(item => item.id !== record.id && !(record.sourceLeadId && item.sourceLeadId === record.sourceLeadId)), record]
    try {
      const raw = writeEnrollmentDrafts(window.localStorage, key, previous, records)
      setSaved(records); setPrevious(raw); setActive(null); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Draft could not be saved. Keep this page open and try again.') }
  }

  const rows = mergeEnrollmentQueue(saved, leads).filter(record => {
    const text = `${enrollmentDraftName(record)} ${record.draft.contact?.email || ''} ${record.draft.lessons.map(lesson => lesson.instrument).join(' ')}`.toLowerCase()
    return text.includes(search.trim().toLowerCase())
  }).sort((a, b) => {
    const comparison = sort.key === 'name' ? enrollmentDraftName(a).localeCompare(enrollmentDraftName(b)) : a.updatedAt.localeCompare(b.updatedAt)
    return (sort.direction === 'asc' ? comparison : -comparison) || a.id.localeCompare(b.id)
  })
  const columns: DataTableColumn<EnrollmentDraftRecord, SortKey>[] = [
    { id: 'student', header: 'Student / contact', width: 'minmax(190px, 1.4fr)', sortable: true, sortKey: 'name', render: record => <div>
      <PersonName as="button" onClick={() => open(record)} disabled={!ready}>{enrollmentDraftName(record)}</PersonName>
    </div> },
    { id: 'lesson', header: 'Lesson', width: 'minmax(150px, 1fr)', render: record => record.draft.lessons.map(lesson => lesson.instrument && `${lesson.instrument} · ${lesson.duration} min`).filter(Boolean).join(', ') || 'Not selected' },
    { id: 'progress', header: 'Enrollment progress', width: 'minmax(200px, 1.2fr)', render: record => {
      const progress = enrollmentDraftProgress(record)
      return <ControlButton kind="name" aria-label={`Resume enrollment for ${enrollmentDraftName(record)}`} disabled={!ready} onClick={() => open(record)}><ProgressStepper label="Enrollment progress" steps={progress.steps} currentStep={progress.current} notStarted={!record.started} /></ControlButton>
    } },
    { id: 'value', header: 'Opportunity value', width: 'minmax(140px, .8fr)', render: record => record.opportunityValue === undefined ? '—' : `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(record.opportunityValue)}` },
    { id: 'updated', header: 'Last updated', width: 'minmax(140px, .8fr)', sortable: true, sortKey: 'updated', defaultSortDirection: 'desc', render: record => <time dateTime={record.updatedAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(record.updatedAt))}</time> },
  ]

  return <div style={{ minHeight: '100vh', background: colors.background, color: colors.text, fontFamily: typography.fontSans }}>
    <div style={{ padding: spacing.xl }}>
      <Notice title={mock ? 'Mock enrollments' : 'Enrollment preview'}>{mock ? 'Fictional records · changes stay in this browser.' : 'Drafts are saved only in this browser for your account, not shared across devices or staff. Use fictional details in this preview. Proposed times are not reserved; no booking, payment or message is created.'}</Notice>
      {error && <Notice variant="error" style={{ marginTop: spacing.md }}>{error}</Notice>}
      {!active && sourceError && <Notice variant="warning" style={{ marginTop: spacing.md }}>{sourceError}</Notice>}
    </div>
    {active ? <StaffEnrollment key={active.id} initialRecord={active} onSaveAndClose={saveAndClose} onClose={() => { setActive(null); setError('') }} /> : <main style={{ padding: spacing['3xl'], minWidth: 0 }}>
      <PageHeader title="Enrollment" right={<Button disabled={!ready} onClick={() => open(newEnrollmentDraft(crypto.randomUUID(), new Date().toISOString()))}>Start new enrollment</Button>} />
      <div style={{ marginBottom: spacing.lg }}><Input type="search" aria-label="Search enrollments" placeholder="Search student, contact or instrument" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <ResponsiveDataTable rows={rows} columns={columns} getRowKey={record => record.id} ariaLabel="Enrollments" sort={sort} onSortChange={setSort} loading={loading && rows.length === 0} onRowClick={record => { if (ready) open(record) }} alignToSelectionInset stickyHeaderOffset={0}
        emptyContent={<EmptyState title={search ? 'No matching enrollments' : sourceError ? 'Won leads unavailable' : 'No enrollments yet'} description={sourceError ? 'Saved browser drafts will appear here. Reload to try loading won leads again.' : search ? 'Try a student, contact or instrument.' : 'Start a new enrollment; eligible won leads appear here automatically.'} />} />
    </main>}
  </div>
}