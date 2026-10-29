'use client'
import { LEAD_COUNT_EVENT } from '@/lib/lead-count'
import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'
import { ProfilePanelSkeleton } from '@/components/ui/ProfilePanelSkeleton'


import { ControlButton } from '@/components/ui/ControlButton'
import { PersonName } from '@/components/ui/PersonName'
import { LeadEmailSync } from './LeadEmailSync'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isLessonLead, leadBelongsToTab, LESSON_PROGRAM_OPTIONS, readLessonRequestFields, lessonRequestPayload, type LessonRequestFields } from '@/lib/lead-lesson-details'
import { Copy } from 'lucide-react'
import { Button, CompactMetaCard, DenseSectionPanel, DetailField, EmptyState, FieldLabel, Input, NotesSection, PageHeader, ResponsiveDataTable, SectionTitle, Select, SlidePanel, SlidePanelHeader, StatusBadge, Tabs, Textarea, type DataTableColumn } from '@/components/ui'
import { colors, radius, spacing, typography } from '@/lib/tokens'
import { getFollowUpTone } from '@/lib/follow-up'
import { formatPhoneNumber } from '@/lib/phone'
import { useIsMobile } from '@/lib/useMediaQuery'
import ComposePanel from '@/components/campaigns/ComposePanel'
import { LeadDetailPanel } from './LeadDetailPanel'
import { LeadStudentsEditor } from './LeadStudentsEditor'
import { LeadInlineEditor } from './LeadInlineEditor'
import { matchesLeadInquirySearch } from '@/lib/lead-inquiry-search'
import { leadStudentDetailRows, leadStudentsPatch, readLeadStudents, syncStudentContact } from '@/lib/lead-students'
import type { LeadStudent } from '@/lib/lead-students'
import { validBirthday } from '@/lib/lead-birthday'
import WinbackImportPanel from './WinbackImportPanel'
import { removeCurrentSearchParam } from '@/lib/browser-url'
import { useMobilePanelHistory } from '@/lib/useMobilePanelHistory'
import { formatLeadSource, LEAD_SOURCE_OPTIONS, normalizeLeadSourceValue, type LeadSource } from '@/lib/lead-sources'
import { DEFAULT_LESSON_BASE_VALUE, SERVICE_TYPE_OPTIONS, getLeadOpportunityValue } from '@/lib/lead-value'
import { normalizeFamilyMembers } from '@/lib/lead-family'
import { LEAD_STATUSES, formatLeadStatus } from '@/lib/lead-status'
import { compareLeadStatus, getStatusSortOrder } from '@/lib/lead-status-sort'
import { compareNewestLead, isNewLead, NEW_LEAD_ROW_BACKGROUND, NEW_LEAD_WINDOW_MS } from '@/lib/lead-table-order'
import { getLeadSignal } from '@/lib/lead-signal'
import { compareLeadAction, leadTablePhone } from '@/lib/lead-table-priority'
import Papa from 'papaparse'

type LeadTabKey = 'lesson_inquiry' | 'service_inquiry' | 'job_application' | 'winback' | 'enrolled' | 'lost'
type LeadDetailPanelTabKey = 'details' | 'notes_activity'
type LeadSortKey = 'action' | 'status' | 'name' | 'followUp' | 'program' | 'created' | 'lastActivity'
type SortDirection = 'asc' | 'desc'
type OpportunityValueUnit = 'mo' | 'session'
type ManualLeadFormState = LessonRequestFields & {
  fullName: string
  email: string
  phone: string
  intakeType: 'lesson_inquiry' | 'tour_request' | 'service_inquiry'
  source: LeadSource
  programLabel: string
  serviceLabel: string
  students: LeadStudent[]
  referrer: string
  campaign: string
  promotionType: string
  promotionOffer: string
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
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  referrer?: string | null
  program_label: string | null
  service_label: string | null
  category: string
  status: string
  priority: string
  temperature: string
  payload: Record<string, unknown>
  source?: string
  created_at: string
  updated_at: string
  last_activity_at: string
  last_status_change?: {
    previous_status: string
    next_status: string
    created_at: string
  } | null
  last_inbound_at?: string | null
  follow_up_at?: string | null
  follow_up_note?: string | null
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
    id?: string
    text: string
    timestamp: string
    actor_name?: string | null
  }>
}

type LeadListResponse = {
  leads: LeadRecord[]
  counts: Record<LeadTabKey, number>
  pipelineValue?: number
  closedSinceOct1?: number
}

type LeadListCacheEntry = {
  leads: LeadRecord[]
  fetchedAt: number
  nextOffset: number
  hasMore: boolean
}

type LeadPanelDraft = {
  note?: string
  followUpDate?: string
  followUpNote?: string
}

const EMPTY_LEAD_PANEL_DRAFT: LeadPanelDraft = {}
const LEAD_PANEL_DRAFT_STORAGE_KEY = 'pulse_lead_panel_drafts'
const LEAD_LIST_CACHE_TTL_MS = 30_000

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

type LeadEditFormState = LessonRequestFields & {
  fullName: string
  email: string
  phone: string
  status: string
  programLabel: string
  serviceLabel: string
  source: LeadSource
  sourceForm: string
  sourcePage: string
  campaign: string
  promotionType: string
  promotionOffer: string
  referrer: string
  opportunityValue: string
  opportunityValueUnit: OpportunityValueUnit
}

const LEAD_DETAIL_STATUS_OPTIONS = LEAD_STATUSES
const JOB_APPLICATION_DETAIL_STATUS_OPTIONS = ['new', 'contacted', 'audition_scheduled', 'audition_completed', 'offer_sent', 'hired', 'rejected', 'withdrew', 'ghosted']
const LESSON_INSTRUMENT_OPTIONS = ['Piano', 'Voice', 'Guitar', 'Violin', 'Drums', 'Ukulele', 'Bass', 'Cello', 'Saxophone', 'Flute', 'Clarinet', 'Trumpet', 'Other']
const LEAD_TABS: Array<{ key: LeadTabKey, label: string }> = [
  { key: 'lesson_inquiry', label: 'Lesson requests' },
  { key: 'service_inquiry', label: 'Service inquiries' },
  { key: 'enrolled', label: 'Enrolled' },
  { key: 'lost', label: 'Lost' },
  { key: 'winback', label: 'Disenrolled' },
]

const PROMOTION_TYPE_OPTIONS = [
  { value: '', label: 'No promotion' },
  { value: 'introductory_price', label: 'Introductory price' },
  { value: 'percentage_discount', label: 'Percentage discount' },
  { value: 'dollar_discount', label: 'Dollar discount' },
  { value: 'free_class_trial', label: 'Free class or trial' },
  { value: 'waived_fee', label: 'Waived fee' },
  { value: 'bundle_package', label: 'Bundle or package' },
  { value: 'giveaway', label: 'Giveaway' },
  { value: 'other', label: 'Other promotion' },
]


const LEAD_DETAIL_PANEL_TABS: Array<{ key: LeadDetailPanelTabKey, label: string }> = [
  { key: 'details', label: 'Details' },
  { key: 'notes_activity', label: 'Notes & activity' },
]

function createInitialManualLeadForm(activeTab: LeadTabKey): ManualLeadFormState {
  return {
    ...readLessonRequestFields(null),
    fullName: '',
    email: '',
    phone: '',
    intakeType: activeTab === 'service_inquiry' ? 'service_inquiry' : 'lesson_inquiry',
    source: 'phone_call',
    programLabel: '',
    serviceLabel: '',
    students: readLeadStudents({}, null).map(student => ({ ...student, same_as_contact: true, relationship_to_contact: 'self' })),
    referrer: '',
    campaign: '',
    promotionType: '',
    promotionOffer: '',
    message: '',
  }
}

function getLeadListCacheKey(tab: LeadTabKey, status: string) {
  return `${tab}:${status}`
}

function filterWinbackLeads(leads: LeadRecord[], tab: LeadTabKey, status: string) {
  if (tab !== 'winback' || status === 'all') return leads
  return leads.filter((lead) => {
    const winback = lead.payload?.winback
    return winback && typeof winback === 'object' && (winback as Record<string, unknown>).status === status
  })
}

function createLeadEditForm(lead: LeadDetail): LeadEditFormState {
  const rawSource = typeof lead.payload?.source === 'string' ? lead.payload.source : lead.source
  const source = normalizeLeadSourceValue(rawSource) || 'website'

  return {
    ...readLessonRequestFields(lead.payload),
    fullName: lead.contact?.full_name || '',
    email: lead.contact?.email || '',
    phone: lead.contact?.phone || '',
    status: lead.status,
    programLabel: lead.program_label || '',
    serviceLabel: lead.service_label || '',
    source,
    sourceForm: lead.source_form || '',
    sourcePage: lead.source_page || '',
    campaign: lead.utm_campaign || '',
    promotionType: typeof lead.payload?.promotion_type === 'string' ? lead.payload.promotion_type : '',
    promotionOffer: typeof lead.payload?.promotion_offer === 'string' ? lead.payload.promotion_offer : '',
    referrer: lead.referrer || '',
    opportunityValue: getServiceSessionValue(lead)?.toString() || '',
    opportunityValueUnit: lead.payload?.opportunity_value_unit === 'mo' ? 'mo' : 'session',
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

function formatLastActivity(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  const now = new Date()
  const elapsedMs = Math.max(0, now.getTime() - date.getTime())
  const dayDifference = Math.round((getStartOfLocalDay(now).getTime() - getStartOfLocalDay(date).getTime()) / 86400000)
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '').toLowerCase()

  if (dayDifference === 0 && elapsedMs < 60 * 60 * 1000) return 'Today a moment ago'
  if (dayDifference === 0) return `Today at ${time}`
  if (dayDifference === 1) return `Yesterday at ${time}`
  if (dayDifference === 2) return `2 days ago at ${time}`
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${time}`
}

function formatFollowUpDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDateInputValue(value: string | Date | null | undefined) {
  const date = value instanceof Date ? value : (value ? new Date(value) : null)
  if (!date || Number.isNaN(date.getTime())) return ''
  return formatDateInputValue(date)
}

function getProcessingFollowUpPayload(lead: LeadDetail | null, nextStatus: string): Record<string, string | null> | undefined {
  if (!lead || nextStatus !== 'processing' || lead.status === 'processing' || getLeadFollowUpAt(lead)) return undefined

  const followUpDate = new Date()
  followUpDate.setDate(followUpDate.getDate() + 7)
  followUpDate.setHours(12, 0, 0, 0)

  return {
    follow_up_at: followUpDate.toISOString(),
    follow_up_note: null,
  }
}

function getLeadFollowUpAt(lead: { follow_up_at?: string | null; payload?: Record<string, unknown> | null } | null | undefined): string | null {
  if (!lead) return null
  if (typeof lead.follow_up_at === 'string' && lead.follow_up_at) return lead.follow_up_at
  const fromPayload = lead.payload?.follow_up_at
  return typeof fromPayload === 'string' && fromPayload ? fromPayload : null
}

function getLeadFollowUpNote(lead: { follow_up_note?: string | null; payload?: Record<string, unknown> | null } | null | undefined): string {
  if (!lead) return ''
  if (typeof lead.follow_up_note === 'string') return lead.follow_up_note
  const fromPayload = lead.payload?.follow_up_note
  return typeof fromPayload === 'string' ? fromPayload : ''
}

function getQuickFollowUpDates(today: Date = new Date()): Array<{ label: string; date: Date }> {
  const addDays = (count: number) => {
    const date = new Date(today)
    date.setDate(date.getDate() + count)
    return date
  }
  const nextWeekday = (targetDay: number) => {
    const date = new Date(today)
    const diff = (targetDay - date.getDay() + 7) % 7 || 7
    date.setDate(date.getDate() + diff)
    return date
  }
  const addMonths = (count: number) => {
    const date = new Date(today)
    date.setMonth(date.getMonth() + count)
    return date
  }
  return [
    { label: 'Tomorrow', date: addDays(1) },
    { label: 'Next Monday', date: nextWeekday(1) },
    { label: 'Next Friday', date: nextWeekday(5) },
    { label: 'Next week', date: addDays(7) },
    { label: 'Next month', date: addMonths(1) },
  ]
}

function formatLabel(value: string | null | undefined) {
  if (!value) return '—'
  return formatLeadStatus(value)
}

function getLeadSource(lead: Pick<LeadRecord, 'source' | 'source_form' | 'source_page'>, payload?: Record<string, unknown>) {
  const value = typeof payload?.source === 'string' ? payload.source : lead.source
  if (value) return formatLeadSource(value)
  if (lead.source_form === 'manual-phone-call') return 'Phone Call'
  if (lead.source_form === 'manual-walk-in') return 'Foot Traffic'
  if (lead.source_form === 'manual-referral') return 'Family'
  if (lead.source_form.includes('event') || lead.source_form.includes('hot_chili')) return 'Event'
  return 'Website'
}

function getManualLeadSourceForm(source: LeadSource) {
  return `manual-${source.replace(/_/g, '-')}`
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

function isUrgentFollowUp(tone: ReturnType<typeof getFollowUpTone>) {
  return tone.urgency === 'today' || tone.urgency === 'overdue'
}

function getActivityActor(event: { payload?: Record<string, unknown> | null }) {
  const actor = event.payload?.actor
  return actor && typeof actor === 'object' && typeof (actor as Record<string, unknown>).displayName === 'string'
    ? (actor as Record<string, string>).displayName
    : null
}

function getStatusOptionsForTab(tab: LeadTabKey) {
  if (tab === 'enrolled') return ['all', 'won']
  if (tab === 'lost') return ['all', 'lost', 'ghosted_us']
  if (tab === 'lesson_inquiry' || tab === 'service_inquiry') return ['all', ...getStatusSortOrder(tab).filter(status => !['won', 'lost', 'ghosted_us', 'ghosted'].includes(status))]
  return ['all', ...getStatusSortOrder(tab)]
}

function getDetailStatusOptions(intakeType: string | null | undefined) {
  return intakeType === 'job_application' ? JOB_APPLICATION_DETAIL_STATUS_OPTIONS : LEAD_DETAIL_STATUS_OPTIONS
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

function normalizeServiceLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function getServiceTypeByLabel(label: string) {
  const normalized = normalizeServiceLabel(label)
  if (!normalized) return null

  const exact = SERVICE_TYPE_OPTIONS.find((option) => normalizeServiceLabel(option.label) === normalized)
  if (exact) return exact

  return SERVICE_TYPE_OPTIONS.find((option) =>
    option.keywords.some((keyword) => normalized.includes(keyword)),
  ) || null
}

function getServiceSessionValue(lead: LeadDetail | null): number | null {
  if (!lead) return null

  const payload = lead.payload
  if (payload && typeof payload.session_value === 'number' && Number.isFinite(payload.session_value)) {
    return payload.session_value
  }
  if (payload && typeof payload.session_value === 'string' && payload.session_value.trim()) {
    const parsed = Number(payload.session_value)
    if (Number.isFinite(parsed)) return parsed
  }

  const match = lead.service_label ? getServiceTypeByLabel(lead.service_label) : null
  return match && match.fee != null ? match.fee : null
}

function getStartOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

export default function LeadsView({ correctionPrototype = true }: { correctionPrototype?: boolean } = {}) {
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [rowNow, setRowNow] = useState(() => Date.now())
  useEffect(() => {
    const now = Date.now()
    const boundaries = leads.flatMap(lead => {
      const created = Date.parse(lead.created_at)
      return [created, created + NEW_LEAD_WINDOW_MS].filter(at => Number.isFinite(at) && at > now)
    })
    const refresh = () => setRowNow(Date.now())
    const next = boundaries.reduce<number | null>((earliest, at) => earliest === null || at < earliest ? at : earliest, null)
    const timer = next === null ? null : window.setTimeout(refresh, Math.min(next - now + 1, 2147483647))
    window.addEventListener('focus', refresh)
    return () => {
      if (timer !== null) window.clearTimeout(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [leads, rowNow])
  const [tabCounts, setTabCounts] = useState<Record<LeadTabKey, number>>({
    lesson_inquiry: 0,
    service_inquiry: 0,
    job_application: 0,
    winback: 0,
    enrolled: 0,
    lost: 0,
  })
  const [pipelineValue, setPipelineValue] = useState(0)
  const [closedSinceOct1, setClosedSinceOct1] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortKey, setSortKey] = useState<LeadSortKey>('created')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [activeTab, setActiveTab] = useState<LeadTabKey>('lesson_inquiry')
  const leadListCacheRef = useRef(new Map<string, LeadListCacheEntry>())
  const leadListRequestRef = useRef(0)
  const leadListCacheGenerationRef = useRef(0)
  const prefetchedTabsRef = useRef(false)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null)
  const selectedLeadIdRef = useRef<string | null>(null)
  const leadDetailRequestRef = useRef(0)
  const leadSaveRequestRef = useRef(0)
  const deepLinkedLeadHandledRef = useRef(false)
  const [smsViewOpen, setSmsViewOpen] = useState(false)
  const [isBulkComposeOpen, setIsBulkComposeOpen] = useState(false)
  const [isWinbackImportOpen, setIsWinbackImportOpen] = useState(false)
  const [leadPanelDrafts, setLeadPanelDrafts] = useState<Record<string, LeadPanelDraft>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const stored = window.sessionStorage.getItem(LEAD_PANEL_DRAFT_STORAGE_KEY)
      return stored ? JSON.parse(stored) as Record<string, LeadPanelDraft> : {}
    } catch {
      return {}
    }
  })
  const [isEditLeadOpen, setIsEditLeadOpen] = useState(false)
  const [leadEditForm, setLeadEditForm] = useState<LeadEditFormState | null>(null)
  const [leadEditTargetId, setLeadEditTargetId] = useState<string | null>(null)
  const [leadEditError, setLeadEditError] = useState('')
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false)
  const [manualLeadForm, setManualLeadForm] = useState<ManualLeadFormState>(() => createInitialManualLeadForm('lesson_inquiry'))
  const [manualLeadError, setManualLeadError] = useState('')
  const [manualLeadSaving, setManualLeadSaving] = useState(false)
  const [manualLeadQueued, setManualLeadQueued] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailSaving, setDetailSaving] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [callingLead, setCallingLead] = useState(false)
  const [statusValue, setStatusValue] = useState('new')
  const [notesValue, setNotesValue] = useState('')
  const [showStatusEditor, setShowStatusEditor] = useState(false)
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpNote, setFollowUpNote] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const isMobileLayout = useIsMobile()
  const [detailPanelTab, setDetailPanelTab] = useState<LeadDetailPanelTabKey>('details')
  const [lessonOpportunity, setLessonOpportunity] = useState<LessonOpportunityState>({
    familyLabel: '',
    baseValue: String(DEFAULT_LESSON_BASE_VALUE),
    siblingDiscountEnabled: true,
    siblings: [],
  })

  const [inquirySearch, setInquirySearch] = useState('')
  const visibleLeads = useMemo(() => leads.filter(lead => matchesLeadInquirySearch(lead, inquirySearch)), [leads, inquirySearch])
  const sortedLeads = useMemo(() => {
    const compareText = (left: string, right: string) => left.localeCompare(right, undefined, { sensitivity: 'base' })
    const compareNumbers = (left: number, right: number) => left - right
    const direction = sortDirection === 'asc' ? 1 : -1

    return [...visibleLeads].sort((left, right) => {
      if (sortKey === 'action') return compareLeadAction(left, right, activeTab)
      if (sortKey === 'created') return compareNewestLead(left, right) * (sortDirection === 'desc' ? 1 : -1)
      if (sortKey === 'status') return compareLeadStatus(left, right, activeTab, sortDirection)
      let comparison = 0
      if (sortKey === 'name') comparison = compareText(left.contact?.full_name || '', right.contact?.full_name || '')
      if (sortKey === 'program') comparison = compareText(left.program_label || left.service_label || '', right.program_label || right.service_label || '')
      if (sortKey === 'lastActivity') comparison = compareNumbers(new Date(left.last_activity_at).getTime(), new Date(right.last_activity_at).getTime())
      if (sortKey === 'followUp') {
        const leftFollowUp = getLeadFollowUpAt(left)
        const rightFollowUp = getLeadFollowUpAt(right)
        if (!leftFollowUp && !rightFollowUp) return compareNewestLead(left, right)
        if (!leftFollowUp) return 1
        if (!rightFollowUp) return -1
        const leftTime = leftFollowUp ? new Date(leftFollowUp).getTime() : Number.POSITIVE_INFINITY
        const rightTime = rightFollowUp ? new Date(rightFollowUp).getTime() : Number.POSITIVE_INFINITY
        comparison = compareNumbers(leftTime, rightTime)
      }
      return comparison === 0 ? compareNewestLead(left, right) : comparison * direction
    })
  }, [activeTab, visibleLeads, sortDirection, sortKey])

  const updateLeadPanelDraft = (leadId: string, draft: LeadPanelDraft) => {
    setLeadPanelDrafts((current) => {
      const hasDraft = Object.values(draft).some((value) => value !== undefined)
      const next = { ...current }
      if (hasDraft) next[leadId] = draft
      else delete next[leadId]

      try {
        if (Object.keys(next).length) window.sessionStorage.setItem(LEAD_PANEL_DRAFT_STORAGE_KEY, JSON.stringify(next))
        else window.sessionStorage.removeItem(LEAD_PANEL_DRAFT_STORAGE_KEY)
      } catch {}

      return next
    })
  }

  const fetchLeads = useCallback(async (options: { force?: boolean } = {}) => {
    const requestedTab = activeTab
    const requestedStatus = statusFilter
    const cacheKey = getLeadListCacheKey(requestedTab, requestedStatus)
    const cached = leadListCacheRef.current.get(cacheKey)
    const cacheIsFresh = cached && Date.now() - cached.fetchedAt < LEAD_LIST_CACHE_TTL_MS
    const requestId = ++leadListRequestRef.current
    const cacheGeneration = leadListCacheGenerationRef.current

    if (cached) {
      setLeads(cached.leads)
      setHasMore(cached.hasMore)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError('')

    if (cacheIsFresh && !options.force) return

    try {
      const params = new URLSearchParams()
      if (requestedTab !== 'winback' && requestedStatus !== 'all') params.set('status', requestedStatus)
      params.set('intake_type', requestedTab)

      params.set('include_counts', '1')
      params.set('include_activity', '0')
      const data = await fetchJsonWithTimeout<LeadListResponse>(`/api/leads?${params.toString()}`)

      const returnedLeads = Array.isArray(data.leads) ? data.leads : []
      const visibleLeads = filterWinbackLeads(returnedLeads, requestedTab, requestedStatus)
      if (cacheGeneration === leadListCacheGenerationRef.current) {
        leadListCacheRef.current.set(cacheKey, { leads: visibleLeads, fetchedAt: Date.now(), nextOffset: returnedLeads.length, hasMore: returnedLeads.length === 100 })
      }

      if (requestId !== leadListRequestRef.current) return
      setLeads(visibleLeads)
      setHasMore(returnedLeads.length === 100)
      setTabCounts(data.counts)
      setPipelineValue(typeof data.pipelineValue === 'number' ? data.pipelineValue : 0)
      setClosedSinceOct1(typeof data.closedSinceOct1 === 'number' ? data.closedSinceOct1 : 0)

      if (!prefetchedTabsRef.current) {
        prefetchedTabsRef.current = true
        const prefetchCacheGeneration = leadListCacheGenerationRef.current
        window.setTimeout(() => {
          LEAD_TABS.forEach((tab) => {
            const prefetchKey = getLeadListCacheKey(tab.key, 'all')
            if (tab.key === requestedTab || leadListCacheRef.current.has(prefetchKey)) return

            const prefetchParams = new URLSearchParams({
              intake_type: tab.key,
              include_activity: '0',
            })
            void fetchJsonWithTimeout<LeadRecord[]>(`/api/leads?${prefetchParams.toString()}`)
              .then((prefetchedLeads) => {
                if (prefetchCacheGeneration !== leadListCacheGenerationRef.current) return
                leadListCacheRef.current.set(prefetchKey, {
                  leads: Array.isArray(prefetchedLeads) ? prefetchedLeads : [],
                  fetchedAt: Date.now(),
                  nextOffset: prefetchedLeads.length,
                  hasMore: prefetchedLeads.length === 100,
                })
              })
              .catch(() => {})
          })
        }, 0)
      }
    } catch (error: unknown) {
      if (requestId !== leadListRequestRef.current) return
      setError(getErrorMessage(error, 'Could not load leads'))
      if (!cached) setLeads([])
    } finally {
      if (requestId === leadListRequestRef.current) setLoading(false)
    }
  }, [activeTab, statusFilter])

  const invalidateLeadListCache = () => {
    window.dispatchEvent(new Event(LEAD_COUNT_EVENT))
    leadListCacheGenerationRef.current += 1
    leadListCacheRef.current.clear()
    prefetchedTabsRef.current = false
  }

  const loadMoreLeads = async () => {
    const key = getLeadListCacheKey(activeTab, statusFilter)
    const cached = leadListCacheRef.current.get(key)
    if (!cached || loadingMore) return
    const generation = leadListCacheGenerationRef.current
    const requestId = leadListRequestRef.current
    setLoadingMore(true)
    try {
      const params = new URLSearchParams({ intake_type: activeTab, include_activity: '0', offset: String(cached.nextOffset) })
      if (activeTab !== 'winback' && statusFilter !== 'all') params.set('status', statusFilter)
      const rows = await fetchJsonWithTimeout<LeadRecord[]>(`/api/leads?${params}`)
      if (generation !== leadListCacheGenerationRef.current || requestId !== leadListRequestRef.current) return
      const merged = Array.from(new Map([...cached.leads, ...filterWinbackLeads(rows, activeTab, statusFilter)].map((lead) => [lead.id, lead])).values())
      const next = { leads: merged, fetchedAt: Date.now(), nextOffset: cached.nextOffset + rows.length, hasMore: rows.length === 100 }
      leadListCacheRef.current.set(key, next)
      setLeads(merged)
      setHasMore(next.hasMore)
    } catch (error: unknown) {
      if (requestId === leadListRequestRef.current) setError(getErrorMessage(error, 'Could not load more leads'))
    } finally {
      setLoadingMore(false)
    }
  }

  const exportLeads = async () => {
    setExporting(true)
    setError('')
    try {
      const allRows: LeadRecord[] = []
      let offset = 0
      while (true) {
        const params = new URLSearchParams({ intake_type: activeTab, include_activity: '0', offset: String(offset), limit: '500' })
        if (activeTab !== 'winback' && statusFilter !== 'all') params.set('status', statusFilter)
        const rows = await fetchJsonWithTimeout<LeadRecord[]>(`/api/leads?${params}`)
        allRows.push(...filterWinbackLeads(rows, activeTab, statusFilter))
        offset += rows.length
        if (rows.length < 500) break
      }
      const csv = Papa.unparse(allRows.map((lead) => ({
        Name: lead.contact?.full_name || '',
        Email: lead.contact?.email || '',
        Phone: lead.contact?.phone || '',
        Status: formatLabel(lead.status),
        Program: lead.program_label || '',
        Service: lead.service_label || '',
        Source: getLeadSource(lead, lead.payload),
        Campaign: lead.utm_campaign || '',
        'Promotion type': lead.payload.promotion_type || '',
        Offer: lead.payload.promotion_offer || '',
        'Opportunity value': lead.payload.session_value ?? '',
        'Value period': lead.payload.opportunity_value_unit || '',
        'Follow-up date': lead.follow_up_at || '',
        'Follow-up reminder': lead.follow_up_note || '',
        Created: lead.created_at,
        'Last activity': lead.last_activity_at,
        'Lead ID': lead.id,
      })), { escapeFormulae: true })
      const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `leads-${activeTab}-${statusFilter}-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Could not export leads'))
    } finally {
      setExporting(false)
    }
  }

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
      const visibleIds = visibleLeads.map((lead) => lead.id)
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
    setIsDeleteOpen(true)
  }

  const closeDeleteModal = () => {
    if (deleteLoading) return
    setIsDeleteOpen(false)
    setDeleteError('')
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return

    setDeleteLoading(true)
    setDeleteError('')

    try {
      await fetchJsonWithTimeout<{ success: true }>(`/api/leads`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), intake_type: activeTab }),
      })

      if (selectedLeadId && selectedIds.has(selectedLeadId)) closeLead()
      setSelectedIds(new Set())
      setIsDeleteOpen(false)
      invalidateLeadListCache()
      await fetchLeads({ force: true })
    } catch (error: unknown) {
      setDeleteError(getErrorMessage(error, 'Could not delete leads'))
    } finally {
      setDeleteLoading(false)
    }
  }

  const fetchLeadDetail = async (leadId: string, intakeType?: string) => {
    const requestId = ++leadDetailRequestRef.current
    setDetailLoading(true)
    setDetailError('')
    try {
      const params = new URLSearchParams()
      if (intakeType) params.set('intake_type', intakeType)
      const data = await fetchJsonWithTimeout<LeadDetail>(`/api/leads/${leadId}?${params.toString()}`)
      if (requestId !== leadDetailRequestRef.current || selectedLeadIdRef.current !== leadId) return
      setSelectedLead(data)
      setStatusValue(data.status || 'new')
      setNotesValue(data.contact?.notes || '')
      setShowStatusEditor(false)
      setFollowUpDate(toDateInputValue(getLeadFollowUpAt(data)))
      setFollowUpNote(getLeadFollowUpNote(data))
      setLessonOpportunity(getLessonOpportunityState(data))
    } catch (error: unknown) {
      if (requestId === leadDetailRequestRef.current && selectedLeadIdRef.current === leadId) {
        setDetailError(getErrorMessage(error, 'Could not load lead'))
      }
    } finally {
      if (requestId === leadDetailRequestRef.current && selectedLeadIdRef.current === leadId) setDetailLoading(false)
    }
  }

  const openLead = async (leadId: string, intakeType?: string) => {
    selectedLeadIdRef.current = leadId
    setSmsViewOpen(false)
    setSelectedLeadId(leadId)
    await fetchLeadDetail(leadId, intakeType)
  }

  useEffect(() => {
    if (deepLinkedLeadHandledRef.current) return
    deepLinkedLeadHandledRef.current = true
    const leadId = new URLSearchParams(window.location.search).get('lead')
    if (!leadId) return
    void openLead(leadId)
    // Deep links are consumed once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openAdjacentLead = async (direction: 'prev' | 'next') => {
    if (!selectedLeadId) return
    const index = leads.findIndex((lead) => lead.id === selectedLeadId)
    if (index < 0) return
    const target = direction === 'prev' ? leads[index - 1] : leads[index + 1]
    if (target) await openLead(target.id, target.intake_type)
  }

  useEffect(() => {
    if (!selectedLeadId || isEditLeadOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (event.key === 'ArrowLeft') void openAdjacentLead('prev')
      else if (event.key === 'ArrowRight') void openAdjacentLead('next')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeadId, leads, isEditLeadOpen])

  const openAddLead = () => {
    setManualLeadError('')
    setManualLeadForm(createInitialManualLeadForm(activeTab))
    setIsAddLeadOpen(true)
  }

  const closeAddLead = () => {
    if (manualLeadSaving) return
    setIsAddLeadOpen(false)
    setManualLeadError('')
    setManualLeadQueued(false)
  }

  const updateManualLeadField = <K extends keyof ManualLeadFormState>(field: K, value: ManualLeadFormState[K]) => {
    setManualLeadForm((current) => ({
      ...current,
      [field]: value,
      ...(['fullName', 'email', 'phone'].includes(field) ? { students: syncStudentContact(current.students, { name: field === 'fullName' ? String(value) : current.fullName, email: field === 'email' ? String(value) : current.email, phone: field === 'phone' ? String(value) : current.phone }) } : {}),
      ...(field === 'intakeType'
        ? {
            programLabel: isLessonLead(String(value)) ? current.programLabel : '',
            serviceLabel: value === 'service_inquiry' ? current.serviceLabel : '',
          }
        : null),
    }))
  }

  const handleCreateLead = async () => {
    setManualLeadSaving(true)
    setManualLeadError('')

    try {
      const payload: Record<string, unknown> = {
        source: manualLeadForm.source,
        promotion_type: manualLeadForm.promotionType || null,
        promotion_offer: manualLeadForm.promotionOffer.trim() || null,
      }
      const trimmedMessage = manualLeadForm.message.trim()
      if (trimmedMessage) payload.message = trimmedMessage
      if (isLessonLead(manualLeadForm.intakeType)) {
        Object.assign(payload, lessonRequestPayload(manualLeadForm), manualLeadForm.students[0]?.relationship_to_contact === 'self' ? {} : { parent_name: manualLeadForm.fullName.trim() })
        Object.assign(payload, leadStudentsPatch(manualLeadForm.students).payload)
      }
      if (manualLeadForm.intakeType === 'service_inquiry') {
        const serviceType = getServiceTypeByLabel(manualLeadForm.serviceLabel)
        if (serviceType) {
          payload.service_type = serviceType.value
          if (serviceType.fee != null) {
            payload.session_value = serviceType.fee
            payload.opportunity_value_unit = 'session'
          }
        }
      }

      const response = await fetchJsonWithTimeout<{ lead_intake_id?: string; queued?: boolean; receipt_id?: string }>(`/api/intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intake_type: manualLeadForm.intakeType,
          source_system: 'pulse-manual',
          source_form: getManualLeadSourceForm(manualLeadForm.source),
          source_page: null,
          full_name: manualLeadForm.fullName.trim(),
          email: manualLeadForm.email.trim() || null,
          phone: manualLeadForm.phone.trim() || null,
          program_label: isLessonLead(manualLeadForm.intakeType) ? leadStudentsPatch(manualLeadForm.students).program_label || null : null,
          service_label: manualLeadForm.intakeType === 'service_inquiry' ? manualLeadForm.serviceLabel.trim() || null : null,
          utm_source: manualLeadForm.source,
          utm_campaign: manualLeadForm.campaign.trim() || null,
          referrer: manualLeadForm.referrer.trim() || null,
          payload,
        }),
      })

      if (response.queued) {
        setManualLeadError(`Inquiry safely queued${response.receipt_id ? ` (receipt ${response.receipt_id})` : ''}. It is not yet visible in Leads. Close this panel; do not resubmit.`)
        setManualLeadQueued(true)
        return
      }

      invalidateLeadListCache()
      await fetchLeads({ force: true })
      setIsAddLeadOpen(false)
      setManualLeadForm(createInitialManualLeadForm(activeTab))

      if (response.lead_intake_id) {
        const targetTab = isLessonLead(manualLeadForm.intakeType) ? 'lesson_inquiry' : 'service_inquiry'
        if (targetTab !== activeTab) setActiveTab(targetTab)
        await openLead(response.lead_intake_id, targetTab)
      }
    } catch (error: unknown) {
      setManualLeadError(getErrorMessage(error, 'Could not create lead'))
    } finally {
      setManualLeadSaving(false)
    }
  }

  const handleInlineStatusChange = async (nextStatus: string) => {
    setStatusValue(nextStatus)
    await saveDetail({ status: nextStatus, payload: getProcessingFollowUpPayload(selectedLead, nextStatus) })
  }

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email)
    } catch (error) {
      console.error('Could not copy email', error)
    }
  }

  const handleCallLead = async () => {
    const phone = selectedLead?.contact?.phone
    if (!phone || !selectedLeadId) return
    setCallingLead(true)
    setDetailError('')
    try {
      await fetchJsonWithTimeout<{ success: true }>(`/api/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_phone: phone,
          contact_id: selectedLead?.contact_id || null,
          lead_id: selectedLead?.intake_type === 'job_application' ? null : selectedLeadId,
        }),
      })

      // Optimistically surface the call in the activity feed.
      setSelectedLead((current) => current ? {
        ...current,
        events: [
          {
            id: `call_${Date.now()}`,
            event_type: 'call_started',
            event_label: 'Call placed',
            payload: { to_phone: phone, actor: { displayName: 'You' } },
            created_at: new Date().toISOString(),
          },
          ...(current.events || []),
        ],
      } : current)
    } catch (error) {
      setDetailError(getErrorMessage(error, 'Could not place call'))
    } finally {
      setCallingLead(false)
    }
  }

  const closeLead = () => {
    selectedLeadIdRef.current = null
    leadDetailRequestRef.current += 1
    leadSaveRequestRef.current += 1
    setSmsViewOpen(false)
    setSelectedLeadId(null)
    setSelectedLead(null)
    removeCurrentSearchParam('lead')
    setDetailError('')
    setShowStatusEditor(false)
    setFollowUpDate('')
    setFollowUpNote('')
    setIsEditLeadOpen(false)
    setLeadEditForm(null)
    setLeadEditError('')
    setDetailPanelTab('details')
    setLessonOpportunity({
      familyLabel: '',
      baseValue: String(DEFAULT_LESSON_BASE_VALUE),
      siblingDiscountEnabled: true,
      siblings: [],
    })
  }

  const leadHistory = useMobilePanelHistory({
    isOpen: Boolean(selectedLeadId),
    isMobile: isMobileLayout,
    historyKey: 'pulseMobileLeadProfile',
    onClose: closeLead,
  })

  const saveDetail = async (extra: { add_note?: string, mention_membership_ids?: string[], status?: string, payload?: Record<string, unknown> } = {}) => {
    const leadId = selectedLeadIdRef.current
    if (!leadId) return false
    const requestId = ++leadSaveRequestRef.current
    setDetailSaving(true)
    setDetailError('')
    try {
      const data = await fetchJsonWithTimeout<LeadDetail>(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...extra,
        }),
      })

      if (requestId !== leadSaveRequestRef.current || selectedLeadIdRef.current !== leadId) return true
      setSelectedLead(data)
      setNotesValue(data.contact?.notes || '')
      setShowStatusEditor(false)
      setFollowUpDate(toDateInputValue(getLeadFollowUpAt(data)))
      setFollowUpNote(getLeadFollowUpNote(data))
      setLessonOpportunity(getLessonOpportunityState(data))
      setLeads((current) => current.map((lead) => (
        lead.id === leadId
          ? {
              ...lead,
              status: data.status,
              program_label: data.program_label,
              service_label: data.service_label,
              payload: data.payload,
              follow_up_at: data.follow_up_at ?? null,
              follow_up_note: data.follow_up_note ?? null,
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
      invalidateLeadListCache()
      if (!leadBelongsToTab(data, activeTab)) await fetchLeads({ force: true })
      return true
    } catch (error: unknown) {
      if (requestId === leadSaveRequestRef.current && selectedLeadIdRef.current === leadId) {
        setDetailError(getErrorMessage(error, 'Could not save lead'))
      }
      return false
    } finally {
      if (requestId === leadSaveRequestRef.current && selectedLeadIdRef.current === leadId) setDetailSaving(false)
    }
  }

  const saveFollowUp = async () => {
    if (!selectedLeadId || !followUpDate) return
    setDetailSaving(true)
    setDetailError('')
    try {
      const iso = new Date(`${followUpDate}T12:00:00`).toISOString()
      const data = await fetchJsonWithTimeout<LeadDetail>(`/api/leads/${selectedLeadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: {
            follow_up_at: iso,
            follow_up_note: followUpNote.trim() || null,
          },
        }),
      })
      setSelectedLead(data)
      setFollowUpDate(toDateInputValue(getLeadFollowUpAt(data)))
      setFollowUpNote(getLeadFollowUpNote(data))
      setLeads((current) => current.map((lead) => (
        lead.id === selectedLeadId
          ? { ...lead, follow_up_at: data.follow_up_at ?? null, follow_up_note: data.follow_up_note ?? null, updated_at: data.updated_at }
          : lead
      )))
      invalidateLeadListCache()
    } catch (error: unknown) {
      setDetailError(getErrorMessage(error, 'Could not save follow-up'))
    } finally {
      setDetailSaving(false)
    }
  }

  const clearFollowUp = async () => {
    if (!selectedLeadId) return
    setDetailSaving(true)
    setDetailError('')
    try {
      const data = await fetchJsonWithTimeout<LeadDetail>(`/api/leads/${selectedLeadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: { follow_up_at: null, follow_up_note: null },
        }),
      })
      setSelectedLead(data)
      setFollowUpDate('')
      setFollowUpNote('')
      setLeads((current) => current.map((lead) => (
        lead.id === selectedLeadId
          ? { ...lead, follow_up_at: null, follow_up_note: null, updated_at: data.updated_at }
          : lead
      )))
      invalidateLeadListCache()
    } catch (error: unknown) {
      setDetailError(getErrorMessage(error, 'Could not clear follow-up'))
    } finally {
      setDetailSaving(false)
    }
  }

  const openLeadEditor = () => {
    if (!selectedLead) return
    setLeadEditTargetId(selectedLead.id)
    setLeadEditForm(createLeadEditForm(selectedLead))
    setLeadEditError('')
    setIsEditLeadOpen(true)
  }

  const updateLeadEditField = <K extends keyof LeadEditFormState>(field: K, value: LeadEditFormState[K]) => {
    setLeadEditForm((current) => current ? { ...current, [field]: value } : current)
  }

  const saveLeadEditor = async () => {
    if (!selectedLeadId || !leadEditForm || !leadEditForm.fullName.trim()) return
    if (leadEditTargetId !== selectedLeadId || selectedLead?.id !== leadEditTargetId) {
      setLeadEditError('The selected inquiry changed. Close this editor and reopen it for the correct inquiry.')
      return
    }
    setDetailSaving(true)
    setLeadEditError('')

    try {
      const opportunityValue = Number(leadEditForm.opportunityValue)
      const data = await fetchJsonWithTimeout<LeadDetail>(`/api/leads/${leadEditTargetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: leadEditForm.fullName,
          email: leadEditForm.email,
          phone: leadEditForm.phone,
          ...(leadEditForm.status !== selectedLead.status ? { status: leadEditForm.status } : {}),
          program_label: leadEditForm.programLabel,
          service_label: leadEditForm.serviceLabel,
          source_form: leadEditForm.sourceForm,
          source_page: leadEditForm.sourcePage,
          utm_source: leadEditForm.source,
          utm_campaign: leadEditForm.campaign,
          referrer: leadEditForm.referrer,
          payload: {
            ...(isLessonLead(selectedLead?.intake_type) ? { ...lessonRequestPayload(leadEditForm), parent_name: leadEditForm.fullName.trim() } : {}),
            source: leadEditForm.source,
            promotion_type: leadEditForm.promotionType || null,
            promotion_offer: leadEditForm.promotionOffer.trim() || null,
            ...(selectedLead?.intake_type === 'service_inquiry' ? {
              session_value: leadEditForm.opportunityValue.trim() && Number.isFinite(opportunityValue) ? Math.max(0, opportunityValue) : null,
              opportunity_value_unit: leadEditForm.opportunityValueUnit,
            } : {}),
            ...getProcessingFollowUpPayload(selectedLead, leadEditForm.status),
          },
        }),
      })

      setSelectedLead(data)
      setStatusValue(data.status)
      setNotesValue(data.contact?.notes || '')
      setFollowUpDate(toDateInputValue(getLeadFollowUpAt(data)))
      setFollowUpNote(getLeadFollowUpNote(data))
      setLessonOpportunity(getLessonOpportunityState(data))
      setLeads((current) => current.map((lead) => lead.id === data.id ? {
        ...lead,
        status: data.status,
        follow_up_at: data.follow_up_at ?? null,
        follow_up_note: data.follow_up_note ?? null,
        source: typeof data.payload?.source === 'string' ? data.payload.source : lead.source,
        source_form: data.source_form,
        source_page: data.source_page,
        utm_source: data.utm_source,
        program_label: data.program_label,
        service_label: data.service_label,
        utm_campaign: data.utm_campaign,
        referrer: data.referrer,
        updated_at: data.updated_at,
        contact: data.contact ? {
          id: data.contact.id,
          full_name: data.contact.full_name,
          email: data.contact.email,
          phone: data.contact.phone,
        } : lead.contact,
      } : lead))
      invalidateLeadListCache()
      setIsEditLeadOpen(false)
    } catch (error: unknown) {
      setLeadEditError(getErrorMessage(error, 'Could not save lead changes'))
    } finally {
      setDetailSaving(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  useEffect(() => {
    if (selectedLead && !leadBelongsToTab(selectedLead, activeTab)) {
      closeLead()
    }
  }, [activeTab, selectedLead])

  useEffect(() => {
    if (!isMobileLayout) setDetailPanelTab('details')
  }, [isMobileLayout])

  useEffect(() => {
    if (isMobileLayout && activeTab === 'job_application') setActiveTab('lesson_inquiry')
  }, [activeTab, isMobileLayout])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [activeTab, statusFilter])

  const leadTabItems = useMemo(
    () => LEAD_TABS
      .filter((tab) => !isMobileLayout || tab.key !== 'job_application')
      .map((tab) => ({ key: tab.key, label: tab.label, count: tabCounts[tab.key] ?? 0 })),
    [isMobileLayout, tabCounts],
  )

  const subtitle = useMemo(() => {
    if (loading) return 'Loading leads...'
    return `${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}`
  }, [loading, leads.length])
  const selectedCount = selectedIds.size
  const allVisibleSelected = visibleLeads.length > 0 && visibleLeads.every((lead) => selectedIds.has(lead.id))
  const deleteRecordLabel = activeTab === 'job_application' ? 'application' : 'lead'
  const deleteRecordLabelPlural = activeTab === 'job_application' ? 'applications' : 'leads'

  const selectedLeadType = selectedLead ? ((selectedLead.category === 'winback' || selectedLead.source_form === '2026-disenrollment-import') ? 'Disenrolled' : formatLabel(selectedLead.intake_type)) : 'Loading lead...'
  const selectedProgram = selectedLead ? formatSourcePage(selectedLead.source_page, selectedLead.program_label || selectedLead.service_label) : 'Loading...'
  const selectedSource = selectedLead ? getLeadSource(selectedLead, selectedLead.payload) : 'Loading...'
  const selectedCampaign = selectedLead?.utm_campaign || '—'
  const selectedReferrer = selectedLead?.referrer || '—'
  const selectedInitial = (selectedLead?.contact?.full_name || 'L').charAt(0).toUpperCase()
  const selectedLeadSignal = selectedLead ? getLeadSignal(selectedLead) : null
  const selectedLeadIndex = selectedLeadId ? leads.findIndex((lead) => lead.id === selectedLeadId) : -1
  const followUpAt = getLeadFollowUpAt(selectedLead)
  const lessonInstrument = typeof selectedLead?.payload?.instrument === 'string' ? selectedLead.payload.instrument : (selectedLead?.program_label || '—')

  const leadColumns = useMemo<DataTableColumn<LeadRecord, LeadSortKey>[]>(() => ([
    {
      id: 'signal',
      header: '',
      width: '44px',
      align: 'center',
      render: (lead) => {
        const signal = getLeadSignal(lead)
        return <div style={signalCellStyle} title={signal.label} aria-label={signal.label}>{signal.emoji}</div>
      },
    },
    {
      id: 'status',
      header: 'Status',
      width: 'minmax(86px, 0.72fr)',
      sortable: true,
      sortKey: 'status',
      defaultSortDirection: 'asc',
      sortLabel: 'Status, pipeline order from Won to Ghosted',
      render: (lead) => (
        <div style={tableStatusCellStyle}>
          <StatusBadge
            status={lead.status}
            label={activeTab === 'winback' ? formatLabel(String((lead.payload?.winback as Record<string, unknown> | undefined)?.status || 'to_contact')) : formatLabel(lead.status)}
          />
        </div>
      ),
    },
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(120px, 1fr)',
      sortable: true,
      sortKey: 'name',
      render: (lead) => <div title={lead.contact?.full_name || 'Unknown'} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><PersonName weight="semibold">{lead.contact?.full_name || 'Unknown'}</PersonName></div>,
    },
    {
      id: 'phone',
      header: 'Phone',
      width: 'minmax(140px, 0.9fr)',
      render: (lead) => <div style={secondaryCellStyle}>{leadTablePhone(lead.contact?.phone)}</div>,
    },
    {
      id: 'email',
      header: 'Email',
      width: 'minmax(200px, 1.25fr)',
      render: (lead) => <div style={secondaryCellStyle}>{lead.contact?.email || ''}</div>,
    },
    {
      id: 'followUp',
      header: 'Follow-up',
      width: 'minmax(84px, 0.55fr)',
      sortable: true,
      sortKey: 'followUp',
      render: (lead) => {
        const followUp = getLeadFollowUpAt(lead)
        if (!followUp || getFollowUpTone(followUp).urgency === 'none') return null
        const followUpTone = getFollowUpTone(followUp)
        return (
          <span title={followUpTone.label || 'Follow-up scheduled'} style={{ ...leadCardFollowUpStyle, fontVariantNumeric: 'tabular-nums', color: isUrgentFollowUp(followUpTone) ? followUpTone.color : colors.tableSecondary, fontWeight: isUrgentFollowUp(followUpTone) ? typography.weightBold : typography.weightMedium }}>
            {formatFollowUpDate(followUp)}
          </span>
        )
      },
    },
    {
      id: 'lastActivity',
      header: 'Last activity',
      width: 'minmax(130px, 0.9fr)',
      sortable: true,
      sortKey: 'lastActivity',
      defaultSortDirection: 'desc',
      render: (lead) => <div style={{ ...secondaryCellStyle, whiteSpace: 'nowrap' }}>{formatLastActivity(lead.last_activity_at)}</div>,
    },
    {
      id: 'program',
      header: activeTab === 'lesson_inquiry' || activeTab === 'winback' ? 'Program' : activeTab === 'job_application' ? 'Positions' : 'Service',
      sortLabel: activeTab === 'lesson_inquiry' || activeTab === 'winback' ? 'Program' : activeTab === 'job_application' ? 'Positions' : 'Service',
      width: 'minmax(150px, 1fr)',
      sortable: true,
      sortKey: 'program',
      render: (lead) => <div title={formatSourcePage(lead.source_page, lead.program_label || lead.service_label)} style={secondaryCellStyle}>{formatSourcePage(lead.source_page, lead.program_label || lead.service_label)}</div>,
    },
    {
      id: 'source',
      header: 'Source',
      width: 'minmax(110px, 0.7fr)',
      render: (lead) => <div style={secondaryCellStyle}>{lead.source_form ? formatLabel(lead.source_form) : ''}</div>,
    },
  // Retain the signal implementation for a future opt-in, but hide its column now.
  ] satisfies DataTableColumn<LeadRecord, LeadSortKey>[]).filter(column => column.id !== 'signal'), [activeTab])
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
  const lessonRequest = readLessonRequestFields(selectedLead?.payload)
  const lessonDays = lessonRequest.preferredDays || '—'
  const lessonTimes = lessonRequest.preferredTimes || '—'
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
  const lessonSiblingCount = normalizeFamilyMembers(lessonOpportunity.siblings).length
  const lessonOpportunityTotal = getLeadOpportunityValue({ intakeType: 'lesson_inquiry', payload: {
    potential_value_base: lessonBaseValue,
    discount_offer_applied: lessonOpportunity.siblingDiscountEnabled,
    siblings: lessonOpportunity.siblings,
  } })
  const lessonSiblingDiscountLabel = lessonOpportunity.siblingDiscountEnabled ? '10% sibling offer applied' : 'No sibling offer applied'
  const serviceSessionValue = selectedLead?.intake_type === 'service_inquiry'
    ? getServiceSessionValue(selectedLead)
    : null
  const manualServiceType = getServiceTypeByLabel(manualLeadForm.serviceLabel)
  const detailPanelTabItems = useMemo(() => LEAD_DETAIL_PANEL_TABS, [])

  const leadDetailPrimaryContent = selectedLead ? (
    <div style={isMobileLayout ? mobileLeadDetailSectionStyle : leadDetailLeftColumnStyle}>
      <div style={leadStatusSectionStyle}>
        <div style={leadStatusControlStyle}>
          {showStatusEditor ? (
            <Select
              id="lead-status-select"
              value={statusValue}
              onChange={(event) => void handleInlineStatusChange(event.target.value)}
              fullWidth={false}
              style={leadStatusSelectStyle}
              wrapperStyle={statusInlineSelectWrapStyle}
              disabled={detailSaving}
            >
              {getDetailStatusOptions(selectedLead.intake_type).map((option) => (
                <option key={option} value={option}>{formatLabel(option)}</option>
              ))}
            </Select>
          ) : (
            <>
              <StatusBadge status={selectedLead.status} label={formatLabel(statusValue)} style={leadStatusBadgeStyle} />
              <Button variant="secondary" size="sm" type="button" onClick={() => setShowStatusEditor(true)} >Update</Button>
            </>
          )}
        </div>
      </div>
      <div style={isMobileLayout ? quickActionStackStyle : quickActionRowStyle}>
        {selectedLead.contact?.email && (
          <QuickChip
            label={selectedLead.contact.email}
            width="wide"
            href={`mailto:${selectedLead.contact.email}`}
            action={(
              <ControlButton kind="icon"
                type="button"
                aria-label="Copy email address"
                onClick={(event) => {
                  event.stopPropagation()
                  void handleCopyEmail(selectedLead.contact!.email!)
                }}

              >
                <Copy size={16} />
              </ControlButton>
            )}
            fullWidth={isMobileLayout}
            align={isMobileLayout ? 'start' : 'center'}
          />
        )}
        {selectedLead.contact?.phone && (
          <QuickChip
            width="wide"
            label={formatPhoneNumber(selectedLead.contact.phone)}
            href={`tel:${selectedLead.contact.phone}`}
            fullWidth={isMobileLayout}
            align={isMobileLayout ? 'start' : 'center'}
          />
        )}
      </div>

      <DenseSectionPanel title={<SectionTitle style={sectionTitleMiniStyle}>Source & attribution</SectionTitle>} style={editorialSectionPanelStyle} contentStyle={sectionContentStyle}>
        <div style={isMobileLayout ? editorialDetailsGridMobileStyle : editorialDetailsGridStyle}>
          <Detail label="Source" value={selectedSource} />
          <Detail label="Source form" value={formatLabel(selectedLead.source_form)} />
          <Detail label="Campaign" value={formatLabel(selectedCampaign)} />
          <Detail label="Landing page" value={formatSourcePage(selectedLead.source_page)} />
          <Detail label="Referrer" value={selectedReferrer} />
        </div>
      </DenseSectionPanel>

      {isLessonLead(selectedLead.intake_type) && (
        <>
          <DenseSectionPanel title={<SectionTitle style={sectionTitleMiniStyle}>Lesson details</SectionTitle>} style={editorialSectionPanelStyle} contentStyle={sectionContentStyle}>
            <div style={isMobileLayout ? editorialDetailsGridMobileStyle : editorialDetailsGridStyle}>
              <Detail label="Program or instrument" value={lessonInstrument} />
              <Detail label="Student name" value={lessonRequest.studentName || '—'} />
              <Detail label="Age" value={lessonRequest.studentAge || '—'} />
              <Detail label="Preferred date" value={lessonRequest.preferredDate || '—'} />
              <Detail label="Time window" value={lessonRequest.timeWindow || '—'} />
              <Detail label="Experience" value={lessonRequest.experience || '—'} />
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
                      <Button variant="secondary" size="sm"
                        type="button"
                        onClick={() => setLessonOpportunity((current) => ({
                          ...current,
                          siblings: current.siblings.filter((_, siblingIndex) => siblingIndex !== index),
                        }))}

                      >
                        Remove
                      </Button>
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
                    siblings: normalizeFamilyMembers(lessonOpportunity.siblings),
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

      {!isLessonLead(selectedLead.intake_type) && (
        <>
          {selectedLead.intake_type === 'service_inquiry' && (
            <>
              <DenseSectionPanel title={<SectionTitle style={sectionTitleMiniStyle}>Service details</SectionTitle>} style={editorialSectionPanelStyle} contentStyle={sectionContentStyle}>
                <div style={isMobileLayout ? editorialDetailsGridMobileStyle : editorialDetailsGridStyle}>
                  <Detail label="Service" value={selectedLead.service_label || '—'} />
                  <Detail label="Request context" value={selectedProgram} />
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
          mentionsEnabled
          onSave={async (text, mentionMembershipIds) => { await saveDetail({ add_note: text, mention_membership_ids: mentionMembershipIds }) }}
        />
      </DenseSectionPanel>

      <DenseSectionPanel
        title={<SectionTitle style={sectionTitleMiniStyle}>Follow-up</SectionTitle>}
        actions={followUpAt ? (
          <Button type="button" variant="ghost" size="sm" onClick={clearFollowUp} disabled={detailSaving}>Clear</Button>
        ) : undefined}
        style={rightRailPanelStyle}
        contentStyle={sectionContentStyle}
      >
        <div style={followUpDateRowStyle}>
          <input
            type="date"
            value={followUpDate}
            onChange={(event) => setFollowUpDate(event.target.value)}
            style={{ ...inputStyle, width: 'auto', minWidth: '170px' }}
            aria-label="Follow-up date"
          />
          <div style={followUpChipsStyle}>
            {getQuickFollowUpDates().map(({ label, date }) => (
              <Button key={label} type="button" variant="secondary" size="sm" onClick={() => setFollowUpDate(toDateInputValue(date))}>{label}</Button>
            ))}
          </div>
        </div>
        <Textarea
          value={followUpNote}
          onChange={(event) => setFollowUpNote(event.target.value)}
          placeholder="Reminder note — e.g. “Parent said to reach back Monday.”"
          style={{ minHeight: '64px' }}
        />
        <div style={sectionFooterActionsStyle}>
          <Button type="button" variant="primary" size="sm" onClick={saveFollowUp} disabled={detailSaving || !followUpDate}>
            {detailSaving ? 'Saving…' : followUpAt ? 'Update follow-up' : 'Set follow-up'}
          </Button>
        </div>
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
                <span style={activityTitleStyle}>{getActivityActor(event) ? `${getActivityActor(event)} · ${formatActivity(event.event_type, event.event_label)}` : formatActivity(event.event_type, event.event_label)}</span>
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
      <div style={{ padding: spacing['3xl'], width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        <PageHeader
          title="Leads"
          subtitle={subtitle}
          right={(
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.sm, flexWrap: 'wrap' }}>
              <LeadEmailSync onSynced={async () => {
                invalidateLeadListCache()
                await fetchLeads({ force: true })
                const leadId = selectedLeadIdRef.current
                if (leadId) await fetchLeadDetail(leadId, selectedLead?.intake_type)
              }} />
            {activeTab === 'winback'
              ? <Button type="button" onClick={() => setIsWinbackImportOpen(true)}>Import students</Button>
              : <Button type="button" onClick={openAddLead}>+ Add Lead</Button>}
            </div>
          )}
        />

        <div style={kpiRowStyle}>
          <div style={valueCardStyle}>
            <div style={valueCardLabelStyle}>In pipeline</div>
            <div style={valueCardAmountStyle}>{formatCurrency(pipelineValue)}</div>
            <div style={valueCardMetaStyle}>Open service & lesson opportunity value</div>
          </div>
          <div style={valueCardStyle}>
            <div style={valueCardLabelStyle}>Closed since Oct 1</div>
            <div style={valueCardAmountStyle}>{formatCurrency(closedSinceOct1)}</div>
            <div style={valueCardMetaStyle}>Won opportunities</div>
          </div>
        </div>

        <div style={{ overflowX: 'auto', marginBottom: spacing.lg }}>
          <Tabs
            items={leadTabItems}
            activeKey={activeTab}
            onChange={tab => { setStatusFilter('all'); setActiveTab(tab) }}
            style={isMobileLayout ? { width: 'max-content', minWidth: '100%' } : undefined}
          />
        </div>

        <div style={filterBarStyle}>
          <Input aria-label="Search contacts and students" placeholder="Search contacts or students" value={inquirySearch} onChange={event => setInquirySearch(event.target.value)} />
          <ControlButton kind="toggle" aria-pressed={sortKey === 'action'} selected={sortKey === 'action'} title="Prioritize due follow-ups and active inquiries among loaded leads" onClick={() => { setSortKey('action'); setSortDirection('asc') }}>Action first</ControlButton>
          <Button type="button" variant="secondary" size="sm" onClick={exportLeads} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
          <Select
            aria-label="Filter leads by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={selectStyle}
            fullWidth={false}
            wrapperStyle={filterSelectWrapStyle}
          >
            {getStatusOptionsForTab(activeTab).map((option) => (
              <option key={option} value={option}>{activeTab === 'winback' ? `Disenrolled: ${formatLabel(option)}` : `Status: ${formatLabel(option)}`}</option>
            ))}
          </Select>
          {selectedCount > 0 && (
            <div style={bulkActionBarStyle}>
              <span style={bulkActionTextStyle}>{selectedCount} selected</span>
              {activeTab === 'winback' && <Button type="button" size="sm" onClick={() => setIsBulkComposeOpen(true)}>Message selected</Button>}
              <Button type="button" variant="destructive" size="sm" onClick={openDeleteModal}>
                Delete {deleteRecordLabelPlural}
              </Button>
            </div>
          )}
        </div>

        {error && <MessageBox>{error}</MessageBox>}

        {inquirySearch.trim() && <p style={subtleTextStyle}>{visibleLeads.length} matching loaded inquiries. Search includes contacts and students; load more to search additional inquiries.</p>}
        <ResponsiveDataTable
          groupedRows
          rows={sortedLeads}
          columns={leadColumns}
          getDetailRows={lead => !isLessonLead(lead.intake_type) ? [] : leadStudentDetailRows(lead.payload || {}, lead.program_label)
            .map((student, index) => ({ key: `${lead.id}-student-${index}`, cells: leadColumns.map(column => {
              if (column.id === 'name') return <div key={column.id} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><PersonName weight="normal">{student.name || 'Student name not recorded'}</PersonName></div>
              if (column.id === 'phone') return <div key={column.id} style={secondaryCellStyle}>{leadTablePhone(student.phone)}</div>
              if (column.id === 'email') return <div key={column.id} style={secondaryCellStyle}>{student.email || ''}</div>
              if (column.id === 'program') return <div key={column.id} style={secondaryCellStyle}>{student.instrument_interest || ''}</div>
              return null
            }) }))}
          getRowKey={(lead) => lead.id}
          sort={{ key: sortKey, direction: sortDirection }}
          onSortChange={(nextSort) => {
            setSortKey(nextSort.key)
            setSortDirection(nextSort.direction)
          }}
          selection={{
            selectedKeys: selectedIds,
            onToggle: (lead) => toggleLeadSelection(lead.id),
            onToggleAll: toggleSelectAllVisible,
            allSelected: allVisibleSelected,
            someSelected: visibleLeads.some(lead => selectedIds.has(lead.id)) && !allVisibleSelected,
            selectAllLabel: 'Select all visible leads',
            getRowLabel: (lead) => lead.contact?.full_name || 'lead',
          }}
          loading={loading}
          skeletonRows={6}
          emptyContent={(
            <EmptyState
              title={inquirySearch.trim() ? 'No matching inquiries' : `No ${LEAD_TABS.find((tab) => tab.key === activeTab)?.label.toLowerCase() || 'leads'} yet`}
              description={inquirySearch.trim() ? 'Try another contact or student name, or load more inquiries.' : activeTab === 'winback' ? 'Import a former-student CSV to begin your re-enrollment outreach.' : 'New website inquiries will show up here once your forms start posting to the intake API.'}
            />
          )}
          minDesktopWidth={1300}
          onRowClick={(lead) => openLead(lead.id, lead.intake_type)}
          getRowStyle={(lead, index) => ({
            background: selectedIds.has(lead.id)
              ? '#F5F8FF'
              : selectedLeadId === lead.id
                ? '#FBFCFF'
                : isNewLead(lead, Math.max(rowNow, Date.now()))
                  ? NEW_LEAD_ROW_BACKGROUND
                  : index % 2 === 0 ? colors.surface : colors.background,
          })}
          ariaLabel="Leads"
        />
        {hasMore && <Button type="button" variant="secondary" onClick={loadMoreLeads} disabled={loading || loadingMore} style={{ marginTop: spacing.lg }}>
          {loadingMore ? 'Loading…' : 'Load more leads'}
        </Button>}
      </div>

      <SlidePanel isOpen={isAddLeadOpen} onClose={closeAddLead} width="min(92vw, 640px)">
        <SlidePanelHeader
          title="Add lead"
          onClose={closeAddLead}
        />
        <div style={manualLeadPanelBodyStyle}>
          {manualLeadError && <MessageBox>{manualLeadError}</MessageBox>}

          <div style={manualLeadFormGridStyle}>
            <Select
              label="Lead type"
              value={manualLeadForm.intakeType}
              onChange={(event) => updateManualLeadField('intakeType', event.target.value as ManualLeadFormState['intakeType'])}
            >
              <option value="lesson_inquiry">Lesson inquiry</option>
              <option value="tour_request">Tour request</option>
              <option value="service_inquiry">Service inquiry</option>
            </Select>
            <Input
              label="Contact name"
              value={manualLeadForm.fullName}
              onChange={(event) => updateManualLeadField('fullName', event.target.value)}
              placeholder="Jane Smith"
              error={!manualLeadForm.fullName.trim() ? 'Required' : undefined}
            />
            <Input
              label="Email"
              type="email"
              value={manualLeadForm.email}
              onChange={(event) => updateManualLeadField('email', event.target.value)}
              placeholder="name@example.com"
            />
            <Input
              label="Phone"
              type="tel"
              value={manualLeadForm.phone}
              onChange={(event) => updateManualLeadField('phone', formatPhoneNumber(event.target.value))}
              placeholder="(555) 123-4567"
              error={!manualLeadForm.email.trim() && !manualLeadForm.phone.trim() ? 'Email or phone is required' : undefined}
            />
            {isLessonLead(manualLeadForm.intakeType) ? (
              <>
                <div style={{ gridColumn: '1 / -1' }}>
                  <LeadStudentsEditor students={manualLeadForm.students} onChange={students => updateManualLeadField('students', students)} disabled={manualLeadSaving} contact={{ name: manualLeadForm.fullName, email: manualLeadForm.email, phone: manualLeadForm.phone }} />
                </div>
              </>
            ) : (
              <>
                <Select
                  label="Service type"
                  value={manualLeadForm.serviceLabel}
                  onChange={(event) => updateManualLeadField('serviceLabel', event.target.value)}
                >
                  <option value="">Select service type</option>
                  {SERVICE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.label}>{option.label}</option>
                  ))}
                </Select>
                <div style={manualLeadSessionValueWrapStyle}>
                  <FieldLabel style={manualLeadStepperLabelStyle}>Session</FieldLabel>
                  <div style={manualLeadSessionValueStyle}>
                    {manualServiceType && manualServiceType.fee != null ? formatCurrency(manualServiceType.fee) : '—'}
                  </div>
                  <div style={manualLeadSessionHintStyle}>Fixed one-time fee</div>
                </div>
              </>
            )}
            <details style={{ gridColumn: '1 / -1', border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: spacing.md }}>
              <summary style={{ cursor: 'pointer', fontSize: typography.sizeSm }}>Attribution &amp; sourcing</summary>
              <div style={{ ...manualLeadFormGridStyle, marginTop: spacing.md }}>
                <Select
                  label="Source"
                  value={manualLeadForm.source}
                  onChange={(event) => updateManualLeadField('source', event.target.value as LeadSource)}
                >
                  {LEAD_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
                <Input
                  label="How did they find us"
                  value={manualLeadForm.referrer}
                  onChange={(event) => updateManualLeadField('referrer', event.target.value)}
                  placeholder="Google, parent referral, flyer…"
                />
                <Input
                  label="Campaign"
                  value={manualLeadForm.campaign}
                  onChange={(event) => updateManualLeadField('campaign', event.target.value)}
                  placeholder="Hot Chili Cool Cars"
                />
                <Select
                  label="Promotion type"
                  value={manualLeadForm.promotionType}
                  onChange={(event) => updateManualLeadField('promotionType', event.target.value)}
                >
                  {PROMOTION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
                <Input
                  label="Offer details"
                  value={manualLeadForm.promotionOffer}
                  onChange={(event) => updateManualLeadField('promotionOffer', event.target.value)}
                  placeholder="$5 first class or 40% off first month"
                />
              </div>
            </details>
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
              disabled={manualLeadSaving || manualLeadQueued || manualLeadForm.students.some(student => student.date_of_birth && !validBirthday(student.date_of_birth)) || !manualLeadForm.fullName.trim() || (!manualLeadForm.email.trim() && !manualLeadForm.phone.trim())}
            >
              {manualLeadSaving ? 'Saving…' : 'Create lead'}
            </Button>
          </div>
        </div>
      </SlidePanel>

      <SlidePanel isOpen={isDeleteOpen} onClose={closeDeleteModal} width="min(92vw, 520px)">
        <SlidePanelHeader
          title={`Delete ${deleteRecordLabelPlural}`}
          onClose={closeDeleteModal}
        />
        <div style={deletePanelBodyStyle}>
          <div style={deleteCopyStyle}>
            Permanently remove {selectedCount} selected {selectedCount === 1 ? deleteRecordLabel : deleteRecordLabelPlural}? This cannot be undone.
          </div>
          {deleteError && <MessageBox>{deleteError}</MessageBox>}
          <div style={manualLeadFooterStyle}>
            <Button type="button" variant="secondary" onClick={closeDeleteModal} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteSelected()}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting…' : `Delete ${deleteRecordLabelPlural}`}
            </Button>
          </div>
        </div>
      </SlidePanel>

      <SlidePanel isOpen={Boolean(selectedLeadId)} onClose={leadHistory.closePanel} closeOnBackdrop={!(correctionPrototype && isEditLeadOpen)} closeOnEscape={!(correctionPrototype && isEditLeadOpen)} fullScreen={isMobileLayout} width={PROFILE_PANEL_WIDTH}>
        <div style={leadPanelBodyStyle}>
          {detailError && <MessageBox>{detailError}</MessageBox>}
          {detailLoading && <ProfilePanelSkeleton />}

          {selectedLead && !detailLoading && (
            <LeadDetailPanel
              renderEditor={correctionPrototype && isEditLeadOpen ? renderHeader => <LeadInlineEditor key={selectedLead.id} lead={selectedLead} renderHeader={renderHeader} onClose={() => setIsEditLeadOpen(false)} onSaved={async () => { await openLead(selectedLead.id); invalidateLeadListCache(); await fetchLeads({ force: true }) }} /> : undefined}
              staticDetails={correctionPrototype}
              lead={selectedLead}
              saving={detailSaving}
              calling={callingLead}
              isMobile={isMobileLayout}
              onCall={handleCallLead}
              onSmsViewChange={setSmsViewOpen}
              onEdit={openLeadEditor}
              onClose={leadHistory.closePanel}
              draft={leadPanelDrafts[selectedLead.id] || EMPTY_LEAD_PANEL_DRAFT}
              onDraftChange={(draft) => updateLeadPanelDraft(selectedLead.id, draft)}
              onPatch={async (patch) => {
                return await saveDetail(patch)
              }}
            />
          )}
        </div>
        {selectedLead && !detailLoading && !smsViewOpen && !(correctionPrototype && isEditLeadOpen) && (
          <div style={{ ...leadFooterStyle, padding: isMobileLayout ? `${spacing.sm} ${spacing.md}` : leadFooterStyle.padding, justifyContent: isMobileLayout ? 'space-between' : 'flex-end', gap: isMobileLayout ? spacing.sm : spacing.md, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => openAdjacentLead('prev')}
              disabled={selectedLeadIndex <= 0}
            >
              Previous
            </Button>
            <span style={leadFooterCountStyle}>{leads.length > 0 ? `Lead ${selectedLeadIndex + 1} of ${leads.length}` : ''}</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => openAdjacentLead('next')}
              disabled={selectedLeadIndex < 0 || selectedLeadIndex >= leads.length - 1}
            >
              Next
            </Button>
          </div>
        )}
      </SlidePanel>



      <SlidePanel isOpen={isBulkComposeOpen} onClose={() => setIsBulkComposeOpen(false)} fullScreen={isMobileLayout} width="min(92vw, 720px)">
        <SlidePanelHeader title="Message selected Disenrolled students" subtitle={`${selectedCount} selected`} onClose={() => setIsBulkComposeOpen(false)} onBack={() => setIsBulkComposeOpen(false)} backLabel="Back to Disenrolled students" />
        <div style={{ flex: 1, minHeight: 0, overflow: isMobileLayout ? 'hidden' : 'auto' }}>
          <ComposePanel
            recipientCount={selectedCount}
            filterExplanation={`Disenrolled: ${selectedCount} selected former students`}
            recipientIds={leads.filter((lead) => selectedIds.has(lead.id)).map((lead) => lead.contact_id)}
            channel="sms"
            mode="bulk"
            recipientPreview={leads.filter((lead) => selectedIds.has(lead.id)).map((lead) => ({
              id: lead.contact_id,
              first_name: lead.contact?.full_name.split(' ')[0] || 'Student',
              last_name: lead.contact?.full_name.split(' ').slice(1).join(' ') || '',
            }))}
            onClose={() => setIsBulkComposeOpen(false)}
            onSent={() => window.setTimeout(() => setIsBulkComposeOpen(false), 3000)}
          />
        </div>
      </SlidePanel>

      <SlidePanel isOpen={isWinbackImportOpen} onClose={() => setIsWinbackImportOpen(false)} width="min(92vw, 680px)">
        <WinbackImportPanel onClose={() => setIsWinbackImportOpen(false)} onImported={async () => { setIsWinbackImportOpen(false); invalidateLeadListCache(); await fetchLeads({ force: true }) }} />
      </SlidePanel>

      <SlidePanel isOpen={isEditLeadOpen && !correctionPrototype} onClose={() => setIsEditLeadOpen(false)} width="min(92vw, 680px)">
        <SlidePanelHeader title="Edit lead" subtitle="Update contact details, request context, and attribution." onClose={() => setIsEditLeadOpen(false)} />
        {leadEditForm && (
          <div style={manualLeadPanelBodyStyle}>
            {leadEditError && <MessageBox>{leadEditError}</MessageBox>}
            <div style={manualLeadFormGridStyle}>
              <Input label={isLessonLead(selectedLead?.intake_type) ? "Parent / contact name" : "Full name"} value={leadEditForm.fullName} onChange={(event) => updateLeadEditField('fullName', event.target.value)} error={!leadEditForm.fullName.trim() ? 'Required' : undefined} />
              <Input label="Email" type="email" value={leadEditForm.email} onChange={(event) => updateLeadEditField('email', event.target.value)} />
              <Input label="Phone" type="tel" value={leadEditForm.phone} onChange={(event) => updateLeadEditField('phone', formatPhoneNumber(event.target.value))} />
              <Select label="Status" value={leadEditForm.status} onChange={(event) => updateLeadEditField('status', event.target.value)}>
                {getDetailStatusOptions(selectedLead?.intake_type || 'lesson_inquiry').map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
              </Select>
              {selectedLead?.intake_type === 'service_inquiry' ? (
                <>
                  <Input label="Service" value={leadEditForm.serviceLabel} onChange={(event) => updateLeadEditField('serviceLabel', event.target.value)} />
                  <Input label="Opportunity value" type="number" min="0" step="1" inputMode="decimal" value={leadEditForm.opportunityValue} onChange={(event) => updateLeadEditField('opportunityValue', event.target.value)} />
                  <Select label="Value period" value={leadEditForm.opportunityValueUnit} onChange={(event) => updateLeadEditField('opportunityValueUnit', event.target.value as OpportunityValueUnit)}>
                    <option value="mo">Monthly (/mo)</option>
                    <option value="session">One-time session (/session)</option>
                  </Select>
                </>
              ) : (
                <>
                  <Input label="Program or instrument" list="lead-program-options" value={leadEditForm.programLabel} onChange={(event) => updateLeadEditField('programLabel', event.target.value)} />
                  <datalist id="lead-program-options">{LESSON_PROGRAM_OPTIONS.map(option => <option key={option} value={option} />)}</datalist>
                  {isLessonLead(selectedLead?.intake_type) && <LessonRequestInputs value={leadEditForm} onChange={updateLeadEditField} />}
                </>
              )}
              <Select label="Source" value={leadEditForm.source} onChange={(event) => updateLeadEditField('source', event.target.value as LeadEditFormState['source'])}>
                {LEAD_SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
              <Input label="Source form" value={leadEditForm.sourceForm} onChange={(event) => updateLeadEditField('sourceForm', event.target.value)} placeholder="hot_chili_cool_cars_offer_form" />
              <Input label="Landing page" value={leadEditForm.sourcePage} onChange={(event) => updateLeadEditField('sourcePage', event.target.value)} placeholder="/special-offer" />
              <Input label="Campaign" value={leadEditForm.campaign} onChange={(event) => updateLeadEditField('campaign', event.target.value)} placeholder="Hot Chili Cool Cars" />
              <Select label="Promotion type" value={leadEditForm.promotionType} onChange={(event) => updateLeadEditField('promotionType', event.target.value)}>
                {PROMOTION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
              <Input label="Offer details" value={leadEditForm.promotionOffer} onChange={(event) => updateLeadEditField('promotionOffer', event.target.value)} placeholder="$5 first class or 40% off first month" />
              <Input label="Referrer" value={leadEditForm.referrer} onChange={(event) => updateLeadEditField('referrer', event.target.value)} placeholder="Google, event booth, family referral…" />
            </div>
            <div style={manualLeadFooterStyle}>
              <Button type="button" variant="secondary" onClick={() => setIsEditLeadOpen(false)} disabled={detailSaving}>Cancel</Button>
              <Button type="button" onClick={() => void saveLeadEditor()} disabled={detailSaving || !leadEditForm.fullName.trim()}>{detailSaving ? 'Saving…' : 'Save changes'}</Button>
            </div>
          </div>
        )}
      </SlidePanel>
    </>
  )
}

function LessonRequestInputs({ value, onChange, includeStudent = true }: {
  value: LessonRequestFields
  includeStudent?: boolean
  onChange: (field: keyof LessonRequestFields, value: string) => void
}) {
  return <>
    {includeStudent && <Input label="Student name" value={value.studentName} onChange={e => onChange('studentName', e.target.value)} />}
    {includeStudent && <Input label="Student birthday" type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} value={value.studentBirthday} onChange={e => onChange('studentBirthday', e.target.value)} hint={value.studentAge ? `Previously reported age: ${value.studentAge}; not a birthday.` : undefined} />}
    <Input label="Experience" value={value.experience} onChange={e => onChange('experience', e.target.value)} />
    <Input label="Available days" placeholder="Monday, Wednesday" value={value.preferredDays} onChange={e => onChange('preferredDays', e.target.value)} />
    <Input label="Preferred times" placeholder="After school, mornings" value={value.preferredTimes} onChange={e => onChange('preferredTimes', e.target.value)} />
    <Input label="Preferred date" type="date" value={value.preferredDate} onChange={e => onChange('preferredDate', e.target.value)} />
    <Input label="Time window" placeholder="Evening (4pm to 8pm)" value={value.timeWindow} onChange={e => onChange('timeWindow', e.target.value)} />
  </>
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
      {href ? <a href={href} style={quickChipLinkStyle}>{label}</a> : <span style={quickChipLabelStyle}>{label}</span>}
      {action ? <span style={quickChipActionWrapStyle}>{action}</span> : null}
    </CompactMetaCard>
  )

  return content
}

function MessageBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: radius.lg, padding: spacing.lg, fontSize: typography.sizeSm }}>
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

const signalCellStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: typography.sizeLg,
  lineHeight: 1,
}


const subtleTextStyle: React.CSSProperties = {
  fontSize: typography.sizeBase,
  color: colors.textSecondary,
  fontFamily: typography.fontSans,
  marginTop: spacing.xs,
  lineHeight: 1.45,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const cellTextStyle: React.CSSProperties = {
  fontSize: typography.sizeBase,
  color: colors.text,
  fontFamily: typography.fontSans,
  lineHeight: 1.45,
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const secondaryCellStyle: React.CSSProperties = {
  ...cellTextStyle, color: colors.tableSecondary, fontWeight: typography.weightNormal,
  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}

const tableCellStyle: React.CSSProperties = {
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const tableStatusCellStyle: React.CSSProperties = {
  ...tableCellStyle,
  display: 'flex',
  alignItems: 'center',
  gap: spacing.xs,
  flexWrap: 'wrap',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const leadPanelBodyStyle: React.CSSProperties = {
  padding: '0',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  background: colors.background,
  alignSelf: 'stretch',
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  boxSizing: 'border-box',
  minHeight: 0,
  flex: '1 1 auto',
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
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: spacing.lg,
}

const mobileDetailTabsStyle: React.CSSProperties = {
  paddingInline: spacing.md,
  background: colors.surface,
}

const leadHeroActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
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

const leadHeroAgeStyle: React.CSSProperties = {
  fontSize: typography.size15,
  fontWeight: typography.weightNormal,
  color: colors.textSecondary,
  fontFamily: typography.fontSans,
  whiteSpace: 'nowrap',
}

const leadHeroNameRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.sm,
  flexWrap: 'wrap',
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

const followUpBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '3px 10px',
  borderRadius: radius.full,
  fontSize: typography.sizeSm,
  fontWeight: typography.weightMedium,
  fontFamily: typography.fontSans,
  whiteSpace: 'nowrap',
}

const leadFooterStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: spacing.md,
  padding: `${spacing.md} ${spacing['2xl']}`,
  borderTop: `1px solid ${colors.borderLight}`,
  background: colors.surface,
  flexShrink: 0,
}

const leadFooterCountStyle: React.CSSProperties = {
  fontSize: typography.sizeSm,
  color: colors.textSecondary,
  fontFamily: typography.fontSans,
  whiteSpace: 'nowrap',
}

const followUpDateRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: spacing.sm,
}

const followUpChipsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: spacing.xs,
}

const leadCardFollowUpStyle: React.CSSProperties = {
  display: 'inline',
  fontSize: typography.sizeBase,
  fontWeight: typography.weightNormal,
  fontFamily: typography.fontSans,
  lineHeight: 1.45,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const kpiRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: spacing.md,
  marginBottom: spacing.lg,
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

const leadStatusSectionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: `${spacing.md} 0`,
  borderBottom: `1px solid ${colors.borderLight}`,
}

const leadStatusControlStyle: React.CSSProperties = {
  ...inlineRowStyle,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
}

const editContactIconButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  padding: 0,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  background: colors.surface,
  color: colors.textSecondary,
  cursor: 'pointer',
}

const leadStatusSelectStyle: React.CSSProperties = {
  width: 'auto',
  border: `1px solid ${colors.textSecondary}`,
  borderRadius: radius.md,
  background: colors.surface,
  color: colors.text,
  outline: `2px solid ${colors.borderLight}`,
  outlineOffset: '0',
  boxShadow: 'none',
  padding: `${spacing.sm} ${spacing.md}`,
  fontSize: '16px',
  fontWeight: typography.weightSemibold,
  fontFamily: typography.fontSans,
  lineHeight: 1.2,
  appearance: 'auto',
  boxSizing: 'border-box',
}

const statusInlineSelectWrapStyle: React.CSSProperties = {
  width: 'auto',
  flex: '0 0 auto',
}

const leadStatusBadgeStyle: React.CSSProperties = {
  fontWeight: typography.weightSemibold,
}

const leadStatusActionStyle: React.CSSProperties = {
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  color: colors.text,
  fontSize: typography.sizeSm,
  fontWeight: typography.weightMedium,
  fontFamily: typography.fontSans,
  cursor: 'pointer',
  padding: '7px 10px',
}

const quickActionRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
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
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  columnGap: spacing.sm,
  rowGap: spacing.md,
}

const editorialDetailsGridMobileStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  columnGap: spacing.sm,
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
  color: colors.link,
  cursor: 'pointer',
  padding: 0,
  fontSize: typography.sizeSm,
  textDecoration: 'none',
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


const manualLeadStepperLabelStyle: React.CSSProperties = {
  marginBottom: 0,
  fontSize: typography.sizeSm,
  fontWeight: typography.weightMedium,
  color: colors.text,
  fontFamily: typography.fontSans,
}



const manualLeadSessionValueWrapStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.xs,
}

const manualLeadSessionValueStyle: React.CSSProperties = {
  fontSize: typography.sizeXl,
  color: colors.text,
  fontWeight: typography.weightSemibold,
  lineHeight: 1.15,
  fontFamily: typography.fontSans,
}

const manualLeadSessionHintStyle: React.CSSProperties = {
  fontSize: typography.sizeXs,
  color: colors.textSecondary,
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
