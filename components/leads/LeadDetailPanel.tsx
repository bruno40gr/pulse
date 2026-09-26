'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { Copy, MessageCircle, Pencil, Phone, RefreshCw } from 'lucide-react'
import { Button, CompactMetaCard, DenseSectionPanel, Input, NotesSection, SectionTitle, Select, SlidePanelHeader, Textarea } from '@/components/ui'
import { colors, radius, semanticColors, spacing, typography } from '@/lib/tokens'
import { formatPhoneNumber } from '@/lib/phone'

type LeadDraft = { note?: string; followUpDate?: string; followUpNote?: string }
type FamilyMember = { name: string; age: string; instrument_interest: string }

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
  lead: LeadDetail
  saving: boolean
  onPatch: (patch: Record<string, unknown>) => Promise<boolean>
  onCall: () => Promise<void>
  onCompose: () => void
  onClose: () => void
  calling: boolean
  isMobile: boolean
  draft: LeadDraft
  onDraftChange: (draft: LeadDraft) => void
}

const PIPELINE = ['new', 'contacted', 'booked', 'processing', 'won']
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
const INSTRUMENTS = ['Piano', 'Voice', 'Guitar', 'Violin', 'Drums', 'Ukulele', 'Bass', 'Cello', 'Saxophone', 'Flute', 'Clarinet', 'Trumpet', 'Other']
const EXPERIENCES = ['Beginner', 'Some experience', 'Intermediate', 'Advanced']
const QUICK_FOLLOW_UPS = [
  { value: 'tomorrow', label: 'Tomorrow', days: 1 },
  { value: 'next_week', label: 'Next week', days: 7 },
  { value: 'next_month', label: 'Next month', days: 30 },
]

function label(value: string) {
  if (value === 'processing') return 'Processing enrollment'
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
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

function asArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
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
  if (status === 'new') return { background: colors.crimson, text: '#FFFFFF', border: colors.crimson }
  if (status === 'contacted') return { background: '#FEF3C7', text: '#92400E', border: '#D97706' }
  if (status === 'booked') return { background: '#EFF6FF', text: '#1D4ED8', border: '#2563EB' }
  if (status === 'processing' || status === 'won') return { background: '#F0FDF4', text: '#15803D', border: colors.success }
  if (status === 'lost' || status === 'ghosted' || status === 'ghosted_us') return { background: colors.espresso, text: '#FFFFFF', border: colors.espresso }
  const tone = STATUS_TONE_BY_STATUS[status]
  return tone === 'booked' || !tone ? semanticColors.warning : semanticColors[tone]
}

function getLeadAge(payload: Record<string, unknown>) {
  if (typeof payload.age === 'number' && Number.isFinite(payload.age)) return Math.floor(payload.age)
  const birthDate = typeof payload.date_of_birth === 'string' ? payload.date_of_birth : typeof payload.birth_date === 'string' ? payload.birth_date : null
  if (!birthDate) return null
  const date = new Date(birthDate)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - date.getFullYear()
  const hasNotHadBirthday = today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())
  if (hasNotHadBirthday) age -= 1
  return age >= 0 ? age : null
}

function statusLabel(status: string, payload: Record<string, unknown>) {
  if (status !== 'lost') return status === 'won' ? 'Completed' : label(status)
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

function followUpTone(value: string | null | undefined) {
  if (!value) return { background: '#FEFCE8', borderColor: '#EAB308', color: colors.textSecondary, label: '' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { background: '#FEFCE8', borderColor: '#EAB308', color: colors.textSecondary, label: '' }

  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayOffset = Math.round((startOfTarget - startOfToday) / (24 * 60 * 60 * 1000))
  if (dayOffset <= 0) return { background: '#FEFCE8', borderColor: colors.error, color: colors.error, label: dayOffset < 0 ? 'Overdue' : 'Due today' }
  if (dayOffset === 1) return { background: '#FEFCE8', borderColor: colors.warning, color: colors.warning, label: 'Due tomorrow' }
  if (dayOffset <= 30) return { background: '#FEFCE8', borderColor: '#EAB308', color: colors.warning, label: '' }
  return { background: colors.surface, borderColor: colors.border, color: colors.text, label: '' }
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

function getFamilyMember(value: unknown): FamilyMember | null {
  if (!value || typeof value !== 'object') return null
  const member = value as Record<string, unknown>
  return {
    name: typeof member.name === 'string' ? member.name : '',
    age: typeof member.age === 'string' || typeof member.age === 'number' ? String(member.age) : '',
    instrument_interest: typeof member.instrument_interest === 'string' ? member.instrument_interest : '',
  }
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
    <div style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      <div style={fieldLabelStyle}>{fieldLabel}</div>
      <div title={value || undefined} style={{ ...fieldValueStyle, color: value ? colors.text : colors.textMuted }}>{value || 'Not provided'}</div>
    </div>
  )
}

export function LeadDetailPanel({ lead, saving, onPatch, onCall, onCompose, onClose, calling, isMobile, draft, onDraftChange }: LeadDetailPanelProps) {
  const [contactEditing, setContactEditing] = useState(false)
  const [lostOpen, setLostOpen] = useState(false)
  const [lostReason, setLostReason] = useState('')
  const [stageSelection, setStageSelection] = useState('')
  const [copied, setCopied] = useState(false)
  const [contact, setContact] = useState({ fullName: '', phone: '', email: '' })
  const [lesson, setLesson] = useState({ accountHolderName: '', instrument: '', experience: '', days: '', times: '' })
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpNote, setFollowUpNote] = useState('')

  const isLesson = lead.intake_type === 'lesson_inquiry'
  const isService = lead.intake_type === 'service_inquiry'
  const pipelineIndex = PIPELINE.indexOf(lead.status)
  const enrollmentValue = getNumericPayloadValue(lead.payload, 'potential_value_base') ?? 160
  const serviceValue = getNumericPayloadValue(lead.payload, 'session_value')
  const opportunity = isLesson ? enrollmentValue * (familyMembers.length + 1) : isService ? serviceValue : null
  const opportunityUnit = isLesson ? '/mo' : isService ? '/session' : ''
  const nextStages = pipelineIndex >= 0 ? PIPELINE.slice(pipelineIndex + 1) : []
  const urgency = followUpTone(lead.follow_up_at)
  const activityEvents = (lead.events || []).filter((event) => event.event_type !== 'note_added')
  const winback = lead.payload.winback && typeof lead.payload.winback === 'object' ? lead.payload.winback as Record<string, unknown> : null
  const winbackStatus = typeof winback?.status === 'string' ? winback.status : 'to_contact'
  const disenrollmentDate = typeof winback?.disenrollment_date === 'string' ? winback.disenrollment_date : ''
  const disenrollmentMonth = typeof winback?.disenrollment_month === 'string' ? winback.disenrollment_month : ''

  useEffect(() => {
    setContact({ fullName: lead.contact?.full_name || '', phone: lead.contact?.phone || '', email: lead.contact?.email || '' })
    setLesson({
      accountHolderName: typeof lead.payload.account_holder_name === 'string' ? lead.payload.account_holder_name : '',
      instrument: typeof lead.payload.instrument === 'string' ? lead.payload.instrument : '',
      experience: typeof lead.payload.experience === 'string' ? lead.payload.experience : '',
      days: asArray(lead.payload.preferred_days).join(', '),
      times: asArray(lead.payload.preferred_times).join(', '),
    })
    setFamilyMembers(Array.isArray(lead.payload.siblings) ? lead.payload.siblings.map(getFamilyMember).filter((member): member is FamilyMember => Boolean(member)) : [])
    setFollowUpDate(draft.followUpDate ?? (lead.follow_up_at ? lead.follow_up_at.slice(0, 10) : ''))
    setFollowUpNote(draft.followUpNote ?? lead.follow_up_note ?? '')
    setContactEditing(false)
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

  const saveContact = async () => {
    const saved = await onPatch({
      full_name: contact.fullName,
      phone: contact.phone,
      email: contact.email,
      payload: {
        account_holder_name: lesson.accountHolderName || null,
        instrument: lesson.instrument || null,
        experience: lesson.experience || null,
        preferred_days: lesson.days.split(',').map((item) => item.trim()).filter(Boolean),
        preferred_times: lesson.times.split(',').map((item) => item.trim()).filter(Boolean),
      },
    })
    if (saved) setContactEditing(false)
  }

  const updateFamilyMember = (index: number, patch: Partial<FamilyMember>) => {
    setFamilyMembers((current) => current.map((member, memberIndex) => memberIndex === index ? { ...member, ...patch } : member))
  }

  const saveFamilyMembers = async () => {
    await onPatch({
      payload: {
        siblings: familyMembers,
        sibling_count: familyMembers.length,
      },
    })
  }

  const statusTone = getStatusTone(lead.status)
  const contactName = lead.contact?.full_name || 'Unknown lead'
  const contactNameParts = contactName.trim().split(/\s+/)
  const contactFirstName = contactNameParts[0] || 'L'
  const contactLastName = contactNameParts.slice(1).join(' ') || contactFirstName
  const leadAge = getLeadAge(lead.payload)
  const statusStageSelect = nextStages.length > 0 ? (
    <Select aria-label="Change lead stage" value={stageSelection} fullWidth={false} disabled={saving} style={isMobile ? statusStageSelectMobileStyle : statusStageSelectStyle} onChange={(event) => {
      const stage = event.target.value
      setStageSelection('')
      if (stage === 'lost') setLostOpen(true)
      else if (stage) void onPatch({ status: stage })
    }}>
      <option value="" disabled>Change stage</option>
      {nextStages.map((stage) => <option key={stage} value={stage}>{stage === 'won' ? 'Completed' : label(stage)}</option>)}
      <option value="lost">Lost</option>
    </Select>
  ) : null

  const statusStageSelectMobile = nextStages.length > 0 ? (
    <Select aria-label="Change lead stage" value={stageSelection} fullWidth disabled={saving} wrapperStyle={{ minWidth: 0, maxWidth: '100%' }} style={statusStageSelectMobileStyle} onChange={(event) => {
      const stage = event.target.value
      setStageSelection('')
      if (stage === 'lost') setLostOpen(true)
      else if (stage) void onPatch({ status: stage })
    }}>
      <option value="" disabled>Change stage</option>
      {nextStages.map((stage) => <option key={stage} value={stage}>{stage === 'won' ? 'Completed' : label(stage)}</option>)}
      <option value="lost">Lost</option>
    </Select>
  ) : null

  const statusControls = lead.intake_type !== 'job_application' && (
    <div style={{ ...statusClusterRowStyle, justifyContent: isMobile ? 'flex-start' : 'flex-end', minWidth: 0, maxWidth: '100%', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ ...statusClusterStyle, background: statusTone.background, borderColor: statusTone.border, maxWidth: '100%', minWidth: 0, flexWrap: 'wrap' }}>
        <span style={{ ...statusLabelStyle, color: statusTone.text }}>{statusLabel(lead.status, lead.payload)}</span>
        {!isMobile && statusStageSelect && <>
          <span style={{ ...statusDividerStyle, background: statusTone.border }} aria-hidden="true" />
          <div style={statusStageSelectWrapStyle}>
            {statusStageSelect}
            <RefreshCw size={15} aria-hidden="true" style={{ ...statusStageUpdateStyle, color: statusTone.text }} />
          </div>
        </>}
      </div>
      {isMobile && statusStageSelectMobile && <div style={{ minWidth: 0, maxWidth: '100%', width: '100%' }}>{statusStageSelectMobile}</div>}
    </div>
  )

  return (
    <div className="lead-detail-panel" style={{ ...panelStyle, ...(isMobile ? mobilePanelStyle : undefined) }}>
      <SlidePanelHeader
        title={leadAge === null ? contactName : `${contactName} (${leadAge})`}
        subtitle={`${label(lead.intake_type)} · ${dateLabel(lead.created_at)}`}
        avatar={{ firstName: contactFirstName, lastName: contactLastName, size: isMobile ? 40 : 48 }}
        titleSize={isMobile ? typography.sizeLg : typography.size2xl}
        onClose={onClose}
        onBack={isMobile ? onClose : undefined}
        backLabel="Leads"
        titleBadge={!contactEditing ? <button type="button" aria-label="Edit contact" title="Edit contact" onClick={() => setContactEditing(true)} style={editNameButtonStyle}><Pencil size={15} /></button> : undefined}
        actions={isMobile ? undefined : (statusControls || undefined)}
      />

      {isMobile && !contactEditing && statusControls && <div style={mobileStatusControlsSectionStyle}>{statusControls}</div>}

      {contactEditing ? (
        <div style={editContactSectionStyle}>
          <div style={headerIdentityRowStyle}>
            <SectionTitle>Edit contact</SectionTitle>
            <Button type="button" variant="secondary" size="sm" onClick={() => setContactEditing(false)}>Cancel</Button>
          </div>
          <div style={isMobile ? oneColumnStyle : twoColumnStyle}>
            <Input label="Name" value={contact.fullName} onChange={(event) => setContact({ ...contact, fullName: event.target.value })} />
            <Input label="Phone" type="tel" value={contact.phone} onChange={(event) => setContact({ ...contact, phone: formatPhoneNumber(event.target.value) })} />
            <Input label="Email" type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} />
            {isLesson && <Input label="Account holder name" value={lesson.accountHolderName} onChange={(event) => setLesson({ ...lesson, accountHolderName: event.target.value })} />}
            {isLesson && <Select label="Instrument" value={lesson.instrument} onChange={(event) => setLesson({ ...lesson, instrument: event.target.value })}><option value="">Not provided</option>{INSTRUMENTS.map((item) => <option key={item} value={item}>{item}</option>)}</Select>}
            {isLesson && <Select label="Experience" value={lesson.experience} onChange={(event) => setLesson({ ...lesson, experience: event.target.value })}><option value="">Not provided</option>{EXPERIENCES.map((item) => <option key={item} value={item}>{item}</option>)}</Select>}
            {isLesson && <Input label="Preferred days" value={lesson.days} onChange={(event) => setLesson({ ...lesson, days: event.target.value })} />}
            {isLesson && <Input label="Preferred times" value={lesson.times} onChange={(event) => setLesson({ ...lesson, times: event.target.value })} />}
          </div>
          <div style={actionRowStyle}><Button type="button" size="sm" disabled={saving || !contact.fullName.trim()} onClick={() => void saveContact()}>{saving ? 'Saving…' : 'Save contact'}</Button></div>
        </div>
      ) : <>
        {lostOpen && <div style={lostSectionStyle}><div style={lostStyle}><Select label="Lost reason" value={lostReason} onChange={(event) => setLostReason(event.target.value)}><option value="">Select a reason</option>{LOST_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</Select><div style={actionRowStyle}><Button type="button" variant="secondary" size="sm" onClick={() => setLostOpen(false)}>Cancel</Button><Button type="button" variant="destructive" size="sm" disabled={saving || !lostReason} onClick={() => void onPatch({ status: 'lost', payload: { lost_reason: lostReason } })}>Confirm lost</Button></div></div></div>}
        <div style={contactActionsSectionStyle}>
          <Button type="button" size="md" disabled={!lead.contact?.phone || calling} onClick={() => void onCall()}><Phone size={16} />{calling ? 'Calling…' : `Call${lead.contact?.phone ? ` ${formatPhoneNumber(lead.contact.phone)}` : ''}`}</Button>
          <Button type="button" variant="secondary" size="md" disabled={!lead.contact?.id || !lead.contact?.phone} onClick={onCompose}><MessageCircle size={16} />Text message</Button>
          <CompactMetaCard style={{ ...emailControlStyle, ...emailControlMdStyle }}>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{lead.contact?.email || 'Not provided'}</span>
            {lead.contact?.email && <Button type="button" variant="ghost" size="sm" aria-label="Copy email" onClick={() => void copyEmail()} style={copyButtonStyle}><Copy size={15} /></Button>}
            {copied && <span role="status" style={copiedStyle}>Copied</span>}
          </CompactMetaCard>
        </div>
      </>}

      {!contactEditing && <div className="lead-detail-columns" style={{ ...columnsStyle, ...(isMobile ? mobileColumnsStyle : undefined) }}>
        <div className="lead-detail-column" style={{ ...columnStyle, ...(isMobile ? mobileColumnContentsStyle : undefined) }}>
          <div style={{ ...(isMobile ? oneColumnStyle : leftMetricsStyle), ...metricSectionStyle }}>
            <CompactMetaCard fullWidth align="start" style={metricCardStyle}><div><div style={metricLabelStyle}>Opportunity value</div><div style={metricValueStyle}>{opportunity == null ? 'Not provided' : `$${opportunity.toLocaleString()}${opportunityUnit}`}</div>{isLesson && <div style={metricCaptionStyle}>{`${familyMembers.length + 1} student${familyMembers.length === 0 ? '' : 's'}`}</div>}</div></CompactMetaCard>
            <CompactMetaCard fullWidth align="start" style={{ ...metricCardStyle, background: urgency.background, borderColor: urgency.borderColor }}><div><div style={{ ...metricLabelStyle, color: urgency.color }}>Next follow-up</div><div style={{ ...metricValueStyle, color: urgency.color }}>{lead.follow_up_at ? dateLabel(lead.follow_up_at) : 'Not scheduled'}</div>{urgency.label && <div style={{ ...metricCaptionStyle, color: urgency.color }}>{urgency.label}</div>}</div></CompactMetaCard>
          </div>
          {winback && (
            <DenseSectionPanel title={<SectionTitle>Win-back</SectionTitle>} style={lessonSectionStyle}>
              <div style={stackStyle}>
                <Select label="Win-back status" value={winbackStatus} onChange={(event) => void onPatch({ payload: { winback: { ...winback, status: event.target.value } } })} disabled={saving}>
                  {WINBACK_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </Select>
                <div style={isMobile ? oneColumnStyle : twoColumnStyle}>
                  <Field label="Disenrolled" value={disenrollmentDate ? dateLabel(disenrollmentDate) : disenrollmentMonth || 'Not provided'} />
                  <Field label="Former program" value={lead.program_label || 'Not provided'} />
                </div>
              </div>
            </DenseSectionPanel>
          )}
          {isLesson && <DenseSectionPanel title={<SectionTitle>Lesson details</SectionTitle>} style={lessonSectionStyle}>
            <div style={isMobile ? oneColumnStyle : twoColumnStyle}><Field label="Account holder name" value={lesson.accountHolderName} /><Field label="Instrument" value={lesson.instrument} /><Field label="Experience" value={lesson.experience} /><Field label="Preferred days" value={lesson.days} /><Field label="Preferred times" value={lesson.times} /></div>
          </DenseSectionPanel>}
          {isLesson && <DenseSectionPanel title={<SectionTitle>Family members</SectionTitle>} actions={<Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => setFamilyMembers((current) => [...current, { name: '', age: '', instrument_interest: '' }])}>Add family member</Button>} style={familySectionStyle}>
            <div style={familyMembersStyle}>
              {familyMembers.length === 0 && <div style={emptyFamilyMembersStyle}>No family members.</div>}
              {familyMembers.map((member, index) => {
                const instrumentOptions = member.instrument_interest && !INSTRUMENTS.includes(member.instrument_interest) ? [member.instrument_interest, ...INSTRUMENTS] : INSTRUMENTS
                return (
                  <div key={index} style={familyMemberStyle}>
                    <div style={familyMemberHeaderStyle}>
                      <div style={familyMemberNameStyle}>Family member {index + 1}</div>
                      <button type="button" disabled={saving} onClick={() => setFamilyMembers((current) => current.filter((_, memberIndex) => memberIndex !== index))} style={removeFamilyMemberButtonStyle}>Remove</button>
                    </div>
                    <div style={isMobile ? oneColumnStyle : familyMemberFieldsStyle}>
                      <Input label="Name" value={member.name} onChange={(event) => updateFamilyMember(index, { name: event.target.value })} />
                      <Input label="Age" inputMode="numeric" value={member.age} onChange={(event) => updateFamilyMember(index, { age: event.target.value })} />
                      <Select label="Instrument interest" value={member.instrument_interest} onChange={(event) => updateFamilyMember(index, { instrument_interest: event.target.value })}><option value="">Select instrument</option>{instrumentOptions.map((instrument) => <option key={instrument} value={instrument}>{instrument}</option>)}</Select>
                    </div>
                  </div>
                )
              })}
            </div>
            {familyMembers.length > 0 && <div style={actionRowStyle}><Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => void saveFamilyMembers()}>{saving ? 'Saving…' : 'Save family members'}</Button></div>}
          </DenseSectionPanel>}
          {!isMobile && <DenseSectionPanel title={<SectionTitle>Source & Attribution</SectionTitle>} style={sourceSectionStyle}>
            <div style={isMobile ? oneColumnStyle : twoColumnStyle}><Field label="Source form" value={lead.source_form} /><Field label="Campaign" value={lead.utm_campaign || ''} /><Field label="Landing page" value={lead.source_page || ''} /><Field label="Referrer" value={lead.referrer || ''} /></div>
          </DenseSectionPanel>}
        </div>

        <div className="lead-detail-column" style={{ ...columnStyle, ...(isMobile ? mobileColumnContentsStyle : undefined) }}>
          <DenseSectionPanel title={<SectionTitle>Notes</SectionTitle>} style={notesSectionStyle}><NotesSection title="Notes" notes={lead.notes_history || []} avatarInitial={(lead.contact?.full_name || 'L').charAt(0)} avatarBg={colors.crimson} cardBg={colors.surfaceMuted} showHeader={false} saving={saving} draft={draft.note} onDraftChange={(note) => onDraftChange({ ...draft, note })} onSave={(text) => onPatch({ add_note: text }).then((saved) => { if (saved) onDraftChange({ ...draft, note: undefined }); return saved })} /></DenseSectionPanel>
          {!isMobile && <DenseSectionPanel title={<SectionTitle>Follow-up</SectionTitle>} style={followUpSectionStyle}>
            <div style={stackStyle}><div style={isMobile ? oneColumnStyle : twoColumnStyle}><Input label="Date" type="date" value={followUpDate} onChange={(event) => { setFollowUpDate(event.target.value); onDraftChange({ ...draft, followUpDate: event.target.value }) }} /><Select label="Quick pick" value="" onChange={(event) => { const chosen = QUICK_FOLLOW_UPS.find((item) => item.value === event.target.value); if (chosen) { const date = new Date(); date.setDate(date.getDate() + chosen.days); const value = dateInputValue(date); setFollowUpDate(value); onDraftChange({ ...draft, followUpDate: value }) } }}><option value="">Choose an interval</option>{QUICK_FOLLOW_UPS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div><Textarea label="Reminder note" value={followUpNote} onChange={(event) => { setFollowUpNote(event.target.value); onDraftChange({ ...draft, followUpNote: event.target.value }) }} placeholder="Optional reminder note" style={{ minHeight: spacing['4xl'] }} /><div style={actionRowStyle}><Button type="button" size="sm" disabled={saving || !followUpDate} onClick={() => void saveFollowUp()}>{saving ? 'Saving…' : 'Update follow-up'}</Button></div></div>
          </DenseSectionPanel>}
          {!isMobile && <DenseSectionPanel title={<SectionTitle>Activity</SectionTitle>} tone="muted" style={activitySectionStyle}>
            <div style={activityListStyle}>{activityEvents.length === 0 ? <div style={emptyActivityStyle}>No system activity yet.</div> : activityEvents.map((event) => <div key={event.id} style={activityRowStyle}><span style={{ ...activityMarkerStyle, background: getActivityTone(event).border }} aria-hidden="true" /><div style={activityContentStyle}><div style={activityTitleStyle}>{activityActor(event) ? `${activityActor(event)} · ${activityLabel(event)}` : activityLabel(event)}</div><div style={activityTimeStyle}>{dateLabel(event.created_at)} · {new Date(event.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div></div></div>)}</div>
          </DenseSectionPanel>}
        </div>
      </div>}
    </div>
  )
}

const panelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden', background: colors.background }
const mobilePanelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }
const columnsStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: spacing.lg, minHeight: 0, flex: 1, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', padding: `0 ${spacing.lg} ${spacing.lg}` }
const mobileColumnsStyle: CSSProperties = { display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', flex: 'none', overflow: 'visible' }
const columnStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.lg, minHeight: 0, minWidth: 0, overflowY: 'auto', paddingRight: spacing.xs, overscrollBehavior: 'contain' }
const mobileColumnContentsStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.lg, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflow: 'visible', flex: 'none' }
const stackStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.md, minWidth: 0, maxWidth: '100%', width: '100%', boxSizing: 'border-box' }
const twoColumnStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.md, minWidth: 0, maxWidth: '100%', width: '100%', boxSizing: 'border-box' }
const oneColumnStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: spacing.md, minWidth: 0, maxWidth: '100%', width: '100%', boxSizing: 'border-box' }
const headerIdentityRowStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }
const editNameButtonStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', padding: 0, border: 'none', borderRadius: radius.md, background: 'transparent', color: colors.textSecondary, cursor: 'pointer' }
const editContactSectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.md, padding: spacing.lg, borderBottom: `1px solid ${colors.borderLight}`, flexShrink: 0, minWidth: 0, maxWidth: '100%', width: '100%', boxSizing: 'border-box' }
const lostSectionStyle: CSSProperties = { padding: `${spacing.md} ${spacing.lg} 0`, flexShrink: 0, minWidth: 0, maxWidth: '100%', width: '100%', boxSizing: 'border-box' }
const contactActionsSectionStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', padding: `${spacing.md} ${spacing.lg}`, flexShrink: 0, minWidth: 0, maxWidth: '100%', width: '100%', boxSizing: 'border-box' }
const emailControlStyle: CSSProperties = { gap: spacing.xs, color: colors.textSecondary, fontWeight: typography.weightMedium, flexWrap: 'wrap' }
const emailControlMdStyle: CSSProperties = { minHeight: `calc(${typography.sizeBase} + ${spacing.lg} + ${spacing.sm})`, padding: `${spacing.sm} ${spacing.lg}`, fontSize: typography.sizeBase, maxWidth: '100%', minWidth: 0 }
const copyButtonStyle: CSSProperties = { padding: 0, color: colors.teal }
const copiedStyle: CSSProperties = { color: colors.success, fontSize: typography.sizeXs, fontWeight: typography.weightMedium }
const actionRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', minWidth: 0, maxWidth: '100%', width: '100%', boxSizing: 'border-box' }
const statusClusterRowStyle: CSSProperties = { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', minWidth: 0, maxWidth: '100%', width: '100%', boxSizing: 'border-box' }
const statusClusterStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', border: '1px solid', borderRadius: radius.full, padding: '2px', minHeight: '36px', boxSizing: 'border-box', minWidth: 0, maxWidth: '100%' }
const statusLabelStyle: CSSProperties = { padding: `${spacing.xs} ${spacing.sm}`, fontFamily: typography.fontSans, fontSize: typography.sizeSm, fontWeight: typography.weightBold, whiteSpace: 'nowrap' }
const statusDividerStyle: CSSProperties = { width: '1px', alignSelf: 'stretch', margin: `${spacing.xs} ${spacing.sm}`, opacity: 0.3 }
const statusStageSelectWrapStyle: CSSProperties = { position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0, maxWidth: '100%' }
const statusStageSelectStyle: CSSProperties = { width: '28px', minHeight: '28px', padding: 0, border: 'none', borderRadius: radius.full, background: 'transparent', color: 'transparent', appearance: 'none', cursor: 'pointer' }
const statusStageSelectMobileStyle: CSSProperties = { minHeight: '36px', appearance: 'auto', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }
const mobileStatusControlsSectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: spacing.sm, padding: `${spacing.md} ${spacing.lg}`, borderBottom: `1px solid ${colors.borderLight}`, flexShrink: 0, minWidth: 0, maxWidth: '100%', width: '100%', boxSizing: 'border-box' }
const statusStageUpdateStyle: CSSProperties = { position: 'absolute', right: spacing.xs, pointerEvents: 'none' }
const lostStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.sm, padding: spacing.md, background: colors.surfaceMuted, border: `1px solid ${colors.error}`, borderRadius: radius.md, minWidth: 0, maxWidth: '100%', width: '100%', boxSizing: 'border-box' }
const leftMetricsStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.sm, minWidth: 0, maxWidth: '100%', width: '100%', boxSizing: 'border-box' }
const metricSectionStyle: CSSProperties = { order: 1 }
const notesSectionStyle: CSSProperties = { order: 2 }
const lessonSectionStyle: CSSProperties = { order: 3 }
const familySectionStyle: CSSProperties = { order: 4 }
const sourceSectionStyle: CSSProperties = { order: 5 }
const followUpSectionStyle: CSSProperties = { order: 5 }
const activitySectionStyle: CSSProperties = { order: 6 }
const metricCardStyle: CSSProperties = { minHeight: `calc(${typography.sizeLg} + ${spacing['3xl']})`, padding: spacing.lg }
const metricCaptionStyle: CSSProperties = { color: colors.textSecondary, fontFamily: typography.fontSans, fontSize: typography.sizeXs, marginTop: spacing.md, paddingTop: spacing.sm, borderTop: `1px solid ${colors.borderLight}` }
const metricLabelStyle: CSSProperties = { color: colors.textMuted, fontFamily: typography.fontSans, fontSize: typography.sizeXs, fontWeight: typography.weightMedium }
const metricValueStyle: CSSProperties = { color: colors.text, fontFamily: typography.fontSans, fontSize: typography.sizeLg, fontWeight: typography.weightSemibold, marginTop: spacing.xs }
const fieldLabelStyle: CSSProperties = { color: colors.textMuted, fontFamily: typography.fontSans, fontSize: typography.sizeXs, marginBottom: spacing.xs }
const fieldValueStyle: CSSProperties = { minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: typography.fontSans, fontSize: typography.sizeBase, fontWeight: typography.weightMedium }
const familyMembersStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.sm, minWidth: 0, maxWidth: '100%', width: '100%', boxSizing: 'border-box' }
const familyMemberStyle: CSSProperties = { padding: spacing.sm, border: `1px solid ${colors.borderLight}`, borderRadius: radius.md, background: colors.surface, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }
const familyMemberHeaderStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.sm, minWidth: 0, maxWidth: '100%' }
const familyMemberNameStyle: CSSProperties = { color: colors.text, fontFamily: typography.fontSans, fontSize: typography.sizeBase, fontWeight: typography.weightSemibold }
const familyMemberFieldsStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 88px minmax(0, 1fr)', gap: spacing.sm }
const removeFamilyMemberButtonStyle: CSSProperties = { padding: 0, border: 'none', background: 'transparent', color: colors.textSecondary, fontFamily: typography.fontSans, fontSize: typography.sizeSm, textDecoration: 'underline', cursor: 'pointer' }
const emptyFamilyMembersStyle: CSSProperties = { color: colors.textMuted, fontFamily: typography.fontSans, fontSize: typography.sizeSm }
const activityListStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.md, minWidth: 0, maxWidth: '100%', width: '100%', boxSizing: 'border-box' }
const activityRowStyle: CSSProperties = { display: 'flex', gap: spacing.sm, alignItems: 'flex-start' }
const activityMarkerStyle: CSSProperties = { width: spacing.sm, height: spacing.sm, borderRadius: radius.full, background: colors.teal, marginTop: spacing.xs, flexShrink: 0 }
const activityContentStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.xs, minWidth: 0 }
const activityTitleStyle: CSSProperties = { color: colors.text, fontFamily: typography.fontSans, fontSize: typography.sizeSm, fontWeight: typography.weightMedium }
const activityTimeStyle: CSSProperties = { color: colors.textMuted, fontFamily: typography.fontSans, fontSize: typography.sizeXs }
const emptyActivityStyle: CSSProperties = { color: colors.textMuted, fontFamily: typography.fontSans, fontSize: typography.sizeSm }
