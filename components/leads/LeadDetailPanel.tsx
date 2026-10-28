'use client'


import { ControlButton } from '@/components/ui/ControlButton'
import ConversationComposeLink from '@/components/inbox/ConversationComposeLink'
import { useContext, useEffect, useState, type CSSProperties } from 'react'
import CardSmsComposer from '@/components/inbox/CardSmsComposer'
import { ConversationComposeContext } from '@/components/inbox/ConversationComposeContext'
import { Copy, Pencil, Phone } from 'lucide-react'
import { Button, CompactMetaCard, DenseSectionPanel, Input, NotesSection, NotificationCard, SectionTitle, Select, SlidePanelHeader, Textarea, type NotificationTone } from '@/components/ui'
import { colors, radius, semanticColors, spacing, typography } from '@/lib/tokens'
import { formatPhoneNumber } from '@/lib/phone'
import { LeadActivitySection } from './LeadActivitySection'
import { Disclosure } from '@/components/ui/Disclosure'
import { getFollowUpTone } from '@/lib/follow-up'
import { formatLeadSource } from '@/lib/lead-sources'
import { isLessonLead, readLessonRequestFields } from '@/lib/lead-lesson-details'
import { getLeadOpportunityValue } from '@/lib/lead-value'
import { normalizeFamilyMembers } from '@/lib/lead-family'
import { type LeadStudent, readLeadStudents, leadStudentsPatch } from '@/lib/lead-students'
import { LeadStudentsEditor } from './LeadStudentsEditor'
import { LEAD_STATUSES, formatLeadStatus } from '@/lib/lead-status'
import { readStatusAutomation } from '@/lib/lead-status-automation'
import { reviewWinbackHierarchy } from '@/lib/winback-hierarchy'

type LeadDraft = { note?: string; followUpDate?: string; followUpNote?: string }
type OpportunityValueUnit = 'mo' | 'session'
type ServiceEditorState = { types: string[]; newType: string; opportunityValue: string; opportunityValueUnit: OpportunityValueUnit }

type LeadEvent = {
  id: string
  event_type: string
  event_label: string | null
  payload?: Record<string, unknown>
  created_at: string
}

type LeadDetail = {
  id: string
  intake_type: string
  status: string
  created_at: string
  source_form: string
  source_page: string | null
  utm_campaign?: string | null
  referrer?: string | null
  follow_up_at?: string | null
  follow_up_note?: string | null
  program_label: string | null
  service_label: string | null
  payload: Record<string, unknown>
  contact?: { id?: string; full_name: string; email: string | null; phone: string | null } | null
  notes_history?: Array<{ text: string; timestamp: string; actor_name?: string | null }>
  events?: LeadEvent[]
}

interface LeadDetailPanelProps {
  staticDetails?: boolean
  lead: LeadDetail
  saving: boolean
  onPatch: (patch: Record<string, unknown>) => Promise<boolean>
  onCall: () => Promise<void>
  onCompose?: () => void
  onSmsViewChange?: (open: boolean) => void
  onEdit: () => void
  onClose: () => void
  calling: boolean
  isMobile: boolean
  draft: LeadDraft
  onDraftChange: (draft: LeadDraft) => void
}

const LOST_REASONS = [
  { value: 'ghosted', label: 'Ghosted' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'price', label: 'Price' },
  { value: 'competitor', label: 'Went with competitor' },
  { value: 'scheduling_conflict', label: 'Scheduling conflict' },
  { value: 'other', label: 'Other' },
  { value: 'disenrolled', label: 'Disenrolled' },
]
const WINBACK_STATUSES = [
  { value: 'to_contact', label: 'To contact' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'interested', label: 'Interested' },
  { value: 're_enrolled', label: 'Re-enrolled' },
  { value: 'closed', label: 'Closed' },
]
const QUICK_FOLLOW_UPS = [
  { value: 'tomorrow', label: 'Tomorrow', days: 1 },
  { value: 'next_week', label: 'Next week', days: 7 },
  { value: 'next_month', label: 'Next month', days: 30 },
]

function normalizeServiceType(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function getServiceTypes(lead: LeadDetail) {
  const payloadTypes = Array.isArray(lead.payload.service_types)
    ? lead.payload.service_types.filter((value): value is string => typeof value === 'string').map(normalizeServiceType).filter(Boolean)
    : []
  if (payloadTypes.length > 0) return [...new Set(payloadTypes)]

  if (lead.service_label) return [...new Set(lead.service_label.split(',').map(normalizeServiceType).filter(Boolean))]

  const payloadType = typeof lead.payload.service_type === 'string' ? normalizeServiceType(lead.payload.service_type.replace(/-/g, ' ')) : ''
  return payloadType ? [payloadType] : []
}

function appendServiceType(current: ServiceEditorState): ServiceEditorState {
  const nextType = normalizeServiceType(current.newType)
  if (!nextType || current.types.some((value) => normalizeServiceType(value).toLowerCase() === nextType.toLowerCase())) {
    return { ...current, newType: '' }
  }
  return { ...current, types: [...current.types, nextType], newType: '' }
}

function getOpportunityValueUnit(payload: Record<string, unknown>): OpportunityValueUnit {
  return payload.opportunity_value_unit === 'mo' ? 'mo' : 'session'
}

function label(value: string) {
  return formatLeadStatus(value)
}

// Future follow-ups stay neutral, today is a nudge, and overdue is a problem.
function followUpCardTone(urgency: ReturnType<typeof getFollowUpTone>['urgency']): NotificationTone {
  if (urgency === 'overdue') return 'danger'
  if (urgency === 'today') return 'warning'
  return 'neutral'
}

function dateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not provided'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function dateInputValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type StatusTone = 'booked' | keyof Pick<typeof semanticColors, 'success' | 'danger' | 'warning'>

const STATUS_TONE_BY_STATUS: Record<string, StatusTone> = {
  new: 'warning',
  contacted: 'warning',
  booked: 'booked',
  processing: 'success',
  won: 'success',
  lost: 'danger',
}

function getStatusTone(status: string) {
  if (status === 'new') return semanticColors.newLead
  if (status === 'contacted') return { background: '#FEF3C7', text: '#92400E', border: '#D97706' }
  if (status === 'booked') return { background: '#EFF6FF', text: '#1D4ED8', border: '#2563EB' }
  if (status === 'processing' || status === 'won') return { background: '#F0FDF4', text: '#15803D', border: colors.success }
  if (status === 'lost' || status === 'ghosted' || status === 'ghosted_us') return { background: colors.espresso, text: '#FFFFFF', border: colors.espresso }
  const tone = STATUS_TONE_BY_STATUS[status]
  return tone === 'booked' || !tone ? semanticColors.warning : semanticColors[tone]
}

function statusLabel(status: string, payload: Record<string, unknown>) {
  if (status !== 'lost') return label(status)
  const lostReason = typeof payload.lost_reason === 'string' ? LOST_REASONS.find((reason) => reason.value === payload.lost_reason)?.label : undefined
  return lostReason ? `Lost — ${lostReason}` : 'Lost'
}

function getActivityTone(event: LeadEvent) {
  if (event.event_type === 'lead_lost') return semanticColors.danger
  const updates = event.payload?.updates
  if (updates && typeof updates === 'object' && typeof (updates as Record<string, unknown>).status === 'string') {
    return getStatusTone((updates as Record<string, string>).status)
  }
  if (event.event_type === 'call_started' || event.event_type === 'text_sent') return semanticColors.accent
  return semanticColors.neutral
}

function getNumericPayloadValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function activityLabel(event: LeadEvent) {
  if (event.event_type === 'created') return 'Lead created'
  if (event.event_type === 'updated') return 'Lead updated'
  if (event.event_type === 'contact_updated') return 'Contact updated'
  if (event.event_type === 'follow_up_scheduled') return 'Follow-up updated'
  if (event.event_type === 'follow_up_cleared') return 'Follow-up cleared'
  if (event.event_type === 'lead_lost') return 'Lead marked lost'
  if (event.event_type === 'call_started') return 'Call placed'
  return event.event_label || label(event.event_type)
}

function activityActor(event: LeadEvent) {
  const actor = event.payload?.actor
  return actor && typeof actor === 'object' && typeof (actor as Record<string, unknown>).displayName === 'string'
    ? (actor as Record<string, string>).displayName
    : null
}

function Field({ label: fieldLabel, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={fieldLabelStyle}>{fieldLabel}</div>
      <div title={value || undefined} style={{ ...fieldValueStyle, color: value ? colors.text : colors.textMuted }}>{value || 'Not provided'}</div>
    </div>
  )
}

export function LeadDetailPanel({ lead, saving, onPatch, onCall, onEdit, onClose, calling, isMobile, draft, onDraftChange, onSmsViewChange, staticDetails = false }: LeadDetailPanelProps) {
  const contextualCompose = useContext(ConversationComposeContext)
  const [smsOpen, setSmsOpen] = useState(false)
  const [mobileSection, setMobileSection] = useState<'details' | 'notes'>('details')
  useEffect(() => { setSmsOpen(false); setMobileSection('details') }, [lead.id])
  const [serviceEditing, setServiceEditing] = useState(false)
  const [lostOpen, setLostOpen] = useState(false)
  const [lostReason, setLostReason] = useState('')
  const [stageSelection, setStageSelection] = useState('')
  const [copied, setCopied] = useState(false)
  const [lesson, setLesson] = useState({ accountHolderName: '', instrument: '', experience: '', days: '', times: '' })
  const [students, setStudents] = useState<LeadStudent[]>([])
  const [serviceEditor, setServiceEditor] = useState<ServiceEditorState>({ types: [], newType: '', opportunityValue: '', opportunityValueUnit: 'session' })
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpNote, setFollowUpNote] = useState('')

  const isLesson = isLessonLead(lead.intake_type)
  const lessonRequest = readLessonRequestFields(lead.payload)
  const isService = lead.intake_type === 'service_inquiry'
  const serviceValue = getNumericPayloadValue(lead.payload, 'session_value')
  const familyMembers = students.slice(1)
  const opportunity = isLesson ? getLeadOpportunityValue({ intakeType: lead.intake_type, payload: { ...lead.payload, siblings: familyMembers } }) : isService ? serviceValue : null
  const familyMemberCount = normalizeFamilyMembers(familyMembers).length
  const familyDirty = JSON.stringify(students) !== JSON.stringify(readLeadStudents(lead.payload, lead.program_label))
  const opportunityUnit = isLesson ? '/mo' : isService ? `/${getOpportunityValueUnit(lead.payload)}` : ''
  const urgency = getFollowUpTone(lead.follow_up_at)
  const activityEvents = (lead.events || []).filter((event) => event.event_type !== 'note_added')
  const winback = lead.payload.winback && typeof lead.payload.winback === 'object' ? lead.payload.winback as Record<string, unknown> : null
  const automation = readStatusAutomation(lead.payload)
  const automationEligible = (isLesson || isService) && !winback && lead.source_form !== '2026-disenrollment-import'
  const automaticChange = automation.last_change
  const canUndoAutomaticChange = !automation.paused && automaticChange && lead.status === automaticChange.next_status
  const winbackStatus = typeof winback?.status === 'string' ? winback.status : 'to_contact'
  const disenrollmentDate = typeof winback?.disenrollment_date === 'string' ? winback.disenrollment_date : ''
  const disenrollmentMonth = typeof winback?.disenrollment_month === 'string' ? winback.disenrollment_month : ''

  useEffect(() => {
    setLesson({
      accountHolderName: typeof lead.payload.account_holder_name === 'string' ? lead.payload.account_holder_name : '',
      instrument: typeof lead.payload.instrument === 'string' ? lead.payload.instrument : '',
      experience: readLessonRequestFields(lead.payload).experience,
      days: readLessonRequestFields(lead.payload).preferredDays,
      times: readLessonRequestFields(lead.payload).preferredTimes,
    })
    setStudents(readLeadStudents(lead.payload, lead.program_label))
    setServiceEditor({
      types: getServiceTypes(lead),
      newType: '',
      opportunityValue: getNumericPayloadValue(lead.payload, 'session_value')?.toString() || '',
      opportunityValueUnit: getOpportunityValueUnit(lead.payload),
    })
    setFollowUpDate(draft.followUpDate ?? (lead.follow_up_at ? lead.follow_up_at.slice(0, 10) : ''))
    setFollowUpNote(draft.followUpNote ?? lead.follow_up_note ?? '')
    setServiceEditing(false)
    setLostOpen(false)
    setLostReason('')
    setStageSelection('')
  }, [draft.followUpDate, draft.followUpNote, lead])

  const copyEmail = async () => {
    if (!lead.contact?.email) return
    try {
      await navigator.clipboard.writeText(lead.contact.email)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  const saveFollowUp = async () => {
    if (!followUpDate) return
    const saved = await onPatch({ payload: { follow_up_at: new Date(`${followUpDate}T12:00:00`).toISOString(), follow_up_note: followUpNote.trim() || null } })
    if (saved) onDraftChange({ ...draft, followUpDate: undefined, followUpNote: undefined })
  }

  const clearFollowUp = async () => {
    const saved = await onPatch({ payload: { follow_up_at: null, follow_up_note: null } })
    if (saved) {
      setFollowUpDate('')
      setFollowUpNote('')
      onDraftChange({ ...draft, followUpDate: undefined, followUpNote: undefined })
    }
  }

  const resetServiceEditor = () => {
    setServiceEditor({
      types: getServiceTypes(lead),
      newType: '',
      opportunityValue: getNumericPayloadValue(lead.payload, 'session_value')?.toString() || '',
      opportunityValueUnit: getOpportunityValueUnit(lead.payload),
    })
  }

  const saveServiceDetails = async () => {
    const editorWithPendingType = appendServiceType(serviceEditor)
    const serviceTypes = editorWithPendingType.types.map(normalizeServiceType).filter(Boolean)
    const opportunityValue = Number(editorWithPendingType.opportunityValue)
    const saved = await onPatch({
      service_label: serviceTypes.join(', '),
      payload: {
        service_types: serviceTypes,
        service_type: serviceTypes[0]?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || null,
        session_value: editorWithPendingType.opportunityValue.trim() && Number.isFinite(opportunityValue) ? Math.max(0, opportunityValue) : null,
        opportunity_value_unit: editorWithPendingType.opportunityValueUnit,
      },
    })
    if (saved) setServiceEditing(false)
  }

  const saveStudents = async () => {
    await onPatch(leadStudentsPatch(students, lead.payload))
  }

  const hierarchyReview = reviewWinbackHierarchy(lead)
  const studentsSection = staticDetails ? <>
    <DenseSectionPanel title={<SectionTitle>Contact</SectionTitle>}>
      <div style={twoColumnStyle}>
        <Field label="Lead type" value={label(lead.intake_type)} />
        <Field label="Contact name" value={lead.contact?.full_name || ''} />
        <Field label="Email" value={lead.contact?.email || ''} />
        <Field label="Phone" value={formatPhoneNumber(lead.contact?.phone) || ''} />
      </div>
    </DenseSectionPanel>
    <DenseSectionPanel title={<SectionTitle>Students</SectionTitle>}>
      <div style={stackStyle}>{readLeadStudents(lead.payload, lead.program_label).map((student, index) => <div key={index} style={{ ...stackStyle, borderTop: index ? `1px solid ${colors.border}` : undefined, paddingTop: index ? spacing.md : undefined }}>
        <div style={twoColumnStyle}>
          <Field label="Student name" value={student.name} />
          <Field label="Email" value={student.email} />
          <Field label="Phone" value={formatPhoneNumber(student.phone) || ''} />
          <Field label="Birthday" value={student.date_of_birth} />
          <Field label="Relationship" value={label(student.relationship_to_contact)} />
        </div>
        <div style={twoColumnStyle}>
          <Field label="Service" value={[...new Set(student.instrument_interest.split(',').map(item => item.trim().startsWith('Semi-private · ') ? 'Semi-private' : item.trim().startsWith('Private · ') ? 'Private' : ['Tiny Keys', 'Little Rockers', 'Band'].includes(item.trim()) ? 'Group' : '').filter(Boolean))].join(', ')} />
          <Field label="Program" value={student.instrument_interest} />
          <Field label="Experience" value={student.preferences?.experience || ''} />
          <Field label="Available days" value={student.preferences?.preferredDays || ''} />
          <Field label="Preferred times" value={student.preferences?.preferredTimes || ''} />
        </div>
      </div>)}</div>
    </DenseSectionPanel>
  </> : <>
    {hierarchyReview && <DenseSectionPanel title={<SectionTitle>Win-back contact review</SectionTitle>}>
      <p role="status" style={{ fontSize: typography.sizeSm }}>{hierarchyReview.warning}</p>
      <Field label="Imported contact label (unverified role)" value={hierarchyReview.importedContactLabel} />
      <Field label="Recorded parent / contact" value={hierarchyReview.recordedParentName} />
      <Field label="Recorded student" value={hierarchyReview.recordedStudentName} />
      {hierarchyReview.duplicateStudentRows && <p role="alert">The same student name appears in the main student and sibling rows. Review the original records; no rows have been merged or removed.</p>}
    </DenseSectionPanel>}
    <LeadStudentsEditor key={lead.id} students={students} onChange={setStudents} disabled={saving} dirty={familyDirty} onSave={() => void saveStudents()} contact={lead.source_form === '2026-disenrollment-import' ? undefined : { name: lead.contact?.full_name || '', email: lead.contact?.email || '', phone: lead.contact?.phone || '' }} />
    <p style={{ fontSize: typography.sizeSm, color: colors.textSecondary }}>One inquiry, one status. The contact can also be a learner. Notes, communication and follow-up are shared across these students; messaging remains addressed to the inquiry contact.</p>
    {typeof lead.payload.family_members_interested === 'number' && lead.payload.family_members_interested > students.length && <p role="status">The inquiry reports {lead.payload.family_members_interested} interested people; only {students.length} student rows are available. Confirm the missing details with the contact.</p>}
  </>

  const statusTone = getStatusTone(lead.status)
  const contactName = lead.contact?.full_name || 'Unknown lead'
  const contactNameParts = contactName.trim().split(/\s+/)
  const contactFirstName = contactNameParts[0] || 'L'
  const contactLastName = contactNameParts.slice(1).join(' ') || contactFirstName
  const statusStageSelect = (
    <Select
      aria-label="Change lead status"
      value={stageSelection}
      fullWidth={isMobile}
      disabled={saving}
      style={{
        ...(isMobile ? { minHeight: '36px', width: '100%' } : statusStageSelectStyle),
        ...(lead.status === 'new' ? newStatusSelectStyle : {}),
      }}
      onChange={(event) => {
        const stage = event.target.value
        setStageSelection('')
        if (stage === 'lost') setLostOpen(true)
        else if (stage) void onPatch({ status: stage })
      }}
    >
      <option value="" disabled>Change status</option>
      {LEAD_STATUSES.map((stage) => <option key={stage} value={stage}>{label(stage)}</option>)}
    </Select>
  )

  const statusControls = lead.intake_type !== 'job_application' && (
    <div style={{ ...statusClusterRowStyle, justifyContent: isMobile ? 'flex-start' : 'flex-end', width: isMobile ? '100%' : 'auto' }}>
      <div style={{ ...statusClusterStyle, background: statusTone.background, borderColor: statusTone.border, minWidth: 0, maxWidth: '100%' }}>
        <span style={{ ...statusLabelStyle, color: statusTone.text, whiteSpace: isMobile ? 'normal' : 'nowrap' }}>{statusLabel(lead.status, lead.payload)}</span>
        {!staticDetails && !isMobile && <>
          <span style={{ ...statusDividerStyle, background: statusTone.border }} aria-hidden="true" />
          {statusStageSelect}
        </>}
      </div>
      {!staticDetails && isMobile && statusStageSelect}
    </div>
  )

  if (smsOpen && lead.contact?.id) return <CardSmsComposer backDestination="lead" recipientId={lead.contact.id} name={contactName}
    leadId={lead.intake_type === 'job_application' ? undefined : lead.id}
    onBack={() => { setSmsOpen(false); onSmsViewChange?.(false) }} onClose={onClose} />

  const notesRail = (
    <div aria-label="Lead notes and follow-up" style={notesRailStyle}>
              <NotesSection key={lead.id} title="Notes" panel notes={lead.notes_history || []} avatarInitial={(lead.contact?.full_name || "L").charAt(0)} avatarBg={colors.crimson} cardBg={colors.surfaceMuted} saving={saving} draft={draft.note} onDraftChange={(note) => onDraftChange({ ...draft, note })} mentionsEnabled onSave={(text, mentionMembershipIds) => onPatch({ add_note: text, mention_membership_ids: mentionMembershipIds }).then((saved) => { if (saved) onDraftChange({ ...draft, note: undefined }); return saved })} />
              {staticDetails ? <DenseSectionPanel title={<SectionTitle>Follow-up</SectionTitle>} style={followUpSectionStyle}><Field label="Date" value={lead.follow_up_at ? dateLabel(lead.follow_up_at) : ''} /><Field label="Reminder note" value={lead.follow_up_note || ''} /></DenseSectionPanel> : isMobile ? <Disclosure summary={<SectionTitle style={{ marginBottom: 0 }}>Follow-up</SectionTitle>} style={{ flexShrink: 0, padding: spacing.md }}>
                <div style={stackStyle}><div style={twoColumnStyle}><Input label="Date" type="date" value={followUpDate} onChange={(event) => { setFollowUpDate(event.target.value); onDraftChange({ ...draft, followUpDate: event.target.value }) }} /><Select label="Quick pick" value="" onChange={(event) => { const chosen = QUICK_FOLLOW_UPS.find((item) => item.value === event.target.value); if (chosen) { const date = new Date(); date.setDate(date.getDate() + chosen.days); const value = dateInputValue(date); setFollowUpDate(value); onDraftChange({ ...draft, followUpDate: value }) } }}><option value="">Choose an interval</option>{QUICK_FOLLOW_UPS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div><Textarea label="Reminder note" value={followUpNote} onChange={(event) => { setFollowUpNote(event.target.value); onDraftChange({ ...draft, followUpNote: event.target.value }) }} placeholder="Optional reminder note" style={{ minHeight: spacing["4xl"] }} /><div style={actionRowStyle}><Button type="button" size="sm" disabled={saving || !followUpDate} onClick={() => void saveFollowUp()}>{saving ? "Saving…" : "Update follow-up"}</Button></div></div>
              </Disclosure> : <DenseSectionPanel title={<SectionTitle>Follow-up</SectionTitle>} style={followUpSectionStyle}>
                <div style={stackStyle}><div style={twoColumnStyle}><Input label="Date" type="date" value={followUpDate} onChange={(event) => { setFollowUpDate(event.target.value); onDraftChange({ ...draft, followUpDate: event.target.value }) }} /><Select label="Quick pick" value="" onChange={(event) => { const chosen = QUICK_FOLLOW_UPS.find((item) => item.value === event.target.value); if (chosen) { const date = new Date(); date.setDate(date.getDate() + chosen.days); const value = dateInputValue(date); setFollowUpDate(value); onDraftChange({ ...draft, followUpDate: value }) } }}><option value="">Choose an interval</option>{QUICK_FOLLOW_UPS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div><Textarea label="Reminder note" value={followUpNote} onChange={(event) => { setFollowUpNote(event.target.value); onDraftChange({ ...draft, followUpNote: event.target.value }) }} placeholder="Optional reminder note" style={{ minHeight: spacing["4xl"] }} /><div style={actionRowStyle}><Button type="button" size="sm" disabled={saving || !followUpDate} onClick={() => void saveFollowUp()}>{saving ? "Saving…" : "Update follow-up"}</Button></div></div>
              </DenseSectionPanel>}
              <LeadActivitySection key={lead.id} entries={activityEvents.map((event) => <div key={event.id} style={activityRowStyle}><span style={{ ...activityMarkerStyle, background: getActivityTone(event).border }} aria-hidden="true" /><div style={activityContentStyle}><div style={activityTitleStyle}>{activityActor(event) ? `${activityActor(event)} · ${activityLabel(event)}` : activityLabel(event)}</div><div style={activityTimeStyle}>{dateLabel(event.created_at)} · {new Date(event.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div></div></div>)} />
            </div>
  )

  return (
    <div
      className="lead-detail-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        alignSelf: 'stretch',
        minHeight: 0,
        minWidth: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        background: colors.background,
      }}
    >
      <SlidePanelHeader
        title={contactName}
        subtitle={`${label(lead.intake_type)} · ${dateLabel(lead.created_at)}`}
        avatar={{ firstName: contactFirstName, lastName: contactLastName, size: isMobile ? 36 : 48 }}
        titleSize={isMobile ? typography.sizeLg : typography.size2xl}
        compact={isMobile}
        onClose={onClose}
        titleBadge={<ControlButton kind="icon" type="button" aria-label="Edit lead" title="Edit lead" onClick={onEdit} style={{ width: '28px' }}><Pencil size={15} /></ControlButton>}
        actions={isMobile ? undefined : (statusControls || undefined)}
      />

      {isMobile && <div role="group" aria-label="Lead panel section" style={{ display: 'flex', gap: spacing.sm, padding: spacing.sm, flexShrink: 0 }}>
        <ControlButton kind="tab" selected={mobileSection === 'details'} aria-pressed={mobileSection === 'details'} onClick={() => setMobileSection('details')}>Details</ControlButton>
        <ControlButton kind="tab" selected={mobileSection === 'notes'} aria-pressed={mobileSection === 'notes'} onClick={() => setMobileSection('notes')}>Notes & activity</ControlButton>
      </div>}
      <div style={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflowY: isMobile && mobileSection === 'details' ? 'auto' : 'hidden',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {isMobile && statusControls && (
          <div style={{ padding: '12px 16px 0', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            {statusControls}
          </div>
        )}

        {automationEligible && canUndoAutomaticChange && automaticChange && (
          <div style={{ padding: isMobile ? '12px 16px 0' : `${spacing.md} ${spacing.lg} 0`, fontSize: typography.sizeSm, color: colors.textSecondary }}>
            {canUndoAutomaticChange && automaticChange ? (
              <div role="status" style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                <span title={automaticChange.evidence}>Automatically moved to {formatLeadStatus(automaticChange.next_status)} — {automaticChange.reason}.</span>
                <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => void onPatch({ status_automation_action: 'undo', status_automation_change_id: automaticChange.id })}>Undo</Button>
              </div>
            ) : null}
          </div>
        )}

      <>
        {lostOpen && (
          <div style={{ ...lostSectionStyle, padding: isMobile ? '12px 16px 0' : `${spacing.md} ${spacing.lg} 0` }}>
            <div style={lostStyle}>
              <Select label="Lost reason" value={lostReason} onChange={(event) => setLostReason(event.target.value)}>
                <option value="">Select a reason</option>
                {LOST_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
              </Select>
              <div style={actionRowStyle}>
                <Button type="button" variant="secondary" size="sm" onClick={() => setLostOpen(false)}>Cancel</Button>
                <Button type="button" variant="destructive" size="sm" disabled={saving || !lostReason} onClick={() => void onPatch({ status: 'lost', payload: { lost_reason: lostReason } })}>Confirm lost</Button>
              </div>
            </div>
          </div>
        )}
        <div style={{ ...contactActionsSectionStyle, padding: isMobile ? '12px 16px' : `${spacing.md} ${spacing.lg}`, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center' }}>
          <Button type="button" size="md" disabled={!lead.contact?.phone || calling} onClick={() => void onCall()} ><Phone size={16} />{calling ? 'Calling…' : `Call${lead.contact?.phone ? ` ${formatPhoneNumber(lead.contact.phone)}` : ''}`}</Button>
          <Button variant="secondary" disabled={!lead.contact?.id || !lead.contact?.phone} onClick={() => {
            if (contextualCompose) contextualCompose('sms')
            else { setSmsOpen(true); onSmsViewChange?.(true) }
          }}>Send SMS</Button>
          <ConversationComposeLink backDestination="lead" recipient={`lead:${lead.contact?.id || ''}`} channel="email" disabled={!lead.contact?.id || !lead.contact?.email} />
          <CompactMetaCard fullWidth={isMobile} style={{ ...emailControlStyle, ...emailControlMdStyle }}>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{lead.contact?.email || 'Not provided'}</span>
            {lead.contact?.email && <Button type="button" variant="ghost" size="sm" aria-label="Copy email" onClick={() => void copyEmail()} ><Copy size={15} /></Button>}
            {copied && <span role="status" style={copiedStyle}>Copied</span>}
          </CompactMetaCard>
        </div>
      </>

      {isMobile && mobileSection === 'notes' ? notesRail : isMobile ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "0 16px 24px",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
          }}>
            <div style={oneColumnStyle}>
              <NotificationCard fullWidth label="Opportunity value" value={opportunity == null ? 'Not provided' : `$${opportunity.toLocaleString()}${opportunityUnit}`} caption={isLesson ? `${familyMemberCount + 1} student${familyMemberCount === 0 ? '' : 's'}` : undefined} />
              <NotificationCard fullWidth label="Next follow-up" tone={followUpCardTone(urgency.urgency)} value={lead.follow_up_at ? dateLabel(lead.follow_up_at) : 'Not scheduled'} caption={lead.follow_up_at ? <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => void clearFollowUp()}>Clear follow-up</Button> : undefined} />
            </div>
            {winback && (
              <DenseSectionPanel title={<SectionTitle>Win-back</SectionTitle>} style={lessonSectionStyle}>
                <div style={stackStyle}>
                  {staticDetails ? <Field label="Win-back status" value={label(winbackStatus)} /> : <Select label="Win-back status" value={winbackStatus} onChange={(event) => void onPatch({ payload: { winback: { ...winback, status: event.target.value } } })} disabled={saving}>
                    {WINBACK_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </Select>}
                  <div style={oneColumnStyle}>
                    <Field label="Disenrolled" value={disenrollmentDate ? dateLabel(disenrollmentDate) : disenrollmentMonth || "Not provided"} />
                    <Field label="Former program" value={lead.program_label || "Not provided"} />
                  </div>
                </div>
              </DenseSectionPanel>
            )}
            {isLesson && studentsSection}
            {isLesson && [lesson.experience, lesson.days, lesson.times, lessonRequest.preferredDate, lessonRequest.timeWindow].some(Boolean) && <DenseSectionPanel title={<SectionTitle>Legacy inquiry preferences (not assigned to students)</SectionTitle>} style={lessonSectionStyle}>
              <div style={oneColumnStyle}><Field label="Contact name" value={lead.contact?.full_name || ''} /><Field label="Experience" value={lesson.experience} /><Field label="Available days" value={lesson.days} /><Field label="Preferred times" value={lesson.times} /><Field label="Preferred date" value={lessonRequest.preferredDate} /><Field label="Time window" value={lessonRequest.timeWindow} /></div>
            </DenseSectionPanel>}
            {isService && <DenseSectionPanel
              title={<SectionTitle>Service details</SectionTitle>}
              actions={!serviceEditing ? <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => setServiceEditing(true)}>Edit</Button> : undefined}
              style={lessonSectionStyle}
            >
              {serviceEditing ? (
                <div style={serviceEditorStyle}>
                  <div style={fieldLabelStyle}>Service types</div>
                  {serviceEditor.types.length === 0 && <div style={emptyFamilyMembersStyle}>No service types added.</div>}
                  {serviceEditor.types.map((serviceType, index) => (
                    <div key={`${serviceType}-${index}`} style={serviceTypeRowStyle}>
                      <Input
                        aria-label={`Service type ${index + 1}`}
                        value={serviceType}
                        onChange={(event) => setServiceEditor((current) => ({
                          ...current,
                          types: current.types.map((value, typeIndex) => typeIndex === index ? event.target.value : value),
                        }))}
                      />
                      <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setServiceEditor((current) => ({ ...current, types: current.types.filter((_, typeIndex) => typeIndex !== index) }))}>Remove</Button>
                    </div>
                  ))}
                  <div style={serviceTypeRowStyle}>
                    <Input
                      aria-label="New service type"
                      placeholder="Add another service type"
                      value={serviceEditor.newType}
                      onChange={(event) => setServiceEditor((current) => ({ ...current, newType: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return
                        event.preventDefault()
                        setServiceEditor(appendServiceType)
                      }}
                    />
                    <Button type="button" variant="secondary" size="sm" disabled={saving || !serviceEditor.newType.trim()} onClick={() => setServiceEditor(appendServiceType)}>Add service</Button>
                  </div>
                  <div style={isMobile ? oneColumnStyle : opportunityValueEditorStyle}>
                    <Input label="Opportunity value" type="number" min="0" step="1" inputMode="decimal" value={serviceEditor.opportunityValue} onChange={(event) => setServiceEditor((current) => ({ ...current, opportunityValue: event.target.value }))} hint="Expected value for this service opportunity." />
                    <Select label="Value period" value={serviceEditor.opportunityValueUnit} onChange={(event) => setServiceEditor((current) => ({ ...current, opportunityValueUnit: event.target.value as OpportunityValueUnit }))}>
                      <option value="mo">Monthly (/mo)</option>
                      <option value="session">One-time session (/session)</option>
                    </Select>
                  </div>
                  <div style={actionRowStyle}>
                    <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => { resetServiceEditor(); setServiceEditing(false) }}>Cancel</Button>
                    <Button type="button" size="sm" disabled={saving} onClick={() => void saveServiceDetails()}>{saving ? 'Saving…' : 'Save service details'}</Button>
                  </div>
                </div>
              ) : (
                <div style={oneColumnStyle}><Field label="Service types" value={getServiceTypes(lead).join(', ')} /><Field label="Opportunity value" value={serviceValue == null ? '' : `$${serviceValue.toLocaleString()}/${getOpportunityValueUnit(lead.payload)}`} /></div>
              )}
            </DenseSectionPanel>}
            <DenseSectionPanel title={<SectionTitle>Source & Attribution</SectionTitle>} style={sourceSectionStyle}>
              <div style={oneColumnStyle}>
                <Field label="Source" value={formatLeadSource(lead.payload.source)} />
                <Field label="Campaign" value={lead.utm_campaign || ""} />
                <Field label="Promotion type" value={typeof lead.payload.promotion_type === 'string' ? label(lead.payload.promotion_type) : ''} />
                <Field label="Offer details" value={typeof lead.payload.promotion_offer === 'string' ? lead.payload.promotion_offer : ''} />
                <Field label="Source form" value={lead.source_form} />
                <Field label="Landing page" value={lead.source_page || ""} />
                <Field label="Referrer" value={lead.referrer || ""} />
              </div>
            </DenseSectionPanel>

          </div>
        ) : (
          <div style={columnsStyle}>
            <div style={columnStyle}>
              <div style={{ ...leftMetricsStyle, ...metricSectionStyle }}>
                <NotificationCard fullWidth label="Opportunity value" value={opportunity == null ? 'Not provided' : `$${opportunity.toLocaleString()}${opportunityUnit}`} caption={isLesson ? `${familyMemberCount + 1} student${familyMemberCount === 0 ? '' : 's'}` : undefined} />
                <NotificationCard fullWidth label="Next follow-up" tone={followUpCardTone(urgency.urgency)} value={lead.follow_up_at ? dateLabel(lead.follow_up_at) : 'Not scheduled'} caption={lead.follow_up_at ? <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => void clearFollowUp()}>Clear follow-up</Button> : undefined} />
              </div>
              {winback && (
                <DenseSectionPanel title={<SectionTitle>Win-back</SectionTitle>} style={lessonSectionStyle}>
                  <div style={stackStyle}>
                    {staticDetails ? <Field label="Win-back status" value={label(winbackStatus)} /> : <Select label="Win-back status" value={winbackStatus} onChange={(event) => void onPatch({ payload: { winback: { ...winback, status: event.target.value } } })} disabled={saving}>
                      {WINBACK_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </Select>}
                    <div style={twoColumnStyle}>
                      <Field label="Disenrolled" value={disenrollmentDate ? dateLabel(disenrollmentDate) : disenrollmentMonth || "Not provided"} />
                      <Field label="Former program" value={lead.program_label || "Not provided"} />
                    </div>
                  </div>
                </DenseSectionPanel>
              )}
              {isLesson && studentsSection}
            {isLesson && [lesson.experience, lesson.days, lesson.times, lessonRequest.preferredDate, lessonRequest.timeWindow].some(Boolean) && <DenseSectionPanel title={<SectionTitle>Legacy inquiry preferences (not assigned to students)</SectionTitle>} style={lessonSectionStyle}>
                <div style={twoColumnStyle}><Field label="Contact name" value={lead.contact?.full_name || ''} /><Field label="Experience" value={lesson.experience} /><Field label="Available days" value={lesson.days} /><Field label="Preferred times" value={lesson.times} /><Field label="Preferred date" value={lessonRequest.preferredDate} /><Field label="Time window" value={lessonRequest.timeWindow} /></div>
              </DenseSectionPanel>}
              {isService && <DenseSectionPanel title={<SectionTitle>Service details</SectionTitle>} style={lessonSectionStyle}>
                <div style={twoColumnStyle}><Field label="Service types" value={getServiceTypes(lead).join(', ')} /><Field label="Opportunity value" value={serviceValue == null ? '' : `$${serviceValue.toLocaleString()}`} /></div>
              </DenseSectionPanel>}

              <DenseSectionPanel title={<SectionTitle>Source & Attribution</SectionTitle>} style={sourceSectionStyle}>
                <div style={twoColumnStyle}>
                  <Field label="Source" value={formatLeadSource(lead.payload.source)} />
                  <Field label="Campaign" value={lead.utm_campaign || ""} />
                  <Field label="Promotion type" value={typeof lead.payload.promotion_type === 'string' ? label(lead.payload.promotion_type) : ''} />
                  <Field label="Offer details" value={typeof lead.payload.promotion_offer === 'string' ? lead.payload.promotion_offer : ''} />
                  <Field label="Source form" value={lead.source_form} />
                  <Field label="Landing page" value={lead.source_page || ""} />
                  <Field label="Referrer" value={lead.referrer || ""} />
                </div>
              </DenseSectionPanel>
            </div>

            {notesRail}
          </div>
        )}
      </div>
    </div>
  )
}


const notesRailStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.sm, flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', padding: spacing.xs }
const columnsStyle: CSSProperties = { display: 'grid', gridTemplateRows: 'minmax(0, 1fr)', overflow: 'hidden', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: spacing.lg, minHeight: 0, flex: 1, padding: `0 ${spacing.lg} ${spacing.lg}` }
const columnStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.lg, minHeight: 0, overflowY: 'auto', paddingRight: spacing.xs, overscrollBehavior: 'contain' }
const stackStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.md }
const twoColumnStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.md }
const oneColumnStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: spacing.md }
const editNameButtonStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', padding: 0, border: 'none', borderRadius: radius.md, background: 'transparent', color: colors.textSecondary, cursor: 'pointer' }
const lostSectionStyle: CSSProperties = { padding: `${spacing.md} ${spacing.lg} 0`, flexShrink: 0 }
const contactActionsSectionStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', padding: `${spacing.md} ${spacing.lg}`, flexShrink: 0 }
const emailControlStyle: CSSProperties = { gap: spacing.xs, color: colors.textSecondary, fontWeight: typography.weightMedium, flexWrap: 'wrap' }
const emailControlMdStyle: CSSProperties = { minHeight: `calc(${typography.sizeBase} + ${spacing.lg} + ${spacing.sm})`, padding: `${spacing.sm} ${spacing.lg}`, fontSize: typography.sizeBase, maxWidth: '100%', minWidth: 0, overflow: 'hidden' }
const mobileActionControlStyle: CSSProperties = { width: '100%', maxWidth: '100%', minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }
const copyButtonStyle: CSSProperties = { padding: 0, color: colors.teal }
const copiedStyle: CSSProperties = { color: colors.success, fontSize: typography.sizeXs, fontWeight: typography.weightMedium }
const actionRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }
const statusClusterRowStyle: CSSProperties = { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }
const statusClusterStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', border: '1px solid', borderRadius: radius.full, padding: '2px', minHeight: '36px', boxSizing: 'border-box', minWidth: 0, maxWidth: '100%' }
const statusLabelStyle: CSSProperties = { padding: `${spacing.xs} ${spacing.sm}`, fontFamily: typography.fontSans, fontSize: typography.sizeSm, fontWeight: typography.weightBold, whiteSpace: 'nowrap' }
const statusDividerStyle: CSSProperties = { width: '1px', alignSelf: 'stretch', margin: `${spacing.xs} ${spacing.sm}`, opacity: 0.3 }
const statusStageSelectStyle: CSSProperties = {
  width: 'auto',
  minWidth: '132px',
  minHeight: '30px',
  padding: `${spacing.xs} ${spacing.sm}`,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.full,
  background: colors.surface,
  color: colors.text,
  fontSize: typography.sizeSm,
  fontWeight: typography.weightSemibold,
  colorScheme: 'light',
  cursor: 'pointer',
}
const newStatusSelectStyle: CSSProperties = { background: semanticColors.newLead.background, color: semanticColors.newLead.text, border: `1px solid ${semanticColors.newLead.border}` }
const lostStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.sm, padding: spacing.md, background: colors.surfaceMuted, border: `1px solid ${colors.error}`, borderRadius: radius.md }
const leftMetricsStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.sm }
const metricSectionStyle: CSSProperties = { order: 1 }
const lessonSectionStyle: CSSProperties = { order: 3 }
const sourceSectionStyle: CSSProperties = { order: 5 }
const followUpSectionStyle: CSSProperties = { flexShrink: 0 }
const fieldLabelStyle: CSSProperties = { color: colors.textMuted, fontFamily: typography.fontSans, fontSize: typography.sizeXs, marginBottom: spacing.xs }
const fieldValueStyle: CSSProperties = { minWidth: 0, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', fontFamily: typography.fontSans, fontSize: typography.sizeBase, fontWeight: typography.weightMedium }
const emptyFamilyMembersStyle: CSSProperties = { color: colors.textMuted, fontFamily: typography.fontSans, fontSize: typography.sizeSm }
const serviceEditorStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.sm }
const serviceTypeRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: spacing.sm, alignItems: 'end' }
const opportunityValueEditorStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(180px, 0.7fr)', gap: spacing.sm, alignItems: 'start' }
const activityRowStyle: CSSProperties = { display: 'flex', gap: spacing.sm, alignItems: 'flex-start' }
const activityMarkerStyle: CSSProperties = { width: spacing.sm, height: spacing.sm, borderRadius: radius.full, background: colors.teal, marginTop: spacing.xs, flexShrink: 0 }
const activityContentStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.xs, minWidth: 0 }
const activityTitleStyle: CSSProperties = { color: colors.text, fontFamily: typography.fontSans, fontSize: typography.sizeSm, fontWeight: typography.weightMedium }
const activityTimeStyle: CSSProperties = { color: colors.textMuted, fontFamily: typography.fontSans, fontSize: typography.sizeXs }
