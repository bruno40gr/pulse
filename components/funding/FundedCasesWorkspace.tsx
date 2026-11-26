'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Button, Notice, PageHeader, Tabs, type DataTableColumn, type DataTableSort } from '@/components/ui'
import { RichDataTable } from '@/components/ui/RichDataTable'
import { useTablePreferences } from '@/components/ui/TableDisplayControls'
import { FUNDING_TABLE_SCHEMA } from '@/lib/funding-table-preferences'
import ConversationProfilePanel from '@/components/inbox/ConversationProfilePanel'
import LiveContactPanel from '@/components/contacts/LiveContactPanel'
import type { Contact } from '@/app/dashboard/contacts/page'
import type { ConversationPerson } from '@/lib/conversations-live'
import { conversationComposeHref } from '@/lib/conversation-links'
import { useMobilePanelHistory } from '@/lib/useMobilePanelHistory'
import { PersonName } from '@/components/ui/PersonName'
import { getActiveTenantId } from '@/lib/tenant'
import { isFundingDemoTenant, loadDemoFunding, recalculateDemoFundingCase, resetDemoFunding, saveDemoFundingCase } from '@/lib/funding/demo'
import { FundingSummary } from './FundingSummary'
import { colors, spacing, typography } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'
import { formatCurrency, formatDate } from './FundingContactDetails'
import { InvoiceStatusModal } from './InvoiceStatusModal'
import { NewFundedCaseModal } from './NewFundedCaseModal'
import type { FundingCase, FundingInvoice, FundingInvoiceStatus } from './types'

type StudentFilter = 'needs_review' | 'waiting' | 'all'
type CaseSortKey = 'student' | 'organization' | 'status' | 'dueDate' | 'outstanding' | 'updatedAt'

export default function FundedCasesWorkspace() {
  const isMobile = useIsMobile()
  const router = useRouter()
  const [cases, setCases] = useState<FundingCase[]>([])
  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all')
  const tablePreferences = useTablePreferences(FUNDING_TABLE_SCHEMA)
  const [caseSort, setCaseSort] = useState<DataTableSort<CaseSortKey>>(() => (tablePreferences.preferences.sort as DataTableSort<CaseSortKey>) || { key: 'dueDate', direction: 'asc' })
  const storedSort = tablePreferences.preferences.sort
  useEffect(() => {
    if (storedSort) setCaseSort({ key: storedSort.key as CaseSortKey, direction: storedSort.direction })
  }, [storedSort?.key, storedSort?.direction]) // eslint-disable-line react-hooks/exhaustive-deps -- identity comes from the stored values
  const [contactPanel, setContactPanel] = useState<{ contact: Contact; fundingCase: FundingCase } | null>(null)
  const [invoiceEdit, setInvoiceEdit] = useState<{ caseId: string; invoice: FundingInvoice } | null>(null)
  const [dataSource, setDataSource] = useState<'loading' | 'persisted' | 'demo' | 'unavailable'>('loading')
  const [loadError, setLoadError] = useState('')
  const [showNewCase, setShowNewCase] = useState(false)
  const [preferredProgramId, setPreferredProgramId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const demoHistory = useMobilePanelHistory({ isOpen: dataSource === 'demo' && !!contactPanel, isMobile, historyKey: 'pulseMobileDemoFundingProfile', onClose: () => setContactPanel(null) })
  const profileContact = contactPanel?.contact
  const profilePerson = useMemo<ConversationPerson | null>(() => profileContact ? {
    id: profileContact.id, profileId: profileContact.id, profileType: 'contact', smsContactId: profileContact.id,
    name: `${profileContact.first_name} ${profileContact.last_name}`.trim(), phone: '', email: '', student: '', stage: '',
  } : null, [profileContact])

  useEffect(() => {
    const tenantId = getActiveTenantId()
    if (isFundingDemoTenant(tenantId)) {
      setCases(loadDemoFunding(tenantId).cases)
      setDataSource('demo')
      return
    }
    let active = true
    fetch(`/api/funding/cases?tenant=${encodeURIComponent(tenantId)}`)
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body?.error || 'Could not load funded students.')
        if (!Array.isArray(body)) throw new Error('Funded students returned an invalid response.')
        if (active) {
          setCases(body)
          setDataSource('persisted')
        }
      })
      .catch(error => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Could not load funded students.')
          setCases([])
          setDataSource('unavailable')
        }
      })
    return () => { active = false }
  }, [])

  const needsReviewCount = cases.filter(item => item.status === 'needs_review').length
  const waitingCount = cases.filter(item => item.status === 'waiting').length
  const visibleCases = useMemo(() => {
    const filtered = studentFilter === 'all' ? cases : cases.filter(item => item.status === studentFilter)
    return [...filtered].sort((a, b) => compareCases(a, b, caseSort))
  }, [studentFilter, caseSort, cases])

  const replaceCase = (updated: FundingCase) => {
    if (dataSource === 'demo') saveDemoFundingCase(getActiveTenantId(), updated)
    setCases(current => current.map(item => item.id === updated.id ? updated : item))
    setContactPanel(current => current?.fundingCase.id === updated.id ? { ...current, fundingCase: updated } : current)
  }

  // The shared host owns live detail/permission loading; fictional cases never use it.
  const openContactPanel = (item: FundingCase) => {
    if (dataSource === 'demo') {
      const family = item.contacts.find(contact => contact.purpose === 'family_contact')
      setContactPanel({ fundingCase: item, contact: {
        id: item.studentPersonId || item.id, tenant_id: getActiveTenantId(), is_student: true, first_name: item.student.split(' ')[0], last_name: item.student.split(' ').slice(1).join(' '),
        phone: null, email: null, client_status: item.missingDetails.length ? 'pending' : 'active', opted_out: false, last_attended: null,
        notes: 'Fictional funding demo student.', family_name: item.parent, account_holder_name: item.parent,
        account_holder_phone: family?.phone || null, account_holder_email: family?.email || null, custom_fields: { funded: true }, is_minor: true,
      } })
      return
    }
    if (!item.studentPersonId) {
      setActionError('This funded student is not linked to a contact record yet.')
      return
    }
    setActionError('')
    setContactPanel({ fundingCase: item, contact: {
      id: item.studentPersonId, first_name: item.student.split(' ')[0], last_name: item.student.split(' ').slice(1).join(' '),
      phone: null, email: null, client_status: 'active', opted_out: false, last_attended: null, notes: null,
      family_name: null, account_holder_name: null, account_holder_phone: null, account_holder_email: null, custom_fields: {},
    } })
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
      if (body?.id !== invoiceEdit.caseId || !Array.isArray(body.invoices)) throw new Error('Invoice update returned an invalid funding case.')
      replaceCase(body)
      return
    }
    const changedAt = new Date().toISOString()
    const item = cases.find(item => item.id === invoiceEdit.caseId)
    if (item) {
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
      const updated = recalculateDemoFundingCase(recalculateFixtureCase({ ...item, invoices, updatedAt: changedAt }, input.status, input.note || input.evidence))
      replaceCase(updated)
    }
  }

  const caseColumns: DataTableColumn<FundingCase, CaseSortKey>[] = [
    {
      id: 'student', header: 'Student', width: 'minmax(180px, 1.1fr)', sortable: true, sortKey: 'student',
      render: item => (
        <div style={{ minWidth: 0 }}>
          <PersonName>{item.student}</PersonName>
        </div>
      ),
    },
    { id: 'organization', header: 'Funding organization', width: 'minmax(190px, 1.2fr)', sortable: true, sortKey: 'organization', render: item => <div><div style={{ fontWeight: typography.weightMedium }}>{item.fundingOrganization}</div><div style={secondaryTextStyle}>{item.programType}</div></div> },
    { id: 'status', header: 'Status', width: '150px', sortable: true, sortKey: 'status', render: item => <FundingStatusBadge item={item} /> },
    { id: 'nextStep', header: 'Suggested next step', width: 'minmax(240px, 1.5fr)', render: item => <div><div>{item.nextStep}</div><div style={secondaryTextStyle}>Waiting on {item.owner}</div></div> },
    { id: 'dueDate', header: 'Due', width: '125px', sortable: true, sortKey: 'dueDate', render: item => item.dueDate ? formatDate(item.dueDate) : '—' },
    { id: 'outstanding', header: 'Outstanding', width: '125px', align: 'right', sortable: true, sortKey: 'outstanding', defaultSortDirection: 'desc', render: item => <span style={{ fontWeight: typography.weightSemibold }}>{formatCurrency(item.outstanding)}</span> },
  ]

  const studentTabs = [
    { key: 'needs_review' as const, label: 'Action needed', count: needsReviewCount },
    { key: 'waiting' as const, label: 'Payment pending', count: waitingCount },
    { key: 'all' as const, label: 'All students', count: cases.length },
  ]

  return (
    <div style={{ padding: isMobile ? spacing.lg : spacing['3xl'], width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <PageHeader
        title="Funded Students"
        subtitle="Track student authorizations, invoices, and the work that needs attention."
        right={dataSource === 'demo' ? <Button variant="secondary" onClick={() => {
          const tenantId = getActiveTenantId()
          resetDemoFunding(tenantId)
          setCases(loadDemoFunding(tenantId).cases)
          setContactPanel(null)
          setInvoiceEdit(null)
        }}>Reset demo data</Button> : <Button onClick={() => { setPreferredProgramId(null); setShowNewCase(true) }} disabled={dataSource !== 'persisted'}>Add students</Button>}
      />

      {dataSource === 'demo' && <Notice variant="info" title="Interactive funding demo" style={{ marginBottom: spacing.lg }}>Fictional students, invoices and program rules for testing. Edits stay in this browser session; no real payer submission or payment occurs.</Notice>}
      {dataSource !== 'loading' && dataSource !== 'unavailable' && <FundingSummary cases={cases} />}

      {dataSource === 'unavailable' && (
        <Notice variant="warning" title="Funding data unavailable" style={{ marginBottom: spacing.lg }}>
          No prototype students are shown. Apply funding migrations through Migration 024 and ensure this account has funding permissions to load persisted tenant records. {loadError}
        </Notice>
      )}

      {actionError && (
        <Notice variant="warning" title="Could not open that student" style={{ marginBottom: spacing.lg }}>{actionError}</Notice>
      )}

      <div style={{ overflowX: 'auto', marginBottom: spacing.md }}>
        <Tabs items={studentTabs} activeKey={studentFilter} onChange={setStudentFilter} compact={isMobile} style={isMobile ? { minWidth: 360 } : undefined} />
      </div>
      <RichDataTable
        preferenceSchema={FUNDING_TABLE_SCHEMA}
        preferenceState={tablePreferences}
        rows={visibleCases}
        columns={caseColumns}
        getRowKey={item => item.id}
        sort={caseSort}
        onSortChange={nextSort => { setCaseSort(nextSort); tablePreferences.updatePreferences({ ...tablePreferences.preferences, sort: nextSort }) }}
        emptyContent="No funded students in this view."
        onRowClick={item => void openContactPanel(item)}
        loading={dataSource === 'loading'}
        ariaLabel="Funded Students"
      />

      {contactPanel && profilePerson && (dataSource === 'demo' ? <LiveContactPanel
          key={contactPanel.contact.id}
          subject={{ kind: 'student', person: contactPanel.contact }} tenantId={getActiveTenantId()}
          capabilities={{ edit: false, readNotes: false, editNotes: false }} initialNotesTab="notes" fundingOnly
          fundingCase={contactPanel.fundingCase} onFundingCaseUpdated={replaceCase}
          onInvoiceStatusChange={invoice => setInvoiceEdit({ caseId: contactPanel.fundingCase.id, invoice })}
          onClose={demoHistory.closePanel} onUpdated={() => {}} onAccountUpdated={() => {}} onNotesUpdated={() => {}} onOpenStudent={() => {}}
        /> : <ConversationProfilePanel
          key={contactPanel.contact.id}
          person={profilePerson} tenantId={getActiveTenantId()}
          fundingCase={contactPanel.fundingCase}
          onClose={() => setContactPanel(null)}
          onCompose={channel => router.push(conversationComposeHref(getActiveTenantId(), profilePerson.id, channel))}
          onInvoiceStatusChange={invoice => setInvoiceEdit({ caseId: contactPanel.fundingCase.id, invoice })}
          onFundingCaseUpdated={replaceCase}
        />
      )}

      <InvoiceStatusModal invoice={invoiceEdit?.invoice || null} onClose={() => setInvoiceEdit(null)} onSave={updateInvoiceStatus} />
      <NewFundedCaseModal
        isOpen={showNewCase}
        preferredProgramId={preferredProgramId}
        onClose={() => { setShowNewCase(false); setPreferredProgramId(null) }}
        onCreated={fundingCase => {
          setCases(current => [fundingCase, ...current])
          setStudentFilter('all')
          void openContactPanel(fundingCase)
        }}
        onManagePrograms={() => router.push('/dashboard/funding/programs')}
      />
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

const secondaryTextStyle: React.CSSProperties = { color: colors.textMuted, fontSize: typography.sizeXs, marginTop: spacing.xs }