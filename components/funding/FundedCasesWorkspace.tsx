'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Notice, PageHeader, ResponsiveDataTable, SlidePanel, SlidePanelHeader, SurfacePanel, Tabs, type DataTableColumn, type DataTableSort } from '@/components/ui'
import ContactSlidePanel from '@/components/contacts/ContactSlidePanel'
import { getActiveTenantId } from '@/lib/tenant'
import { colors, spacing, typography } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'
import { fundingCases as initialCases, fundingPrograms } from './fixtures'
import { formatCurrency, formatDate, FundingContactDetails } from './FundingContactDetails'
import { InvoiceStatusModal } from './InvoiceStatusModal'
import type { FundingCase, FundingInvoice, FundingInvoiceStatus, FundingProgram } from './types'

type WorkspaceTab = 'needs_review' | 'waiting' | 'all' | 'programs'
type CaseSortKey = 'student' | 'organization' | 'status' | 'dueDate' | 'outstanding' | 'updatedAt'
type ProgramSortKey = 'name' | 'activeCases' | 'outstanding'

export default function FundedCasesWorkspace() {
  const isMobile = useIsMobile()
  const [cases, setCases] = useState(initialCases)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('needs_review')
  const [caseSort, setCaseSort] = useState<DataTableSort<CaseSortKey>>({ key: 'dueDate', direction: 'asc' })
  const [programSort, setProgramSort] = useState<DataTableSort<ProgramSortKey>>({ key: 'name', direction: 'asc' })
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [contactCaseId, setContactCaseId] = useState<string | null>(null)
  const [invoiceEdit, setInvoiceEdit] = useState<{ caseId: string; invoice: FundingInvoice } | null>(null)
  const [dataSource, setDataSource] = useState<'loading' | 'persisted' | 'fixture'>('loading')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const tenantId = getActiveTenantId()
    let active = true
    fetch(`/api/funding/cases?tenant=${encodeURIComponent(tenantId)}`)
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body?.error || 'Could not load funded cases.')
        if (!Array.isArray(body)) throw new Error('Funding cases returned an invalid response.')
        if (active) {
          setCases(body)
          setDataSource('persisted')
        }
      })
      .catch(error => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Could not load funded cases.')
          setDataSource('fixture')
        }
      })
    return () => { active = false }
  }, [])

  const selectedCase = cases.find(item => item.id === selectedCaseId) || null
  const contactCase = cases.find(item => item.id === contactCaseId) || null
  const needsReviewCount = cases.filter(item => item.status === 'needs_review').length
  const waitingCount = cases.filter(item => item.status === 'waiting').length
  const outstanding = cases.reduce((sum, item) => sum + item.outstanding, 0)
  const paidThisCycle = cases.reduce((sum, item) => sum + item.amountPaid, 0)

  const visibleCases = useMemo(() => {
    const filtered = activeTab === 'all' ? cases : cases.filter(item => item.status === activeTab)
    return [...filtered].sort((a, b) => compareCases(a, b, caseSort))
  }, [activeTab, caseSort, cases])

  const sortedPrograms = useMemo(() => [...fundingPrograms].sort((a, b) => comparePrograms(a, b, programSort)), [programSort])

  const replaceCase = (updated: FundingCase) => {
    setCases(current => current.map(item => item.id === updated.id ? updated : item))
  }

  const updateNextStep = async (caseId: string, nextStep: string) => {
    if (dataSource === 'persisted') {
      const tenantId = getActiveTenantId()
      const response = await fetch(`/api/funding/cases/${caseId}?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next_step: nextStep }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Could not update the case.')
      replaceCase(body)
      return
    }
    setCases(current => current.map(item => item.id === caseId ? { ...item, nextStep, updatedAt: new Date().toISOString() } : item))
  }

  const updateInvoiceStatus = async (input: { status: FundingInvoiceStatus; evidence: string; note: string; paidOn: string | null }) => {
    if (!invoiceEdit) return
    if (dataSource === 'persisted') {
      const tenantId = getActiveTenantId()
      const response = await fetch(`/api/funding/invoices/${invoiceEdit.invoice.id}/status?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: input.status, evidence: input.evidence, note: input.note, paid_on: input.paidOn }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Could not update invoice status.')
      replaceCase(body)
      return
    }
    const changedAt = new Date().toISOString()
    setCases(current => current.map(item => {
      if (item.id !== invoiceEdit.caseId) return item
      const invoices = item.invoices.map(invoice => invoice.id !== invoiceEdit.invoice.id ? invoice : {
        ...invoice,
        status: input.status,
        paidOn: input.status === 'paid' ? input.paidOn : null,
        rejectionEvidence: input.status === 'rejected' ? input.evidence : null,
        updatedAt: changedAt,
        statusEvents: [{
          id: `fixture-event-${Date.now()}`,
          fromStatus: invoice.status,
          toStatus: input.status,
          evidence: input.evidence || null,
          note: input.note || null,
          changedAt,
        }, ...invoice.statusEvents],
      })
      return recalculateFixtureCase({ ...item, invoices, updatedAt: changedAt }, input.status, input.note || input.evidence)
    }))
  }

  const caseColumns: DataTableColumn<FundingCase, CaseSortKey>[] = [
    {
      id: 'student', header: 'Student', width: 'minmax(180px, 1.1fr)', sortable: true, sortKey: 'student',
      render: item => (
        <div style={{ minWidth: 0 }}>
          <div style={{ color: colors.text, fontWeight: typography.weightSemibold }}>{item.student}</div>
          <button type="button" onClick={() => setContactCaseId(item.id)} style={linkButtonStyle}>View contact</button>
        </div>
      ),
    },
    { id: 'organization', header: 'Funding organization', width: 'minmax(190px, 1.2fr)', sortable: true, sortKey: 'organization', render: item => <div><div style={{ fontWeight: typography.weightMedium }}>{item.fundingOrganization}</div><div style={secondaryTextStyle}>{item.programType}</div></div> },
    { id: 'status', header: 'Status', width: '150px', sortable: true, sortKey: 'status', render: item => <FundingStatusBadge item={item} /> },
    { id: 'nextStep', header: 'Suggested next step', width: 'minmax(240px, 1.5fr)', render: item => <div><div>{item.nextStep}</div><div style={secondaryTextStyle}>Waiting on {item.owner}</div></div> },
    { id: 'dueDate', header: 'Due', width: '125px', sortable: true, sortKey: 'dueDate', render: item => item.dueDate ? formatDate(item.dueDate) : '—' },
    { id: 'outstanding', header: 'Outstanding', width: '125px', align: 'right', sortable: true, sortKey: 'outstanding', defaultSortDirection: 'desc', render: item => <span style={{ fontWeight: typography.weightSemibold }}>{formatCurrency(item.outstanding)}</span> },
  ]

  const programColumns: DataTableColumn<FundingProgram, ProgramSortKey>[] = [
    { id: 'name', header: 'Program', width: 'minmax(220px, 1.3fr)', sortable: true, sortKey: 'name', render: item => <div><div style={{ fontWeight: typography.weightSemibold }}>{item.name}</div><div style={secondaryTextStyle}>{item.type}</div></div> },
    { id: 'routing', header: 'Submission route', width: 'minmax(180px, 1fr)', render: item => item.routing },
    { id: 'cadence', header: 'Cadence', width: '140px', render: item => item.cadence },
    { id: 'activeCases', header: 'Active cases', width: '120px', align: 'right', sortable: true, sortKey: 'activeCases', defaultSortDirection: 'desc', render: item => item.activeCases },
    { id: 'outstanding', header: 'Outstanding', width: '130px', align: 'right', sortable: true, sortKey: 'outstanding', defaultSortDirection: 'desc', render: item => formatCurrency(item.outstanding) },
    { id: 'observed', header: 'Observed payment', width: '160px', render: item => item.observedPayment },
    { id: 'verification', header: 'Profile status', width: '150px', render: item => <Badge variant={item.verification.includes('Verified') ? 'success' : item.verification === 'Needs review' ? 'nudge' : 'neutral'} size="sm">{item.verification}</Badge> },
  ]

  const tabs = [
    { key: 'needs_review' as const, label: 'Needs review', count: needsReviewCount },
    { key: 'waiting' as const, label: 'Waiting', count: waitingCount },
    { key: 'all' as const, label: 'All cases', count: cases.length },
    { key: 'programs' as const, label: 'Programs', count: fundingPrograms.length },
  ]

  return (
    <div style={{ padding: isMobile ? spacing.lg : spacing['3xl'], width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <PageHeader title="Funded cases" subtitle="Track funded students, money owed, case workflows, and the next action that needs attention." />

      {dataSource === 'fixture' && (
        <Notice variant="warning" title="Prototype data shown" style={{ marginBottom: spacing.lg }}>
          Persisted funding data is unavailable in this environment. Apply Migration 018 and ensure this account has funding permissions to enable production records. {loadError}
        </Notice>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: spacing.md, marginBottom: spacing['2xl'] }}>
        <SummaryCard label="Needs review" value={String(needsReviewCount)} detail="Cases requiring a decision" />
        <SummaryCard label="Waiting" value={String(waitingCount)} detail="Owned by vendor, family, or payer" />
        <SummaryCard label="Outstanding" value={formatCurrency(outstanding)} detail="Expected but not yet paid" />
        <SummaryCard label="Paid this cycle" value={formatCurrency(paidThisCycle)} detail={dataSource === 'persisted' ? 'Across persisted invoices' : 'Across current prototype cases'} />
      </div>

      <div style={{ overflowX: 'auto', marginBottom: spacing.lg }}>
        <Tabs items={tabs} activeKey={activeTab} onChange={setActiveTab} compact={isMobile} style={isMobile ? { minWidth: 430 } : undefined} />
      </div>

      {activeTab === 'programs' ? (
        <ResponsiveDataTable
          rows={sortedPrograms}
          columns={programColumns}
          getRowKey={item => item.id}
          sort={programSort}
          onSortChange={setProgramSort}
          emptyContent="No funding programs configured."
          minDesktopWidth={1040}
          ariaLabel="Funding programs"
        />
      ) : (
        <ResponsiveDataTable
          rows={visibleCases}
          columns={caseColumns}
          getRowKey={item => item.id}
          sort={caseSort}
          onSortChange={setCaseSort}
          emptyContent="No cases in this view."
          minDesktopWidth={1120}
          onRowClick={item => setSelectedCaseId(item.id)}
          getRowStyle={item => ({ background: selectedCaseId === item.id ? colors.surfaceMuted : colors.surface })}
          ariaLabel="Funded cases"
        />
      )}

      {selectedCase && (
        <SlidePanel isOpen onClose={() => setSelectedCaseId(null)} fullScreen={isMobile} width="min(75vw, 960px)">
          <SlidePanelHeader
            title={selectedCase.student}
            subtitle={selectedCase.fundingOrganization}
            badge={<><FundingStatusBadge item={selectedCase} /><Badge variant="neutral">Waiting on {selectedCase.owner}</Badge></>}
            onClose={() => setSelectedCaseId(null)}
            compact={isMobile}
            actions={<Button size="sm" variant="secondary" onClick={() => { setSelectedCaseId(null); setContactCaseId(selectedCase.id) }}>View contact</Button>}
          />
          <FundingContactDetails
            fundingCase={selectedCase}
            embedded
            onNextStepChange={value => void updateNextStep(selectedCase.id, value)}
            onInvoiceStatusChange={invoice => setInvoiceEdit({ caseId: selectedCase.id, invoice })}
          />
        </SlidePanel>
      )}

      {contactCase && (
        <ContactSlidePanel
          key={contactCase.id}
          contact={toMockContact(contactCase)}
          tenantFields={[]}
          mockFundingCase={contactCase}
          initialPanelTab="funding"
          onClose={() => setContactCaseId(null)}
          onUpdated={() => {}}
          onNextStepChange={value => void updateNextStep(contactCase.id, value)}
          onInvoiceStatusChange={invoice => setInvoiceEdit({ caseId: contactCase.id, invoice })}
          onFundingCaseUpdated={replaceCase}
        />
      )}

      <InvoiceStatusModal invoice={invoiceEdit?.invoice || null} onClose={() => setInvoiceEdit(null)} onSave={updateInvoiceStatus} />
    </div>
  )
}

function recalculateFixtureCase(item: FundingCase, status: FundingInvoiceStatus, detail: string) {
  const amountExpected = item.invoices.reduce((sum, invoice) => sum + invoice.amount, 0)
  const amountPaid = item.invoices.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.amount, 0)
  const workflowStatus = status === 'paid' ? 'paid' : status === 'pending' ? 'waiting' : 'needs_review'
  const statusLabel = status === 'rejected' ? 'Invoice rejected' : status === 'overdue' ? 'Invoice overdue' : status === 'draft' ? 'Invoice needed' : status === 'pending' ? 'Waiting on payer' : 'Paid'
  return {
    ...item,
    status: workflowStatus as FundingCase['status'],
    statusLabel,
    amountExpected,
    amountPaid,
    outstanding: amountExpected - amountPaid,
    activity: [{ id: `fixture-case-event-${Date.now()}`, title: `Invoice ${statusLabel.replace('Invoice ', '').toLowerCase()}`, detail, date: new Date().toISOString() }, ...item.activity],
  }
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <SurfacePanel padding={spacing.lg} style={{ minWidth: 0, boxShadow: 'none' }}>
      <div style={{ color: colors.textMuted, fontSize: typography.sizeSm, fontWeight: typography.weightMedium }}>{label}</div>
      <div style={{ color: colors.text, fontFamily: typography.fontDisplay, fontSize: typography.size2xl, fontWeight: typography.weightBold, lineHeight: 1.15, marginTop: spacing.xs }}>{value}</div>
      <div style={{ color: colors.textSecondary, fontSize: typography.sizeXs, marginTop: spacing.sm }}>{detail}</div>
    </SurfacePanel>
  )
}

function FundingStatusBadge({ item }: { item: FundingCase }) {
  const variant = item.status === 'paid' ? 'success' : item.status === 'needs_review' ? 'risk' : item.status === 'waiting' ? 'nudge' : 'info'
  return <Badge variant={variant} size="sm">{item.statusLabel}</Badge>
}

function compareCases(a: FundingCase, b: FundingCase, sort: DataTableSort<CaseSortKey>) {
  const values: Record<CaseSortKey, [string | number, string | number]> = {
    student: [a.student, b.student], organization: [a.fundingOrganization, b.fundingOrganization], status: [a.statusLabel, b.statusLabel],
    dueDate: [a.dueDate || '9999-12-31', b.dueDate || '9999-12-31'], outstanding: [a.outstanding, b.outstanding], updatedAt: [a.updatedAt, b.updatedAt],
  }
  const [left, right] = values[sort.key]
  const result = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))
  return sort.direction === 'asc' ? result : -result
}

function comparePrograms(a: FundingProgram, b: FundingProgram, sort: DataTableSort<ProgramSortKey>) {
  const values: Record<ProgramSortKey, [string | number, string | number]> = { name: [a.name, b.name], activeCases: [a.activeCases, b.activeCases], outstanding: [a.outstanding, b.outstanding] }
  const [left, right] = values[sort.key]
  const result = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))
  return sort.direction === 'asc' ? result : -result
}

function toMockContact(item: FundingCase) {
  const [firstName, ...lastParts] = item.student.split(' ')
  return {
    id: `mock-${item.id}`, first_name: firstName, last_name: lastParts.join(' '), phone: null, email: null, date_of_birth: null,
    client_status: 'active', opted_out: false, last_attended: null, notes: null, family_name: `${lastParts.at(-1) || firstName} family`,
    account_holder_name: item.parent, account_holder_phone: null, account_holder_email: null,
    account_holders: [{ name: item.parent, phone: null, email: null, relationship: 'Account manager', is_primary: true }],
    custom_fields: { service: item.service }, is_minor: true, notes_history: [], student_notes_history: [],
  }
}

const secondaryTextStyle: React.CSSProperties = { color: colors.textMuted, fontSize: typography.sizeXs, marginTop: spacing.xs }
const linkButtonStyle: React.CSSProperties = { border: 'none', background: 'transparent', color: colors.tealDark, padding: 0, marginTop: spacing.xs, fontFamily: typography.fontSans, fontSize: typography.sizeXs, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }