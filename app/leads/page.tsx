'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { Badge, Button, CompactMetaCard, DataGridRow, DataGridTable, DenseSectionPanel, DetailField, EmptyState, FieldLabel, Input, NotesSection, PageHeader, SectionTitle, Select, SlidePanel, SlidePanelHeader, Tabs, Textarea } from '@/components/ui'
import { colors, radius, spacing, typography } from '@/lib/tokens'

type LeadTabKey = 'lesson_inquiry' | 'service_inquiry'
type LeadDetailPanelTabKey = 'details' | 'notes_activity'

type ManualLeadFormState = {
  fullName: string
  email: string
  phone: string
  intakeType: 'lesson_inquiry' | 'service_inquiry'
  sourceForm: 'manual-phone-call' | 'manual-walk-in' | 'manual-traffic-visitor' | 'manual-referral' | 'manual-other'
  programLabel: string
  serviceLabel: string
  familyInterestedCount: number
  referrer: string
  message: string
}

type LeadRecord = {
  id: string
  tenant_id: string
  contact_id: string
  intake_type: string
  source_system: string
  source_form: string
  source_page: string | null
  program_label: string | null
  service_label: string | null
  category: string
  status: string
  priority: string
  temperature: string
  created_at: string
  updated_at: string
  contact?: {
    id: string
    full_name: string
    email: string | null
    phone: string | null
  } | null
}

type LeadDetail = LeadRecord & {
  payload: Record<string, unknown>
  contact?: {
    id: string
    full_name: string
    email: string | null
    phone: string | null
    notes: string | null
  } | null
  events: Array<{
    id: string
    event_type: string
    event_label: string | null
    payload: Record<string, unknown>
    created_at: string
  }>
  notes_history?: Array<{
    text: string
    timestamp: string
  }>
}

type LessonSiblingEntry = {
  name: string
  age: string
  instrument_interest: string
}

type LessonOpportunityState = {
  familyLabel: string
  baseValue: string
  siblingDiscountEnabled: boolean
  siblings: LessonSiblingEntry[]
}

const STATUS_OPTIONS = ['all', 'new', 'contacted', 'booked', 'won', 'lost', 'spam', 'ghosted_us']
const DETAIL_STATUS_OPTIONS = ['new', 'contacted', 'booked', 'won', 'lost', 'spam', 'ghosted_us']
const DEFAULT_LESSON_BASE_VALUE = 160
const LESSON_INSTRUMENT_OPTIONS = ['Piano', 'Voice', 'Guitar', 'Violin', 'Drums', 'Ukulele', 'Bass', 'Cello', 'Saxophone', 'Flute', 'Clarinet', 'Trumpet', 'Other']
const MANUAL_PROGRAM_OR_INSTRUMENT_OPTIONS = LESSON_INSTRUMENT_OPTIONS
const LEAD_TABS: Array<{ key: LeadTabKey, label: string }> = [
  { key: 'lesson_inquiry', label: 'Lesson requests' },
  { key: 'service_inquiry', label: 'Service inquiries' },
]

const MANUAL_LEAD_SOURCE_OPTIONS: Array<{ value: ManualLeadFormState['sourceForm'], label: string }> = [
  { value: 'manual-phone-call', label: 'Phone call' },
  { value: 'manual-walk-in', label: 'Walk-in' },
  { value: 'manual-traffic-visitor', label: 'Website visitor' },
  { value: 'manual-referral', label: 'Referral' },
  { value: 'manual-other', label: 'Other' },
]

const MOBILE_BREAKPOINT_PX = 960
const LEAD_DETAIL_PANEL_TABS: Array<{ key: LeadDetailPanelTabKey, label: string }> = [
  { key: 'details', label: 'Details' },
  { key: 'notes_activity', label: 'Notes & activity' },
]

function createInitialManualLeadForm(activeTab: LeadTabKey): ManualLeadFormState {
  return {
    fullName: '',
    email: '',
    phone: '',
    intakeType: activeTab === 'service_inquiry' ? 'service_inquiry' : 'lesson_inquiry',
    sourceForm: 'manual-phone-call',
    programLabel: '',
    serviceLabel: '',
    familyInterestedCount: 1,
    referrer: '',
    message: '',
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatLabel(value: string | null | undefined) {
  if (!value) return '—'
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatSourcePage(value: string | null | undefined, fallback?: string | null) {
  if (fallback) return fallback
  if (!value) return '—'
  const cleaned = value.replace(/^\//, '').split('/').filter(Boolean)
  if (cleaned.length === 0) return 'Home'
  return cleaned
    .map((part) => part.replace(/-/g, ' '))
    .map((part) => part.replace(/\b\w/g, (char) => char.toUpperCase()))
    .join(' · ')
}

function formatActivity(eventType: string, eventLabel: string | null) {
  if (eventType === 'created') return 'Lead created'
  if (eventType === 'updated') return 'Lead updated'
  if (eventType === 'contact_updated') return 'Contact updated'
  if (eventType === 'note_added') return 'Note added'
  return eventLabel || formatLabel(eventType)
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function parseJsonSafely<T>(response: Response): Promise<T | { raw: string } | null> {
  const text = await response.text()

  if (!text) return null

  try {
    return JSON.parse(text) as T
  } catch {
    return { raw: text }
  }
}

async function fetchJsonWithTimeout<T>(input: string, init?: RequestInit, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController()
  const timeoutHandle = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(input, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
    })

    const data = await parseJsonSafely<T>(response)

    if (!response.ok) {
      const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed with status ${response.status}`

      throw new Error(message)
    }

    return data as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`)
    }

    throw error
  } finally {
    window.clearTimeout(timeoutHandle)
  }
}

function normalizeSiblingEntry(value: unknown): LessonSiblingEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const raw = value as Record<string, unknown>
  return {
    name: typeof raw.name === 'string' ? raw.name : '',
    age: typeof raw.age === 'string' ? raw.age : '',
    instrument_interest: typeof raw.instrument_interest === 'string' ? raw.instrument_interest : '',
  }
}

function getLessonOpportunityState(lead: LeadDetail | null): LessonOpportunityState {
  const payload = lead?.payload || {}
  const siblings = Array.isArray(payload.siblings)
    ? payload.siblings.map(normalizeSiblingEntry).filter((entry): entry is LessonSiblingEntry => Boolean(entry))
    : []

  return {
    familyLabel: typeof payload.family_label === 'string'
      ? payload.family_label
      : typeof payload.parent_name === 'string'
        ? payload.parent_name
        : '',
    baseValue: typeof payload.potential_value_base === 'number'
      ? String(payload.potential_value_base)
      : typeof payload.potential_value_base === 'string'
        ? payload.potential_value_base
        : String(DEFAULT_LESSON_BASE_VALUE),
    siblingDiscountEnabled: typeof payload.discount_offer_applied === 'boolean'
      ? payload.discount_offer_applied
      : true,
    siblings,
  }
}

function parseCurrency(value: string): number {
  const parsed = Number(value.replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function getStartOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function isWeekendDay(value: Date) {
  const day = value.getDay()
  return day === 0 || day === 6
}

function getBusinessDaysBetween(start: Date, end: Date) {
  const startDay = getStartOfLocalDay(start)
  const endDay = getStartOfLocalDay(end)

  if (endDay.getTime() <= startDay.getTime()) return 0

  const cursor = new Date(startDay)
  let businessDays = 0

  while (cursor.getTime() < endDay.getTime()) {
    cursor.setDate(cursor.getDate() + 1)
    if (!isWeekendDay(cursor)) businessDays += 1
  }

  return businessDays
}

function getLeadSignal(lead: LeadRecord) {
  const createdAt = new Date(lead.created_at)
  const updatedAt = new Date(lead.updated_at)
  const createdAtMs = createdAt.getTime()
  const updatedAtMs = updatedAt.getTime()
  const now = new Date()
  const nowMs = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const ageMs = nowMs - createdAtMs
  const contactLagMs = Math.max(0, updatedAtMs - createdAtMs)
  const sinceLastUpdateMs = Math.max(0, nowMs - updatedAtMs)
  const firstFollowUpBusinessDays = getBusinessDaysBetween(createdAt, updatedAt)
  const businessDaysSinceLastUpdate = getBusinessDaysBetween(updatedAt, now)

  if (lead.status === 'won') {
    return { emoji: '🏆', label: 'Won' }
  }

  if (lead.status === 'lost') {
    return { emoji: '💀', label: 'Lost' }
  }

  if (lead.status === 'ghosted_us') {
    return { emoji: '👻', label: 'Ghosted us' }
  }

  if (lead.status === 'booked') {
    return { emoji: '🔥🔥', label: 'Booked and close to converting' }
  }

  if (lead.status === 'contacted') {
    const contactedQuickly = contactLagMs <= dayMs || firstFollowUpBusinessDays <= 1
    if (contactedQuickly && businessDaysSinceLastUpdate <= 2) {
      return { emoji: '🔥🧊', label: 'Contacted quickly and still moving' }
    }
    return { emoji: '🧊🧊', label: 'Contacted but stale' }
  }

  if (lead.status === 'new') {
    if (lead.temperature === 'hot' || ageMs <= dayMs) {
      return { emoji: '🔥🔥', label: 'New and needs fast follow-up' }
    }
    if (ageMs <= 3 * dayMs) {
      return { emoji: '🔥🧊', label: 'New, but cooling' }
    }
    return { emoji: '🧊🧊', label: 'Still uncontacted' }
  }

  if (lead.status === 'spam') {
    return { emoji: '🧊🧊', label: 'Not a real opportunity' }
  }

  return sinceLastUpdateMs <= 7 * dayMs
    ? { emoji: '🔥🧊', label: 'Active lead' }
    : { emoji: '🧊🧊', label: 'Cold lead' }
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [tabCounts, setTabCounts] = useState<Record<LeadTabKey, number>>({
    lesson_inquiry: 0,
    service_inquiry: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeTab, setActiveTab] = useState<LeadTabKey>('lesson_inquiry')
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null)
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false)
  const [manualLeadForm, setManualLeadForm] = useState<ManualLeadFormState>(() => createInitialManualLeadForm('lesson_inquiry'))
  const [manualLeadError, setManualLeadError] = useState('')
  const [manualLeadSaving, setManualLeadSaving] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailSaving, setDetailSaving] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [statusValue, setStatusValue] = useState('new')
  const [notesValue, setNotesValue] = useState('')
  const [showStatusEditor, setShowStatusEditor] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const [detailPanelTab, setDetailPanelTab] = useState<LeadDetailPanelTabKey>('details')
  const [lessonOpportunity, setLessonOpportunity] = useState<LessonOpportunityState>({
    familyLabel: '',
    baseValue: String(DEFAULT_LESSON_BASE_VALUE),
    siblingDiscountEnabled: true,
    siblings: [],
  })

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      params.set('intake_type', activeTab)

      const data = await fetchJsonWithTimeout<LeadRecord[]>(`/api/leads?${params.toString()}`)

      setLeads(Array.isArray(data) ? data : [])
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Could not load leads'))
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [activeTab, statusFilter])

  const fetchTabCounts = useCallback(async () => {
    try {
      const counts = await Promise.all(
        LEAD_TABS.map(async (tab) => {
          const params = new URLSearchParams()
          if (statusFilter !== 'all') params.set('status', statusFilter)
          params.set('intake_type', tab.key)

          const data = await fetchJsonWithTimeout<LeadRecord[]>(`/api/leads?${params.toString()}`)

          return [tab.key, Array.isArray(data) ? data.length : 0] as const
        }),
      )

      setTabCounts({
        lesson_inquiry: 0,
        service_inquiry: 0,
        ...Object.fromEntries(counts),
      })
    } catch {
      setTabCounts({
        lesson_inquiry: 0,
        service_inquiry: 0,
      })
    }
  }, [statusFilter])

  const toggleLeadSelection = (leadId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(leadId)) next.delete(leadId)
      else next.add(leadId)
      return next
    })
  }

  const toggleSelectAllVisible = () => {
    setSelectedIds((current) => {
      const visibleIds = leads.map((lead) => lead.id)
      const allSelected = visibleIds.every((id) => current.has(id))
      const next = new Set(current)

      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id))
      } else {
        visibleIds.forEach((id) => next.add(id))
      }

      return next
    })
  }

  const openDeleteModal = () => {
    setDeleteError('')
    setDeletePassword('')
    setIsDeleteOpen(true)
  }

  const closeDeleteModal = () => {
    if (deleteLoading) return
    setIsDeleteOpen(false)
    setDeleteError('')
    setDeletePassword('')
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return

    setDeleteLoading(true)
    setDeleteError('')

    try {
      await fetchJsonWithTimeout<{ success: true }>(`/api/leads`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), password: deletePassword }),
      })

      if (selectedLeadId && selectedIds.has(selectedLeadId)) closeLead()
      setSelectedIds(new Set())
      setIsDeleteOpen(false)
      setDeletePassword('')
      await Promise.all([fetchLeads(), fetchTabCounts()])
    } catch (error: unknown) {
      setDeleteError(getErrorMessage(error, 'Could not delete leads'))
    } finally {
      setDeleteLoading(false)
    }
  }

  const fetchLeadDetail = async (leadId: string) => {
    setDetailLoading(true)
    setDetailError('')
    try {
      const data = await fetchJsonWithTimeout<LeadDetail>(`/api/leads/${leadId}`)
      setSelectedLead(data)
      setStatusValue(data.status || 'new')
      setNotesValue(data.contact?.notes || '')
      setShowStatusEditor(false)
      setLessonOpportunity(getLessonOpportunityState(data))
    } catch (error: unknown) {
      setDetailError(getErrorMessage(error, 'Could not load lead'))
    } finally {
      setDetailLoading(false)
    }
  }

  const openLead = async (leadId: string) => {
    setSelectedLeadId(leadId)
    await fetchLeadDetail(leadId)
  }

  const openAddLead = () => {
    setManualLeadError('')
    setManualLeadForm(createInitialManualLeadForm(activeTab))
    setIsAddLeadOpen(true)
  }

  const closeAddLead = () => {
    if (manualLeadSaving) return
    setIsAddLeadOpen(false)
    setManualLeadError('')
  }

  const updateManualLeadField = <K extends keyof ManualLeadFormState>(field: K, value: ManualLeadFormState[K]) => {
    setManualLeadForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'intakeType'
        ? {
            programLabel: value === 'lesson_inquiry' ? current.programLabel : '',
            serviceLabel: value === 'service_inquiry' ? current.serviceLabel : '',
          }
        : null),
    }))
  }

  const handleCreateLead = async () => {
    setManualLeadSaving(true)
    setManualLeadError('')

    try {
      const payload: Record<string, unknown> = {}
      const trimmedMessage = manualLeadForm.message.trim()
      if (trimmedMessage) payload.message = trimmedMessage
      if (manualLeadForm.intakeType === 'lesson_inquiry') payload.family_members_interested = manualLeadForm.familyInterestedCount

      const response = await fetchJsonWithTimeout<{ lead_intake_id?: string }>(`/api/intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intake_type: manualLeadForm.intakeType,
          source_system: 'pulse-manual',
          source_form: manualLeadForm.sourceForm,
          source_page: null,
          full_name: manualLeadForm.fullName.trim(),
          email: manualLeadForm.email.trim() || null,
          phone: manualLeadForm.phone.trim() || null,
          program_label: manualLeadForm.intakeType === 'lesson_inquiry' ? manualLeadForm.programLabel.trim() || null : null,
          service_label: manualLeadForm.intakeType === 'service_inquiry' ? manualLeadForm.serviceLabel.trim() || null : null,
          referrer: manualLeadForm.referrer.trim() || null,
          payload,
        }),
      })

      await Promise.all([fetchLeads(), fetchTabCounts()])
      setIsAddLeadOpen(false)
      setManualLeadForm(createInitialManualLeadForm(activeTab))

      if (response.lead_intake_id) {
        if (manualLeadForm.intakeType !== activeTab) setActiveTab(manualLeadForm.intakeType)
        await openLead(response.lead_intake_id)
      }
    } catch (error: unknown) {
      setManualLeadError(getErrorMessage(error, 'Could not create lead'))
    } finally {
      setManualLeadSaving(false)
    }
  }

  const handleInlineStatusChange = async (nextStatus: string) => {
    setStatusValue(nextStatus)
    await saveDetail({ status: nextStatus })
  }

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email)
    } catch (error) {
      console.error('Could not copy email', error)
    }
  }

  const closeLead = () => {
    setSelectedLeadId(null)
    setSelectedLead(null)
    setDetailError('')
    setShowStatusEditor(false)
    setDetailPanelTab('details')
    setLessonOpportunity({
      familyLabel: '',
      baseValue: String(DEFAULT_LESSON_BASE_VALUE),
      siblingDiscountEnabled: true,
      siblings: [],
    })
  }

  const saveDetail = async (extra: { add_note?: string, status?: string, payload?: Record<string, unknown> } = {}) => {
    if (!selectedLeadId) return
    setDetailSaving(true)
    setDetailError('')
    try {
      const data = await fetchJsonWithTimeout<LeadDetail>(`/api/leads/${selectedLeadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: statusValue,
          notes: notesValue,
          ...extra,
        }),
      })

      setSelectedLead(data)
      setNotesValue(data.contact?.notes || '')
      setShowStatusEditor(false)
      setLessonOpportunity(getLessonOpportunityState(data))
      setLeads((current) => current.map((lead) => (
        lead.id === selectedLeadId
          ? {
              ...lead,
              status: data.status,
              updated_at: data.updated_at,
              contact: data.contact
                ? {
                    id: data.contact.id,
                    full_name: data.contact.full_name,
                    email: data.contact.email,
                    phone: data.contact.phone,
                  }
                : lead.contact,
            }
          : lead
      )))
    } catch (error: unknown) {
      setDetailError(getErrorMessage(error, 'Could not save lead'))
    } finally {
      setDetailSaving(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  useEffect(() => {
    fetchTabCounts()
  }, [fetchTabCounts])

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`)

    const syncLayout = (matches: boolean) => {
      setIsMobileLayout(matches)
    }

    syncLayout(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => syncLayout(event.matches)
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  useEffect(() => {
    if (selectedLead && selectedLead.intake_type !== activeTab) {
      closeLead()
    }
  }, [activeTab, selectedLead])

  useEffect(() => {
    if (!isMobileLayout) setDetailPanelTab('details')
  }, [isMobileLayout])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [activeTab, statusFilter])

  const leadTabItems = useMemo(
    () => LEAD_TABS.map((tab) => ({ key: tab.key, label: tab.label, count: tabCounts[tab.key] ?? 0 })),
    [tabCounts],
  )

  const subtitle = useMemo(() => {
    if (loading) return 'Loading leads...'
    return `${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}`
  }, [loading, leads.length])
  const selectedCount = selectedIds.size
  const allVisibleSelected = leads.length > 0 && leads.every((lead) => selectedIds.has(lead.id))

  const selectedLeadType = selectedLead ? formatLabel(selectedLead.intake_type) : 'Loading lead...'
  const selectedProgram = selectedLead ? formatSourcePage(selectedLead.source_page, selectedLead.program_label || selectedLead.service_label) : 'Loading...'
  const selectedInitial = (selectedLead?.contact?.full_name || 'L').charAt(0).toUpperCase()
  const selectedLeadSignal = selectedLead ? getLeadSignal(selectedLead) : null
  const lessonInstrument = typeof selectedLead?.payload?.instrument === 'string' ? selectedLead.payload.instrument : (selectedLead?.program_label || '—')
  const prospectAge = (() => {
    const payload = selectedLead?.payload
    const candidates = [
      payload?.age,
      payload?.student_age,
      payload?.child_age,
      payload?.prospect_age,
    ]

    const match = candidates.find((value) => typeof value === 'string' || typeof value === 'number')
    if (typeof match === 'number') return `${match} y.o`
    if (typeof match === 'string' && match.trim()) return `${match.trim()} y.o`
    return '—'
  })()
  const lessonDays = Array.isArray(selectedLead?.payload?.preferred_days)
    ? selectedLead?.payload?.preferred_days.join(', ')
    : '—'
  const lessonTimes = Array.isArray(selectedLead?.payload?.preferred_times)
    ? selectedLead?.payload?.preferred_times.join(', ')
    : '—'
  const serviceMessage = typeof selectedLead?.payload?.message === 'string' ? selectedLead.payload.message : '—'
  const applicationPositions = Array.isArray(selectedLead?.payload?.positions)
    ? selectedLead?.payload?.positions.join(', ')
    : '—'
  const applicationAvailability = Array.isArray(selectedLead?.payload?.availability)
    ? selectedLead?.payload?.availability.join(', ')
    : '—'
  const applicationExperience = typeof selectedLead?.payload?.experience === 'string' ? selectedLead.payload.experience : '—'
  const applicationSightReading = typeof selectedLead?.payload?.sight_reading === 'string' ? selectedLead.payload.sight_reading : '—'
  const applicationResume = typeof selectedLead?.payload?.resume_link === 'string' ? selectedLead.payload.resume_link : '—'
  const applicationMessage = typeof selectedLead?.payload?.message === 'string' ? selectedLead.payload.message : '—'
  const lessonBaseValue = parseCurrency(lessonOpportunity.baseValue)
  const lessonSiblingCount = lessonOpportunity.siblings.length
  const lessonOpportunityTotal = lessonBaseValue <= 0
    ? 0
    : lessonBaseValue + lessonOpportunity.siblings.reduce(
      (sum) => sum + (lessonOpportunity.siblingDiscountEnabled ? lessonBaseValue * 0.9 : lessonBaseValue),
      0,
    )
  const lessonSiblingDiscountLabel = lessonOpportunity.siblingDiscountEnabled ? '10% sibling offer applied' : 'No sibling offer applied'
  const detailPanelTabItems = useMemo(() => LEAD_DETAIL_PANEL_TABS, [])

  const leadDetailPrimaryContent = selectedLead ? (
    <div style={isMobileLayout ? mobileLeadDetailSectionStyle : leadDetailLeftColumnStyle}>
      <div style={isMobileLayout ? quickActionStackStyle : quickActionRowStyle}>
        {selectedLead.contact?.email && (
          <QuickChip
            label={selectedLead.contact.email}
            width="wide"
            href={`mailto:${selectedLead.contact.email}`}
            action={(
              <button
                type="button"
                aria-label="Copy email address"
                onClick={(event) => {
                  event.stopPropagation()
                  void handleCopyEmail(selectedLead.contact!.email!)
                }}
                style={quickChipIconButtonStyle}
              >
                <Copy size={16} />
              </button>
            )}
            fullWidth={isMobileLayout}
            align={isMobileLayout ? 'start' : 'center'}
          />
        )}
        {selectedLead.contact?.phone && (
          <QuickChip
            label={selectedLead.contact.phone}
            width="wide"
            href={`tel:${selectedLead.contact.phone}`}
            fullWidth={isMobileLayout}
            align={isMobileLayout ? 'start' : 'center'}
          />
        )}
        {selectedLead.intake_type === 'lesson_inquiry' && (
          <QuickChip
            label={prospectAge}
            width="narrow"
            fullWidth={isMobileLayout}
            align={isMobileLayout ? 'start' : 'center'}
          />
        )}
      </div>

      {selectedLead.intake_type === 'lesson_inquiry' && (
        <>
          <DenseSectionPanel title={<SectionTitle style={sectionTitleMiniStyle}>Lesson details</SectionTitle>} style={editorialSectionPanelStyle} contentStyle={sectionContentStyle}>
            <div style={isMobileLayout ? editorialDetailsGridMobileStyle : editorialDetailsGridStyle}>
              <Detail label="Instrument" value={lessonInstrument} />
              <Detail label="Experience" value={typeof selectedLead.payload?.experience === 'string' ? selectedLead.payload.experience : '—'} />
              <Detail label="Preferred days" value={lessonDays} />
              <Detail label="Preferred times" value={lessonTimes} />
            </div>
          </DenseSectionPanel>

          <DenseSectionPanel
            title={(
              <div>
                <SectionTitle style={sectionTitleMiniStyle}>Family members</SectionTitle>
                <label style={checkboxRowStyle}>
                  <input
                    type="checkbox"
                    checked={lessonOpportunity.siblingDiscountEnabled}
                    onChange={(e) => setLessonOpportunity((current) => ({ ...current, siblingDiscountEnabled: e.target.checked }))}
                  />
                  Apply 10% sibling offer
                </label>
              </div>
            )}
            actions={(
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setLessonOpportunity((current) => ({
                  ...current,
                  siblings: [...current.siblings, { name: '', age: '', instrument_interest: '' }],
                }))}
              >
                Add family member
              </Button>
            )}
            style={editorialSectionPanelStyle}
            contentStyle={sectionContentStyle}
          >
            <div style={siblingsWrapStyle}>
              {lessonOpportunity.siblings.length === 0 && (
                <div style={emptySiblingStateStyle}>No siblings added yet.</div>
              )}

              {lessonOpportunity.siblings.map((sibling, index) => {
                const siblingInstrumentOptions = sibling.instrument_interest && !LESSON_INSTRUMENT_OPTIONS.includes(sibling.instrument_interest)
                  ? [sibling.instrument_interest, ...LESSON_INSTRUMENT_OPTIONS]
                  : LESSON_INSTRUMENT_OPTIONS

                return (
                  <div key={index} style={siblingCardStyle}>
                    <div style={siblingCardHeaderStyle}>
                      <div style={siblingLabelStyle}>Sibling {index + 1}</div>
                      <button
                        type="button"
                        onClick={() => setLessonOpportunity((current) => ({
                          ...current,
                          siblings: current.siblings.filter((_, siblingIndex) => siblingIndex !== index),
                        }))}
                        style={removeSiblingButtonStyle}
                      >
                        Remove
                      </button>
                    </div>

                    <div style={isMobileLayout ? siblingGridMobileStyle : siblingGridStyle}>
                      <div style={{ minWidth: 0 }}>
                        <FieldLabel style={detailFieldLabelStyle}>Name</FieldLabel>
                        <input
                          value={sibling.name}
                          onChange={(e) => setLessonOpportunity((current) => ({
                            ...current,
                            siblings: current.siblings.map((entry, siblingIndex) => siblingIndex === index ? { ...entry, name: e.target.value } : entry),
                          }))}
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <FieldLabel style={detailFieldLabelStyle}>Age</FieldLabel>
                        <input
                          value={sibling.age}
                          onChange={(e) => setLessonOpportunity((current) => ({
                            ...current,
                            siblings: current.siblings.map((entry, siblingIndex) => siblingIndex === index ? { ...entry, age: e.target.value } : entry),
                          }))}
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <FieldLabel style={detailFieldLabelStyle}>Instrument interest</FieldLabel>
                        <Select
                          value={sibling.instrument_interest}
                          onChange={(e) => setLessonOpportunity((current) => ({
                            ...current,
                            siblings: current.siblings.map((entry, siblingIndex) => siblingIndex === index ? { ...entry, instrument_interest: e.target.value } : entry),
                          }))}
                          style={inputStyle}
                        >
                          <option value="">Select instrument</option>
                          {siblingInstrumentOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={sectionFooterActionsStyle}>
              <Button
                variant="secondary"
                onClick={() => saveDetail({
                  payload: {
                    potential_value_base: lessonBaseValue,
                    potential_value_total: Math.round(lessonOpportunityTotal),
                    discount_offer_applied: lessonOpportunity.siblingDiscountEnabled,
                    sibling_count: lessonSiblingCount,
                    siblings: lessonOpportunity.siblings,
                  },
                })}
                disabled={detailSaving}
              >
                {detailSaving ? 'Saving…' : 'Save family member'}
              </Button>
            </div>
          </DenseSectionPanel>
        </>
      )}

      {selectedLead.intake_type !== 'lesson_inquiry' && (
        <>
          {selectedLead.intake_type === 'service_inquiry' && (
            <>
              <DenseSectionPanel title={<SectionTitle style={sectionTitleMiniStyle}>Service details</SectionTitle>} style={editorialSectionPanelStyle} contentStyle={sectionContentStyle}>
                <div style={isMobileLayout ? editorialDetailsGridMobileStyle : editorialDetailsGridStyle}>
                  <Detail label="Service" value={selectedLead.service_label || '—'} />
                  <Detail label="Source" value={formatLabel(selectedLead.source_form)} />
                  <Detail label="Source / channel" value={selectedProgram} />
                  <Detail label="Priority" value={formatLabel(selectedLead.priority)} />
                </div>
              </DenseSectionPanel>

              <DenseSectionPanel title={<SectionTitle style={sectionTitleMiniStyle}>Message</SectionTitle>} style={editorialSectionPanelStyle} contentStyle={sectionContentStyle}>
                <div style={messageCardBodyStyle}>{serviceMessage}</div>
              </DenseSectionPanel>
            </>
          )}

          {selectedLead.intake_type === 'job_application' && (
            <>
              <DenseSectionPanel title={<SectionTitle style={sectionTitleMiniStyle}>Application details</SectionTitle>} style={editorialSectionPanelStyle} contentStyle={sectionContentStyle}>
                <div style={isMobileLayout ? editorialDetailsGridMobileStyle : editorialDetailsGridStyle}>
                  <Detail label="Positions" value={applicationPositions} />
                  <Detail label="Experience" value={applicationExperience} />
                  <Detail label="Sight reading" value={applicationSightReading} />
                  <Detail label="Availability" value={applicationAvailability} />
                  <Detail label="Resume link" value={applicationResume} />
                  <Detail label="Priority" value={formatLabel(selectedLead.priority)} />
                </div>
              </DenseSectionPanel>

              <DenseSectionPanel title={<SectionTitle style={sectionTitleMiniStyle}>Candidate message</SectionTitle>} style={editorialSectionPanelStyle} contentStyle={sectionContentStyle}>
                <div style={messageCardBodyStyle}>{applicationMessage}</div>
              </DenseSectionPanel>
            </>
          )}
        </>
      )}
    </div>
  ) : null

  const leadDetailSecondaryContent = selectedLead ? (
    <div style={isMobileLayout ? mobileLeadDetailSectionStyle : leadDetailRightColumnStyle}>
      <DenseSectionPanel title={<SectionTitle style={sectionTitleMiniStyle}>Notes</SectionTitle>} style={rightRailPanelStyle} contentStyle={sectionContentStyle}>
        <NotesSection
          title="Notes"
          notes={selectedLead.notes_history || []}
          avatarInitial={selectedInitial}
          avatarBg={colors.crimson}
          cardBg={colors.surfaceMuted}
          addLabel="Add note"
          saving={detailSaving}
          helperText="Use notes for call attempts, context, and follow-up details."
          showHeader={false}
          onSave={(text) => saveDetail({ add_note: text })}
        />
      </DenseSectionPanel>

      <DenseSectionPanel title={<SectionTitle style={sectionTitleMiniStyle}>Activity</SectionTitle>} tone="muted" style={rightRailPanelStyle} contentStyle={sectionContentStyle}>
        <div style={activityTableStyle}>
          {selectedLead.events.length === 0 && (
            <div style={emptyActivityStyle}>No activity yet beyond the current lead record.</div>
          )}

          {selectedLead.events.map((event) => (
            <div key={event.id} style={activityRowStyle}>
              <div style={activityTitleCellStyle}>
                <span style={activityBulletStyle} aria-hidden="true" />
                <span style={activityTitleStyle}>{formatActivity(event.event_type, event.event_label)}</span>
              </div>
              <div style={activityTimeStyle}>{formatDateTime(event.created_at)}</div>
            </div>
          ))}
        </div>
      </DenseSectionPanel>
    </div>
  ) : null

  return (
    <>
      <div style={{ padding: spacing['3xl'], width: '100%', maxWidth: '100%' }}>
        <PageHeader
          title="Leads"
          subtitle={subtitle}
          right={(
            <Button type="button" onClick={openAddLead}>
              + Add Lead
            </Button>
          )}
        />

        <Tabs
          items={leadTabItems}
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: spacing.lg }}
        />

        <div style={filterBarStyle}>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={selectStyle}
            fullWidth={false}
            wrapperStyle={filterSelectWrapStyle}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>Status: {option}</option>
            ))}
          </Select>
          {selectedCount > 0 && (
            <div style={bulkActionBarStyle}>
              <span style={bulkActionTextStyle}>{selectedCount} selected</span>
              <Button type="button" variant="destructive" size="sm" onClick={openDeleteModal}>
                Delete leads
              </Button>
            </div>
          )}
        </div>

        {error && <MessageBox>{error}</MessageBox>}

        {!loading && leads.length === 0 ? (
          <EmptyState
            title={`No ${LEAD_TABS.find((tab) => tab.key === activeTab)?.label.toLowerCase() || 'leads'} yet`}
            description="New website inquiries will show up here once your forms start posting to the intake API."
          />
        ) : (
          <div style={tableScrollWrapStyle}>
            <DataGridTable
              columns={tableColumns}
              style={tableWrapStyle}
              header={(
                <>
                  <div>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all visible leads"
                    />
                  </div>
                  <div>Temp</div>
                  <div>Status</div>
                  <div>Name</div>
                  <div>Email</div>
                  <div>Phone</div>
                  <div>{activeTab === 'lesson_inquiry' ? 'Program' : 'Service details'}</div>
                  <div>Created</div>
                </>
              )}
            >
              {leads.map((lead) => {
                const signal = getLeadSignal(lead)
                const isBold = lead.temperature === 'hot' && lead.status === 'new'
                const isSelected = selectedIds.has(lead.id)

                return (
                  <DataGridRow
                    key={lead.id}
                    as="button"
                    columns={tableColumns}
                    onClick={() => openLead(lead.id)}
                    style={{
                      ...tableRowStyle,
                      fontWeight: isBold ? typography.weightSemibold : typography.weightNormal,
                      background: isSelected ? '#F5F8FF' : selectedLeadId === lead.id ? '#FBFCFF' : colors.surface,
                    }}
                  >
                    <div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLeadSelection(lead.id)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Select ${lead.contact?.full_name || 'lead'}`}
                      />
                    </div>
                    <div style={signalCellStyle} title={signal.label}>{signal.emoji}</div>
                    <div>
                      <Badge variant={lead.status === 'new' ? 'info' : lead.status === 'contacted' ? 'warning' : lead.status === 'ghosted_us' || lead.status === 'lost' ? 'error' : lead.status === 'won' ? 'success' : 'neutral'}>
                        {formatLabel(lead.status)}
                      </Badge>
                    </div>
                    <div style={nameCellStyle}>
                      <div style={nameTextStyle}>{lead.contact?.full_name || 'Unknown'}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={cellTextStyle}>{lead.contact?.email || 'No email'}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={cellTextStyle}>{lead.contact?.phone || 'No phone'}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={cellTextStyle}>{formatSourcePage(lead.source_page, lead.program_label || lead.service_label)}</div>
                      <div style={subtleTextStyle}>From {formatLabel(lead.source_form)}</div>
                    </div>
                    <div style={cellTextStyle}>{formatDateTime(lead.created_at)}</div>
                  </DataGridRow>
                )
              })}
            </DataGridTable>
          </div>
        )}
      </div>

      <SlidePanel isOpen={isAddLeadOpen} onClose={closeAddLead} width="min(92vw, 640px)">
        <SlidePanelHeader
          title="Add lead"
          onClose={closeAddLead}
        />
        <div style={manualLeadPanelBodyStyle}>
          {manualLeadError && <MessageBox>{manualLeadError}</MessageBox>}

          <div style={manualLeadFormGridStyle}>
            <Input
              label="Full name"
              value={manualLeadForm.fullName}
              onChange={(event) => updateManualLeadField('fullName', event.target.value)}
              placeholder="Jane Smith"
              error={!manualLeadForm.fullName.trim() ? 'Required' : undefined}
            />
            <Select
              label="Lead type"
              value={manualLeadForm.intakeType}
              onChange={(event) => updateManualLeadField('intakeType', event.target.value as ManualLeadFormState['intakeType'])}
            >
              <option value="lesson_inquiry">Lesson inquiry</option>
              <option value="service_inquiry">Service inquiry</option>
            </Select>
            <Input
              label="Email"
              type="email"
              value={manualLeadForm.email}
              onChange={(event) => updateManualLeadField('email', event.target.value)}
              placeholder="name@example.com"
              hint="Email or phone is required for matching."
            />
            <Input
              label="Phone"
              type="tel"
              value={manualLeadForm.phone}
              onChange={(event) => updateManualLeadField('phone', event.target.value)}
              placeholder="(555) 123-4567"
              error={!manualLeadForm.email.trim() && !manualLeadForm.phone.trim() ? 'Email or phone is required' : undefined}
            />
            <Select
              label="Source"
              value={manualLeadForm.sourceForm}
              onChange={(event) => updateManualLeadField('sourceForm', event.target.value as ManualLeadFormState['sourceForm'])}
            >
              {MANUAL_LEAD_SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
            {manualLeadForm.intakeType === 'lesson_inquiry' ? (
              <>
                <Select
                  label="Program or instrument"
                  value={manualLeadForm.programLabel}
                  onChange={(event) => updateManualLeadField('programLabel', event.target.value)}
                >
                  <option value="">Select program or instrument</option>
                  {MANUAL_PROGRAM_OR_INSTRUMENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
                <div style={manualLeadStepperWrapStyle}>
                  <FieldLabel style={manualLeadStepperLabelStyle}>Family members interested</FieldLabel>
                  <div style={manualLeadStepperRowStyle}>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => updateManualLeadField('familyInterestedCount', Math.max(1, manualLeadForm.familyInterestedCount - 1))}
                      disabled={manualLeadSaving || manualLeadForm.familyInterestedCount <= 1}
                    >
                      −
                    </Button>
                    <div style={manualLeadStepperValueStyle}>{manualLeadForm.familyInterestedCount}</div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => updateManualLeadField('familyInterestedCount', manualLeadForm.familyInterestedCount + 1)}
                      disabled={manualLeadSaving}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <Input
                label="Service"
                value={manualLeadForm.serviceLabel}
                onChange={(event) => updateManualLeadField('serviceLabel', event.target.value)}
                placeholder="Birthday party"
              />
            )}
            <Input
              label="How did they find us"
              value={manualLeadForm.referrer}
              onChange={(event) => updateManualLeadField('referrer', event.target.value)}
              placeholder="Google, parent referral, flyer…"
            />
          </div>

          <Textarea
            label="Notes"
            value={manualLeadForm.message}
            onChange={(event) => updateManualLeadField('message', event.target.value)}
            placeholder="What did they ask for? Any timing, instrument, budget, or callback notes?"
            rows={6}
          />

          <div style={manualLeadFooterStyle}>
            <Button type="button" variant="secondary" onClick={closeAddLead} disabled={manualLeadSaving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateLead()}
              disabled={manualLeadSaving || !manualLeadForm.fullName.trim() || (!manualLeadForm.email.trim() && !manualLeadForm.phone.trim())}
            >
              {manualLeadSaving ? 'Saving…' : 'Create lead'}
            </Button>
          </div>
        </div>
      </SlidePanel>

      <SlidePanel isOpen={isDeleteOpen} onClose={closeDeleteModal} width="min(92vw, 520px)">
        <SlidePanelHeader
          title="Delete leads"
          onClose={closeDeleteModal}
        />
        <div style={deletePanelBodyStyle}>
          <div style={deleteCopyStyle}>
            Enter the delete password to permanently remove {selectedCount} {selectedCount === 1 ? 'lead' : 'leads'}.
          </div>
          {deleteError && <MessageBox>{deleteError}</MessageBox>}
          <Input
            label="Password"
            type="password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            placeholder="Enter password"
          />
          <div style={manualLeadFooterStyle}>
            <Button type="button" variant="secondary" onClick={closeDeleteModal} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteSelected()}
              disabled={deleteLoading || deletePassword.trim().length === 0}
            >
              {deleteLoading ? 'Deleting…' : 'Delete leads'}
            </Button>
          </div>
        </div>
      </SlidePanel>

      <SlidePanel isOpen={Boolean(selectedLeadId)} onClose={closeLead} width="min(88vw, 1180px)">
        <div style={leadPanelBodyStyle}>
          {detailError && <MessageBox>{detailError}</MessageBox>}
          {detailLoading && <InfoBox>Loading lead details…</InfoBox>}

          {selectedLead && !detailLoading && (
            <div style={leadDetailShellStyle}>
              <div style={leadHeaderWrapStyle}>
                <div style={leadHeroPanelStyle}>
                  <div style={leadHeroTopStyle}>
                    <div style={leadHeroIdentityStyle}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h2 style={leadHeroNameStyle}>{selectedLead.contact?.full_name || 'Unknown lead'}</h2>
                        <div style={leadHeroMetaRowStyle}>
                          <span>{selectedLeadType} · {formatDateTime(selectedLead.created_at)}</span>
                          {selectedLeadSignal && (
                            <span style={leadInlineSignalStyle} title={selectedLeadSignal.label}>{selectedLeadSignal.emoji}</span>
                          )}
                        </div>
                        <div style={statusInlineWrapStyle}>
                          {showStatusEditor ? (
                            <Select
                              id="lead-status-select"
                              value={statusValue}
                              onChange={(event) => void handleInlineStatusChange(event.target.value)}
                              fullWidth={false}
                              style={statusInlineSelectStyle}
                              wrapperStyle={statusInlineSelectWrapStyle}
                              disabled={detailSaving}
                            >
                              {DETAIL_STATUS_OPTIONS.map((option) => (
                                <option key={option} value={option}>{formatLabel(option)}</option>
                              ))}
                            </Select>
                          ) : (
                            <>
                              <Badge variant={selectedLead.status === 'new' ? 'info' : selectedLead.status === 'contacted' ? 'warning' : selectedLead.status === 'ghosted_us' || selectedLead.status === 'lost' ? 'error' : selectedLead.status === 'won' ? 'success' : 'neutral'}>
                                {formatLabel(statusValue)}
                              </Badge>
                              <button type="button" onClick={() => setShowStatusEditor(true)} style={statusInlineActionStyle}>
                                Edit status
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={leadHeroActionsStyle}>
                      {selectedLead.intake_type !== 'job_application' && (
                        <div style={valueCardStyle}>
                          <div style={valueCardLabelStyle}>Opportunity value</div>
                          <div style={valueCardAmountStyle}>
                            {selectedLead.intake_type === 'lesson_inquiry' ? formatCurrency(Math.round(lessonOpportunityTotal)) : 'OFF'}
                          </div>
                          <div style={valueCardMetaStyle}>
                            {selectedLead.intake_type === 'lesson_inquiry'
                              ? `${lessonSiblingCount + 1} student${lessonSiblingCount === 0 ? '' : 's'} · ${lessonSiblingDiscountLabel}`
                              : 'Pricing not configured yet'}
                          </div>
                        </div>
                      )}

                      <button type="button" onClick={closeLead} style={drawerCloseButtonStyle} aria-label="Close lead detail">
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {isMobileLayout && (
                <Tabs
                  items={detailPanelTabItems}
                  activeKey={detailPanelTab}
                  onChange={setDetailPanelTab}
                  style={mobileDetailTabsStyle}
                />
              )}

              <div style={isMobileLayout ? leadDetailContentStackStyle : leadDetailContentGridStyle}>
                {isMobileLayout ? (
                  detailPanelTab === 'details' ? leadDetailPrimaryContent : leadDetailSecondaryContent
                ) : (
                  <>
                    {leadDetailPrimaryContent}
                    {leadDetailSecondaryContent}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </SlidePanel>
    </>
  )
}

function Detail({ label, value }: { label: string, value: string }) {
  return (
    <DetailField label={label} value={value} style={detailCellStyle} />
  )
}

function QuickChip({
  label,
  width,
  href,
  action,
  fullWidth = false,
  align = 'center',
}: {
  label: string
  width: 'wide' | 'narrow'
  href?: string
  action?: React.ReactNode
  fullWidth?: boolean
  align?: 'center' | 'start'
}) {
  const content = (
    <CompactMetaCard fullWidth={fullWidth} align={align} style={{ ...quickChipStyle, ...quickChipWidthStyles[width], ...quickChipToneStyle }}>
      <span style={quickChipLabelStyle}>{label}</span>
      {action ? <span style={quickChipActionWrapStyle}>{action}</span> : null}
    </CompactMetaCard>
  )

  if (href) {
    return (
      <a href={href} style={quickChipLinkStyle}>
        {content}
      </a>
    )
  }

  return content
}

function MessageBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: radius.lg, padding: spacing.lg, fontSize: typography.sizeSm }}>
      {children}
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#F2F7FF', border: '1px solid #B9D0EA', color: '#1E3A5F', borderRadius: radius.lg, padding: spacing.lg, fontSize: typography.sizeSm }}>
      {children}
    </div>
  )
}

const filterBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: spacing.sm,
  flexWrap: 'wrap',
  marginBottom: spacing.lg,
}

const tableColumns = '44px 72px minmax(120px, 0.95fr) minmax(220px, 1.55fr) minmax(230px, 1.45fr) minmax(170px, 1.1fr) minmax(220px, 1.35fr) minmax(170px, 1fr)'

const tableWrapStyle: React.CSSProperties = {
  width: '100%',
  minWidth: '1246px',
}

const tableScrollWrapStyle: React.CSSProperties = {
  width: '100%',
  overflowX: 'auto',
  overflowY: 'hidden',
  WebkitOverflowScrolling: 'touch',
}

const tableHeaderStyle: React.CSSProperties = {
  gridTemplateColumns: tableColumns,
}

const tableRowStyle: React.CSSProperties = {
  gridTemplateColumns: tableColumns,
}

const signalCellStyle: React.CSSProperties = {
  fontSize: typography.sizeLg,
  lineHeight: 1,
}

const nameTextStyle: React.CSSProperties = {
  fontSize: typography.sizeMd,
  color: colors.text,
  fontFamily: typography.fontSans,
}

const subtleTextStyle: React.CSSProperties = {
  fontSize: typography.sizeSm,
  color: colors.textSecondary,
  fontFamily: typography.fontSans,
  marginTop: spacing.xs,
  lineHeight: 1.45,
}

const cellTextStyle: React.CSSProperties = {
  fontSize: typography.sizeSm,
  color: colors.text,
  fontFamily: typography.fontSans,
  lineHeight: 1.45,
}

const leadPanelBodyStyle: React.CSSProperties = {
  padding: '0',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.lg,
  background: colors.background,
  minHeight: 0,
}

const leadDetailShellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100%',
}

const leadHeaderWrapStyle: React.CSSProperties = {
  padding: '18px 22px 16px',
  borderBottom: `1px solid ${colors.borderLight}`,
  background: colors.surface,
}

const leadDetailContentGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.55fr) minmax(320px, 0.95fr)',
  minHeight: 0,
}

const leadDetailContentStackStyle: React.CSSProperties = {
  display: 'block',
  minHeight: 0,
}

const panelColumnStyle: React.CSSProperties = {
  padding: '18px 22px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.lg,
}

const stackSmStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.sm,
}

const gridSmStyle: React.CSSProperties = {
  display: 'grid',
  gap: spacing.sm,
}

const inlineRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.sm,
}

const leadDetailLeftColumnStyle: React.CSSProperties = {
  ...panelColumnStyle,
  borderRight: `1px solid ${colors.borderLight}`,
}

const leadDetailRightColumnStyle: React.CSSProperties = {
  ...panelColumnStyle,
}

const leadHeroPanelStyle: React.CSSProperties = {
  ...stackSmStyle,
}

const leadHeroTopStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: spacing.lg,
}

const mobileDetailTabsStyle: React.CSSProperties = {
  paddingInline: spacing.md,
  background: colors.surface,
}

const leadHeroActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: spacing.sm,
  flexShrink: 0,
}

const leadHeroIdentityStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  minWidth: 0,
  flex: 1,
}

const leadHeroNameStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '24px',
  lineHeight: 1.1,
  color: colors.text,
  fontWeight: typography.weightSemibold,
}

const leadHeroMetaRowStyle: React.CSSProperties = {
  marginTop: 4,
  ...inlineRowStyle,
  flexWrap: 'wrap',
  fontSize: typography.sizeSm,
  color: colors.textSecondary,
}

const leadInlineSignalStyle: React.CSSProperties = {
  fontSize: typography.sizeSm,
  lineHeight: 1,
}

const valueCardStyle: React.CSSProperties = {
  minWidth: '188px',
  maxWidth: '224px',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  padding: `${spacing.sm} ${spacing.md}`,
  background: colors.surface,
}

const valueCardLabelStyle: React.CSSProperties = {
  fontSize: typography.sizeXs,
  color: colors.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: spacing.xs,
}

const valueCardAmountStyle: React.CSSProperties = {
  fontSize: typography.sizeXl,
  color: colors.text,
  fontWeight: typography.weightSemibold,
  lineHeight: 1.15,
}

const valueCardMetaStyle: React.CSSProperties = {
  marginTop: spacing.xs,
  fontSize: typography.sizeXs,
  color: colors.textSecondary,
  lineHeight: 1.35,
}

const drawerCloseButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: colors.textMuted,
  cursor: 'pointer',
  fontSize: '24px',
  lineHeight: 1,
  padding: 0,
  marginTop: 4,
}

const statusInlineWrapStyle: React.CSSProperties = {
  ...inlineRowStyle,
  flexWrap: 'wrap',
  marginTop: spacing.sm,
}

const statusInlineSelectStyle: React.CSSProperties = {
  width: 'auto',
  border: `1px solid ${colors.textSecondary}`,
  borderRadius: radius.md,
  background: colors.surface,
  color: colors.text,
  outline: `2px solid ${colors.borderLight}`,
  outlineOffset: '0',
  boxShadow: 'none',
  padding: `${spacing.xs} ${spacing.md}`,
  fontSize: typography.sizeSm,
  fontFamily: typography.fontSans,
  lineHeight: 1.2,
  appearance: 'auto',
  boxSizing: 'border-box',
}

const statusInlineSelectWrapStyle: React.CSSProperties = {
  width: 'auto',
  flex: '0 0 auto',
}

const nameCellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
}

const statusInlineActionStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: colors.textSecondary,
  fontSize: typography.sizeSm,
  fontFamily: typography.fontSans,
  textDecoration: 'underline',
  cursor: 'pointer',
  padding: 0,
}

const quickActionRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 0.8fr)',
  gap: spacing.xl,
  alignItems: 'stretch',
}

const quickActionStackStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: spacing.md,
  alignItems: 'stretch',
}

const quickChipStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '100%',
  minHeight: `calc(${typography.sizeMd} * 2 + ${spacing.md})`,
  padding: `${spacing.sm} ${spacing.md}`,
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  fontSize: typography.sizeMd,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
  position: 'relative',
}

const quickChipWidthStyles: Record<'wide' | 'narrow', React.CSSProperties> = {
  wide: {
    minHeight: `calc(${typography.sizeMd} * 2 + ${spacing.lg})`,
  },
  narrow: {
    minHeight: `calc(${typography.sizeMd} * 2 + ${spacing.md})`,
  },
}

const quickChipToneStyle: React.CSSProperties = {
  background: '#EEF2FF',
  border: '1px solid #C7D2FE',
  color: '#4F46E5',
}

const quickChipLinkStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  color: 'inherit',
  textDecoration: 'none',
}

const quickChipLabelStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  paddingInline: spacing.lg,
}

const quickChipActionWrapStyle: React.CSSProperties = {
  position: 'absolute',
  top: spacing.sm,
  right: spacing.sm,
  display: 'flex',
}

const quickChipIconButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  padding: 0,
}

const editorialSectionPanelStyle: React.CSSProperties = {
  height: 'fit-content',
}

const editorialDetailsGridStyle: React.CSSProperties = {
  ...gridSmStyle,
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  rowGap: spacing.md,
}

const editorialDetailsGridMobileStyle: React.CSSProperties = {
  ...gridSmStyle,
  gridTemplateColumns: 'minmax(0, 1fr)',
  rowGap: spacing.md,
}

const detailCellStyle: React.CSSProperties = {
  padding: 0,
}

const sectionContentStyle: React.CSSProperties = {
  ...stackSmStyle,
}

const sectionDividerStyle: React.CSSProperties = {
  height: '1px',
  background: colors.borderLight,
}

const longformBodyStyle: React.CSSProperties = {
  fontSize: typography.sizeSm,
  color: colors.text,
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
}

const messageCardBodyStyle: React.CSSProperties = {
  ...longformBodyStyle,
  fontSize: typography.sizeBase,
  fontFamily: typography.fontMono,
  lineHeight: 1.75,
}

const sectionFooterActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-start',
}

const rightRailPanelStyle: React.CSSProperties = {
  boxShadow: 'none',
}

const detailFieldLabelStyle: React.CSSProperties = {
  marginBottom: spacing.xs,
}

const checkboxRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.sm,
  marginTop: spacing.xs,
  color: colors.text,
  fontSize: typography.sizeSm,
}

const sectionTitleMiniStyle: React.CSSProperties = {
  marginBottom: 0,
}

const siblingsWrapStyle: React.CSSProperties = {
  ...gridSmStyle,
  marginTop: spacing.sm,
}

const emptySiblingStateStyle: React.CSSProperties = {
  border: `1px dashed ${colors.border}`,
  borderRadius: radius.lg,
  padding: spacing.sm,
  color: colors.textMuted,
  fontSize: typography.sizeSm,
}

const siblingCardStyle: React.CSSProperties = {
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  padding: spacing.sm,
  background: colors.surface,
}

const siblingCardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: spacing.md,
  marginBottom: spacing.xs,
}

const siblingLabelStyle: React.CSSProperties = {
  fontSize: typography.sizeSm,
  color: colors.textSecondary,
  fontWeight: typography.weightMedium,
}

const removeSiblingButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: colors.textSecondary,
  cursor: 'pointer',
  padding: 0,
  fontSize: typography.sizeSm,
  textDecoration: 'underline',
}

const siblingGridStyle: React.CSSProperties = {
  ...gridSmStyle,
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  alignItems: 'start',
}

const siblingGridMobileStyle: React.CSSProperties = {
  ...gridSmStyle,
  gridTemplateColumns: 'minmax(0, 1fr)',
  alignItems: 'start',
}

const mobileLeadDetailSectionStyle: React.CSSProperties = {
  padding: `${spacing.md} ${spacing.md} ${spacing.xl}`,
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.lg,
}

const inputStyle: React.CSSProperties = {
  borderRadius: radius.sm,
  padding: `${spacing.xs} ${spacing.sm}`,
  width: '100%',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'auto',
}

const manualLeadPanelBodyStyle: React.CSSProperties = {
  padding: spacing['2xl'],
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.lg,
  overflowY: 'auto',
}

const manualLeadFormGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: spacing.lg,
  alignItems: 'start',
}

const manualLeadFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: spacing.sm,
}

const deletePanelBodyStyle: React.CSSProperties = {
  padding: spacing['2xl'],
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.lg,
}

const deleteCopyStyle: React.CSSProperties = {
  fontSize: typography.sizeSm,
  color: colors.textSecondary,
  lineHeight: 1.6,
}

const manualLeadStepperWrapStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.xs,
}

const manualLeadStepperLabelStyle: React.CSSProperties = {
  marginBottom: 0,
  fontSize: typography.sizeSm,
  fontWeight: typography.weightMedium,
  color: colors.text,
  fontFamily: typography.fontSans,
}

const manualLeadStepperRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.sm,
}

const manualLeadStepperValueStyle: React.CSSProperties = {
  minWidth: '32px',
  textAlign: 'center',
  fontSize: typography.sizeBase,
  color: colors.text,
  fontFamily: typography.fontSans,
}

const filterSelectWrapStyle: React.CSSProperties = {
  width: 'auto',
  flex: '0 0 auto',
}

const bulkActionBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.sm,
  marginLeft: 'auto',
}

const bulkActionTextStyle: React.CSSProperties = {
  fontSize: typography.sizeSm,
  color: colors.textSecondary,
  fontFamily: typography.fontSans,
}

const emptyActivityStyle: React.CSSProperties = {
  border: `1px dashed ${colors.border}`,
  borderRadius: radius.lg,
  padding: spacing.sm,
  color: colors.textMuted,
  fontSize: typography.sizeSm,
}

const activityTableStyle: React.CSSProperties = {
  ...stackSmStyle,
}

const activityRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: spacing.sm,
  alignItems: 'center',
}

const activityTitleCellStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.sm,
  minWidth: 0,
}

const activityBulletStyle: React.CSSProperties = {
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  background: colors.text,
  flexShrink: 0,
}

const activityTitleStyle: React.CSSProperties = {
  fontSize: typography.sizeSm,
  color: colors.text,
  fontWeight: typography.weightMedium,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const activityTimeStyle: React.CSSProperties = {
  fontSize: typography.sizeXs,
  color: colors.textMuted,
  whiteSpace: 'nowrap',
  textAlign: 'right',
}
