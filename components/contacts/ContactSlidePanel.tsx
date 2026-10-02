'use client'
import { useState, useEffect } from 'react'
import { Copy, MessageCircle, MessageSquare, Pencil, Phone, Sparkles } from 'lucide-react'
import { Button, Badge, Avatar, CompactMetaCard, DenseSectionPanel, Select, SlidePanel, SlidePanelHeader, FieldLabel, FieldValue, NotesSection, StatusBadge, Tabs } from '@/components/ui'
import { formatPhoneNumber } from '@/lib/phone'
import { colors, typography, radius, spacing, shadows } from '@/lib/tokens'
import { getActiveTenantId, shouldUseDemoPhotos, getContactDemoAvatarUrl, getDemoAvatarUrl } from '@/lib/tenant'
import { useIsMobile } from '@/lib/useMediaQuery'
import { FundingContactDetails } from '@/components/funding/FundingContactDetails'
import { InvoiceStatusModal } from '@/components/funding/InvoiceStatusModal'
import type { FundingCase, FundingInvoice, FundingInvoiceStatus } from '@/components/funding/types'

interface AccountHolder {
  name: string | null
  phone: string | null
  email: string | null
  relationship: string | null
  is_primary: boolean
}

interface NoteEntry {
  id?: string
  text: string
  timestamp: string
  actor_name?: string | null
  completed_at?: string | null
}

interface InstructorInfo {
  staff_id: string
  person_id: string | null
  name: string | null
  phone: string | null
  email: string | null
}

interface InstructorStudent {
  enrollment_id: string
  person_id: string
  name: string
  client_status: string
  instrument: string | null
  service_type: string | null
  lesson_day: string | null
  lesson_time: string | null
}

interface Contact {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  date_of_birth?: string | null
  client_status: string
  opted_out: boolean
  last_attended: string | null
  notes: string | null
  family_name: string | null
  account_holder_name: string | null
  account_holder_phone: string | null
  account_holder_email: string | null
  account_holders?: AccountHolder[]
  instructor?: InstructorInfo | null
  staff_id?: string | null
  is_active?: boolean
  custom_fields: Record<string, unknown>
  message_routing?: string
  is_minor?: boolean
  notes_history?: NoteEntry[]
  student_notes_history?: NoteEntry[]
  active_students?: InstructorStudent[]
}

interface TenantField {
  field_key: string
  field_label: string
  field_type: string
  field_options: string[] | null
}

function normalizeFieldName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function isHiddenContactCardField(field: TenantField) {
  const key = normalizeFieldName(field.field_key)
  const label = normalizeFieldName(field.field_label)
  return key.includes('pronoun') || label.includes('pronoun') || label === 'gender' || key === 'account manager name' || label === 'account manager name'
}

function getContactCardFieldLabel(field: TenantField) {
  const key = normalizeFieldName(field.field_key)
  const label = normalizeFieldName(field.field_label)
  return key === 'primary account manager' || label === 'primary account manager' ? 'Account manager' : field.field_label
}

interface Insight {
  headline: string
  detail?: string | null
  action?: string | null
  valence?: 'attention' | 'celebrate' | 'opportunity' | 'passive'
  source?: 'profile' | 'student_note' | 'internal_note'
  // backward-compat with old flat shape
  type?: string
  text?: string
}

const valenceConfig: Record<string, { dotColor: string; bg: string; titleColor: string }> = {
  attention: { dotColor: '#92400E', bg: '#FEF7E7', titleColor: '#92400E' },
  celebrate: { dotColor: '#1F5C3A', bg: '#F3FBF6', titleColor: '#1F5C3A' },
  opportunity: { dotColor: '#1D4ED8', bg: '#F2F7FF', titleColor: '#1D4ED8' },
  passive: { dotColor: '#6B7280', bg: '#FFFFFF', titleColor: '#374151' },
}

interface ContactSlidePanelProps {
  contact: Contact
  tenantFields: TenantField[]
  onClose: () => void
  onUpdated: (updated: Contact) => void
  onCompose?: (contactIds: string[]) => void
  onViewInstructor?: (personId: string) => void
  initialNotesTab?: 'notes' | 'internal'
  mockFundingCase?: FundingCase
  initialPanelTab?: 'profile' | 'funding'
  onNextStepChange?: (value: string) => void
  onInvoiceStatusChange?: (invoice: FundingInvoice) => void
  onFundingCaseUpdated?: (fundingCase: FundingCase) => void
}

const inputStyle: React.CSSProperties = {
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  padding: `${spacing.xs} ${spacing.sm}`,
  fontSize: typography.sizeBase,
  fontFamily: typography.fontSans,
  color: colors.text,
  background: colors.surface,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const dividerStyle: React.CSSProperties = {
  height: '1px',
  background: colors.borderLight,
  margin: '24px 0',
}

export default function ContactSlidePanel({ contact, tenantFields, onClose, onUpdated, onCompose, onViewInstructor, initialNotesTab = 'notes', mockFundingCase, initialPanelTab = 'profile', onNextStepChange, onInvoiceStatusChange, onFundingCaseUpdated }: ContactSlidePanelProps) {
  const tenantId = getActiveTenantId()
  const isMobile = useIsMobile()
  const isInstructor = contact.staff_id != null || contact.custom_fields?.contact_kind === 'instructor'
  const cleanName = (name: string | null | undefined) =>
    name?.replace(' (account)', '').trim() || null

  const formatDOB = (date: string | null | undefined) => {
    if (!date) return null
    return new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const [insights, setInsights] = useState<Insight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [studentNotesSaving] = useState(false)
  const [internalNotesSaving] = useState(false)
  const [studentNotesHistory, setStudentNotesHistory] = useState<NoteEntry[]>(
    Array.isArray(contact.student_notes_history) ? contact.student_notes_history : []
  )
  const [internalNotesHistory, setInternalNotesHistory] = useState<NoteEntry[]>(
    Array.isArray(contact.notes_history) ? contact.notes_history : []
  )
  const [saving, setSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isStaffActionMenuOpen, setIsStaffActionMenuOpen] = useState(false)
  const [calling, setCalling] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [edits, setEdits] = useState<Record<string, unknown>>({})
  const [activeNotesTab, setActiveNotesTab] = useState<'notes' | 'internal'>(initialNotesTab)
  const [activePanelTab, setActivePanelTab] = useState<'profile' | 'funding'>(mockFundingCase ? initialPanelTab : 'profile')
  const [fundingCase, setFundingCase] = useState<FundingCase | null>(mockFundingCase || null)
  const [invoiceEdit, setInvoiceEdit] = useState<FundingInvoice | null>(null)

  useEffect(() => {
    setFundingCase(mockFundingCase || null)
  }, [mockFundingCase])

  useEffect(() => {
    if (mockFundingCase || isInstructor || contact.id.startsWith('mock-')) return
    let active = true
    fetch(`/api/funding/cases?tenant=${encodeURIComponent(tenantId)}&student_person_id=${encodeURIComponent(contact.id)}`)
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body?.error || 'Could not load funding case.')
        if (active) setFundingCase(Array.isArray(body) ? body[0] || null : null)
      })
      .catch(() => {
        if (active) setFundingCase(null)
      })
    return () => { active = false }
  }, [contact.id, isInstructor, mockFundingCase, tenantId])

  const applyFundingCase = (updated: FundingCase) => {
    setFundingCase(updated)
    onFundingCaseUpdated?.(updated)
  }

  const updateFundingNextStep = async (value: string) => {
    if (onNextStepChange) {
      onNextStepChange(value)
      return
    }
    if (!fundingCase) return
    const response = await fetch(`/api/funding/cases/${fundingCase.id}?tenant=${encodeURIComponent(tenantId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ next_step: value }),
    })
    const body = await response.json()
    if (!response.ok) {
      showToast(body?.error || 'Could not update the case')
      return
    }
    applyFundingCase(body)
    showToast('changes saved')
  }

  const saveInvoiceStatus = async (input: { status: FundingInvoiceStatus; evidence: string; note: string; paidOn: string | null }) => {
    if (!invoiceEdit) return
    const response = await fetch(`/api/funding/invoices/${invoiceEdit.id}/status?tenant=${encodeURIComponent(tenantId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: input.status, evidence: input.evidence, note: input.note, paid_on: input.paidOn }),
    })
    const body = await response.json()
    if (!response.ok) throw new Error(body?.error || 'Could not update invoice status.')
    applyFundingCase(body)
    showToast('invoice status saved')
  }

  // ── Load insights with note context ──
  useEffect(() => {
    if (mockFundingCase) {
      setInsights([])
      setInsightsLoading(false)
      return
    }

    if (isInstructor) {
      setInsights([])
      setInsightsLoading(false)
      return
    }

    const cacheKey = `pulse_contact_insights_${contact.id}`
    const cacheTimeKey = `pulse_contact_insights_time_${contact.id}`
    const cached = localStorage.getItem(cacheKey)
    const cachedTime = localStorage.getItem(cacheTimeKey)

    if (cached && cachedTime) {
      try {
        const age = Date.now() - new Date(cachedTime).getTime()
        if (age < 10 * 60 * 1000) {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed)) {
            setInsights(normalizeInsights(parsed))
            setInsightsLoading(false)
            return
          }
        }
      } catch {}
    }

    const contactSummary = {
      name: `${contact.first_name} ${contact.last_name}`,
      status: contact.client_status,
      last_attended: contact.last_attended,
      days_since_attended: contact.last_attended
        ? Math.floor((Date.now() - new Date(contact.last_attended).getTime()) / (1000 * 60 * 60 * 24))
        : null,
      ...contact.custom_fields
    }

    fetch('/api/contact-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact: contactSummary,
        student_notes: studentNotesHistory.map(n => n.text).join('\n'),
        internal_notes: internalNotesHistory.map(n => n.text).join('\n'),
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.insights) {
          const normalized = normalizeInsights(data.insights)
          setInsights(normalized)
          localStorage.setItem(cacheKey, JSON.stringify(normalized))
          localStorage.setItem(cacheTimeKey, new Date().toISOString())
        }
        setInsightsLoading(false)
      })
      .catch(() => setInsightsLoading(false))
  }, [contact.id, contact.client_status, contact.custom_fields, contact.first_name, contact.last_attended, contact.last_name, internalNotesHistory, isInstructor, mockFundingCase, studentNotesHistory])

  // Normalize both new (headline/valence) and legacy (text/type) shapes
  const normalizeInsights = (raw: Array<Record<string, unknown>>): Insight[] => {
    return raw
      .filter(i => i && (i.headline || i.text))
      .map(i => {
        const type = typeof i.type === 'string' ? i.type : undefined
        const legacyValence =
          type === 'risk' || type === 'nudge' ? 'attention' :
          type === 'milestone' ? 'celebrate' :
          type === 'opportunity' ? 'opportunity' :
          type === 'info' ? 'passive' : undefined

        return {
          headline: (typeof i.headline === 'string' ? i.headline : typeof i.text === 'string' ? i.text : '') || '',
          detail: typeof i.detail === 'string' ? i.detail : null,
          action: typeof i.action === 'string' ? i.action : null,
          valence: (i.valence === 'attention' || i.valence === 'celebrate' || i.valence === 'opportunity' || i.valence === 'passive' ? i.valence : legacyValence) || 'passive',
          source: i.source === 'profile' || i.source === 'student_note' || i.source === 'internal_note' ? i.source : 'profile',
        }
      })
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 2000)
  }

  const patch = async (fields: Partial<Contact>, silent = false) => {
    setSaving(true)
    try {
      const updated = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      }).then(r => r.json())
      if (updated && typeof updated.error === 'string') {
        if (!silent) showToast(updated.error)
        return
      }
      onUpdated(updated)
      if (!silent) showToast('changes saved')
    } finally {
      setSaving(false)
    }
  }

  const handleStartEditing = () => {
    const initial: Record<string, unknown> = {}
    if (contact.first_name) initial.first_name = contact.first_name
    if (contact.last_name) initial.last_name = contact.last_name
    if (contact.phone) initial.phone = contact.phone
    if (contact.email) initial.email = contact.email
    if (contact.date_of_birth) initial.date_of_birth = contact.date_of_birth
    for (const f of tenantFields) {
      const val = contact.custom_fields?.[f.field_key]
      if (val !== undefined && val !== null) {
        initial[f.field_key] = val
      }
    }
    setEdits(initial)
    setIsEditing(true)
  }

  const handleSaveEdits = async () => {
    if (Object.keys(edits).length > 0) {
      await patch(edits)
    }
    setEdits({})
    setIsEditing(false)
  }

  const handleCancelEditing = () => {
    setEdits({})
    setIsEditing(false)
  }

  const handleCall = async (phone: string | null = contact.phone) => {
    if (!phone || calling) return

    setCalling(true)
    try {
      const response = await fetch(`/api/calls?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_phone: phone, contact_id: contact.id }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not place call')
      showToast(data.demo ? 'Demo call placed' : 'Call placed')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not place call')
    } finally {
      setCalling(false)
    }
  }

  const copyEmail = async (email: string | null) => {
    if (!email) return
    try {
      await navigator.clipboard.writeText(email)
      setCopiedEmail(true)
      window.setTimeout(() => setCopiedEmail(false), 1800)
    } catch {}
  }

  const updateEdit = (key: string, value: string) => {
    setEdits(prev => ({ ...prev, [key]: value }))
  }

  const displayPhone = formatPhoneNumber

  const getAgeFromDOB = (dob: string | null | undefined): number | null => {
    if (!dob) return null
    try {
      const birth = new Date(dob)
      const today = new Date()
      let age = today.getFullYear() - birth.getFullYear()
      const m = today.getMonth() - birth.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
      if (age >= 0 && age < 120) return age
    } catch {}
    return null
  }

  const age = getAgeFromDOB(contact.date_of_birth)
  const computedIsMinor = age !== null ? age < 18 : contact.is_minor
  const ageLabel = age !== null ? `Age ${age}` : null
  const statusLabel = (contact.client_status || 'active').charAt(0).toUpperCase() + (contact.client_status || 'active').slice(1)
  const isInstructorActive = contact.is_active !== false
  const activeStudents = contact.active_students || []

  const headerIconButtonStyle: React.CSSProperties = {
    width: '32px',
    height: '32px',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.textSecondary,
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    cursor: 'pointer',
  }

  const accountHolders: AccountHolder[] = contact.account_holders?.length
    ? contact.account_holders
    : (contact.account_holder_name
      ? [{
          name: contact.account_holder_name,
          phone: contact.account_holder_phone,
          email: contact.account_holder_email,
          relationship: null,
          is_primary: true,
        }]
      : [])

  const primaryAccountHolder = accountHolders.find(holder => holder.is_primary) || accountHolders[0]
  const contactPhone = computedIsMinor ? (primaryAccountHolder?.phone || contact.account_holder_phone) : contact.phone
  const contactEmail = computedIsMinor ? (primaryAccountHolder?.email || contact.account_holder_email) : contact.email

  const showAccountHolders = computedIsMinor
    ? accountHolders.length > 0
    : accountHolders.length > 0 && (
        accountHolders[0].phone !== contact.phone ||
        accountHolders[0].email !== contact.email
      )

  const getInitials = (name: string | null) => {
    if (!name) return '?'
    const parts = name.split(' ')
    return parts.map(p => p[0]).join('').toUpperCase().slice(0, 2)
  }

  const visibleTenantFields = tenantFields.filter(field => !isHiddenContactCardField(field))
  const populatedFields = visibleTenantFields.filter(f => {
    const val = contact.custom_fields?.[f.field_key]
    return val !== undefined && val !== null && val !== ''
  })

  const actionInsights = insights.filter(i => i.valence && i.valence !== 'passive')
  const passiveInsights = insights.filter(i => !i.valence || i.valence === 'passive')

  const contactAvatarSrc = shouldUseDemoPhotos(tenantId)
    ? getContactDemoAvatarUrl(tenantId, contact)
    : undefined

  const panelSkeleton = (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '1fr 1fr', flex: 1, minWidth: 0, overflowY: isMobile ? 'auto' : 'hidden', overflowX: 'hidden', background: colors.background }}>
      <div style={{ padding: isMobile ? '16px' : '24px 28px', borderRight: isMobile ? 'none' : `1px solid ${colors.borderLight}` }}>
        <div style={{ height: '120px', borderRadius: radius.lg, background: colors.borderLight, marginBottom: spacing.lg, animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
        <div style={{ height: '220px', borderRadius: radius.lg, background: colors.borderLight, marginBottom: spacing.lg, animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
        <div style={{ height: '180px', borderRadius: radius.lg, background: colors.borderLight, animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
      </div>
      <div style={{ padding: isMobile ? '0 16px 16px' : '24px 28px' }}>
        <div style={{ height: '520px', borderRadius: radius.lg, background: colors.borderLight, animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
      </div>
    </div>
  )

  // ── Full-screen edit form ──
  if (isEditing) {
    const editFirstName = edits.first_name ?? contact.first_name
    const editLastName = edits.last_name ?? contact.last_name

    return (
      <SlidePanel isOpen={true} onClose={onClose} fullScreen={isMobile}>
        <SlidePanelHeader
          title="Edit contact"
          onClose={onClose}
          toast={toastMessage || undefined}
          compact={isMobile}
        />

        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', background: colors.surface, padding: isMobile ? '0 16px 20px' : '0 28px 24px' }}>
          {/* Profile picture + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px 0 20px' }}>
              <Avatar
                firstName={editFirstName as string}
                lastName={editLastName as string}
                size={56}
                src={shouldUseDemoPhotos(tenantId)
                  ? getContactDemoAvatarUrl(tenantId, {
                      first_name: editFirstName as string,
                      last_name: editLastName as string,
                      is_minor: contact.is_minor,
                    })
                  : undefined}
              />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: colors.text, overflowWrap: 'anywhere' }}>
                {editFirstName as string} {editLastName as string}
              </div>
              <div style={{ fontSize: '12px', color: colors.textMuted, marginTop: '2px', overflowWrap: 'anywhere' }}>
                Profile picture upload coming soon
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '1fr 1fr', gap: isMobile ? '16px' : '16px 24px', minWidth: 0 }}>
            <div>
              <FieldLabel>First name</FieldLabel>
              <input type="text" value={editFirstName as string} onChange={e => updateEdit('first_name', e.target.value)} placeholder="First name" style={inputStyle} />
            </div>
            <div>
              <FieldLabel>Last name</FieldLabel>
              <input type="text" value={editLastName as string} onChange={e => updateEdit('last_name', e.target.value)} placeholder="Last name" style={inputStyle} />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <input type="text" value={(edits.phone as string) ?? contact.phone ?? ''} onChange={e => updateEdit('phone', formatPhoneNumber(e.target.value))} placeholder="Phone number" style={inputStyle} />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <input type="email" value={(edits.email as string) ?? contact.email ?? ''} onChange={e => updateEdit('email', e.target.value)} placeholder="Email address" style={inputStyle} />
            </div>
            <div>
              <FieldLabel>Date of birth</FieldLabel>
              <input type="date" value={(edits.date_of_birth as string) ?? contact.date_of_birth ?? ''} onChange={e => updateEdit('date_of_birth', e.target.value || '')} style={{ ...inputStyle, width: isMobile ? '100%' : '160px' }} />
            </div>
          </div>

          <div style={dividerStyle} />

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '1fr 1fr', gap: isMobile ? '16px' : '16px 24px', minWidth: 0 }}>
            {visibleTenantFields.map(f => {
              const currentVal = edits[f.field_key] ?? contact.custom_fields?.[f.field_key] ?? ''
              if (f.field_options?.length) {
                return (
                  <div key={f.field_key}>
                    <FieldLabel>{getContactCardFieldLabel(f)}</FieldLabel>
                    <Select value={String(currentVal)} onChange={e => updateEdit(f.field_key, e.target.value)}>
                      <option value="">—</option>
                      {f.field_options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </Select>
                  </div>
                )
              }
              return (
                <div key={f.field_key}>
                <FieldLabel>{getContactCardFieldLabel(f)}</FieldLabel>
                  <input type="text" value={String(currentVal)} onChange={e => updateEdit(f.field_key, e.target.value)} placeholder={f.field_label} style={inputStyle} />
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer — Cancel/Done (matches normal-mode button size) */}
        <div style={{
          padding: isMobile ? '12px 16px' : `16px 28px`,
          borderTop: `1px solid ${colors.borderLight}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
          flexWrap: 'wrap',
          minWidth: 0,
          flexShrink: 0,
          background: colors.surface,
        }}>
          <Button variant="secondary" onClick={handleCancelEditing}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveEdits} disabled={saving}>{saving ? 'Saving...' : 'Done'}</Button>
        </div>
      </SlidePanel>
    )
  }

  // ── Normal view ──
  return (
    <SlidePanel isOpen={true} onClose={onClose} fullScreen={isMobile} width="min(75vw, 960px)">
      <SlidePanelHeader
        title={`${contact.first_name} ${contact.last_name}`}
        avatar={{
          firstName: contact.first_name,
          lastName: contact.last_name,
          size: 48,
          src: contactAvatarSrc,
        }}
        titleSize={typography.size2xl}
        compact={isMobile}
        badge={
          <>
            <StatusBadge status={contact.opted_out ? 'spam' : contact.client_status} label={contact.opted_out ? 'Opted out' : statusLabel} size="md" />
            {isInstructor && <Badge variant="info">Instructor</Badge>}
            {isInstructor && !isInstructorActive && <Badge variant="inactive">Sunset</Badge>}
            {computedIsMinor && <Badge variant="minor">Minor</Badge>}
            {ageLabel && <span style={{ fontSize: '13px', color: colors.textMuted, fontWeight: 400 }}>{ageLabel}</span>}
          </>
        }
        onClose={onClose}
        toast={toastMessage || undefined}
        titleBadge={!isInstructor ? (
          <button
            type="button"
            aria-label="Edit contact"
            title="Edit contact"
            onClick={handleStartEditing}
            style={headerIconButtonStyle}
          >
            <Pencil size={16} />
          </button>
        ) : undefined}
        actions={isInstructor ? (
          <>
            <button
              type="button"
              onClick={() => onCompose?.([contact.id])}
              disabled={!onCompose}
              aria-label={`Message ${contact.first_name} ${contact.last_name}`}
              title="Send message"
              style={{ ...headerIconButtonStyle, cursor: onCompose ? 'pointer' : 'not-allowed', opacity: onCompose ? 1 : 0.5 }}
            >
              <MessageSquare size={16} />
            </button>
            <button
              type="button"
              onClick={() => handleCall(contact.phone)}
              disabled={!contact.phone || calling}
              aria-label={`Call ${contact.first_name} ${contact.last_name}`}
              title={contact.phone ? `Call ${displayPhone(contact.phone)}` : 'No phone number'}
              style={{ ...headerIconButtonStyle, cursor: contact.phone && !calling ? 'pointer' : 'not-allowed', opacity: contact.phone && !calling ? 1 : 0.5 }}
            >
              <Phone size={16} />
            </button>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsStaffActionMenuOpen(open => !open)}
                aria-label="Staff edit options"
                aria-expanded={isStaffActionMenuOpen}
                title="Edit staff member"
                style={headerIconButtonStyle}
              >
                <Pencil size={16} />
              </button>
              {isStaffActionMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: '38px',
                  right: 0,
                  zIndex: 5,
                  minWidth: '176px',
                  padding: spacing.xs,
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  boxShadow: shadows.md,
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsStaffActionMenuOpen(false)
                      handleStartEditing()
                    }}
                    style={{ width: '100%', padding: `${spacing.sm} ${spacing.md}`, border: 'none', borderRadius: radius.sm, background: 'transparent', color: colors.text, textAlign: 'left', cursor: 'pointer', fontFamily: typography.fontSans, fontSize: typography.sizeBase }}
                  >
                    Edit staff member
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsStaffActionMenuOpen(false)
                      if (isInstructorActive && !window.confirm('Sunset this instructor? They will no longer be able to sign in or be messaged.')) return
                      patch({ is_active: !isInstructorActive })
                    }}
                    style={{ width: '100%', padding: `${spacing.sm} ${spacing.md}`, border: 'none', borderRadius: radius.sm, background: 'transparent', color: isInstructorActive ? colors.error : colors.text, textAlign: 'left', cursor: 'pointer', fontFamily: typography.fontSans, fontSize: typography.sizeBase }}
                  >
                    {isInstructorActive ? 'Sunset / offboard' : 'Reactivate instructor'}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : undefined}
      />

      {!isInstructor && <div style={{
        display: 'flex',
        alignItems: isMobile ? 'stretch' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
        gap: spacing.sm,
        flexWrap: 'wrap',
        padding: isMobile ? '12px 16px' : `${spacing.md} ${spacing.lg}`,
        flexShrink: 0,
        borderBottom: `1px solid ${colors.borderLight}`,
        background: colors.surface,
      }}>
        <Button
          type="button"
          size="md"
          disabled={!contactPhone || calling}
          onClick={() => void handleCall(contactPhone)}
          style={isMobile ? mobileActionControlStyle : undefined}
        >
          <Phone size={16} />
          {calling ? 'Calling…' : `Call${contactPhone ? ` ${displayPhone(contactPhone)}` : ''}`}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={!onCompose || !contactPhone}
          onClick={() => onCompose?.([contact.id])}
          style={isMobile ? mobileActionControlStyle : undefined}
        >
          <MessageCircle size={16} />
          Text message
        </Button>
        <CompactMetaCard fullWidth={isMobile} style={emailControlStyle}>
          <span style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{contactEmail || 'Not provided'}</span>
          {contactEmail && (
            <Button type="button" variant="ghost" size="sm" aria-label="Copy email" onClick={() => void copyEmail(contactEmail)} style={{ padding: 0, color: colors.teal }}>
              <Copy size={15} />
            </Button>
          )}
          {copiedEmail && <span role="status" style={{ color: colors.success, fontSize: typography.sizeXs, fontWeight: typography.weightMedium }}>Copied</span>}
        </CompactMetaCard>
      </div>}

      {fundingCase && (
        <div style={{ padding: isMobile ? `0 ${spacing.lg}` : `0 ${spacing['3xl']}`, background: colors.surface, flexShrink: 0 }}>
          <Tabs
            items={[
              { key: 'profile', label: 'Profile' },
              { key: 'funding', label: 'Funding' },
            ]}
            activeKey={activePanelTab}
            onChange={setActivePanelTab}
            compact={isMobile}
          />
        </div>
      )}

      {/* Body — two desktop columns, one mobile stack */}
      {activePanelTab === 'funding' && fundingCase ? (
        <FundingContactDetails
          fundingCase={fundingCase}
          embedded
          onNextStepChange={value => void updateFundingNextStep(value)}
          onInvoiceStatusChange={invoice => onInvoiceStatusChange ? onInvoiceStatusChange(invoice) : setInvoiceEdit(invoice)}
        />
      ) : insightsLoading ? panelSkeleton : (
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '1fr 1fr', flex: 1, minWidth: 0, overflowY: isMobile ? 'auto' : 'hidden', overflowX: 'hidden', background: colors.background }}>
        {/* LEFT COLUMN */}
        <div style={{ minWidth: 0, overflowY: isMobile ? 'visible' : 'auto', overflowX: 'hidden', padding: isMobile ? '16px' : '24px 28px', borderRight: isMobile ? 'none' : `1px solid ${colors.borderLight}` }}>

          {/* Account holders (conditional — no card space / divider when absent) */}
          {showAccountHolders ? (
            <DenseSectionPanel
              title="Account managers"
              style={{ borderRadius: radius.lg, boxShadow: shadows.sm, marginBottom: spacing.lg, border: `1px solid ${colors.borderLight}` }}
              contentStyle={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {accountHolders.map((ah, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      flexDirection: isMobile ? 'column' : 'row',
                      alignItems: 'stretch',
                      gap: spacing.md,
                      padding: '12px 14px',
                      background: colors.surface,
                      borderRadius: radius.lg,
                      border: `1px solid ${colors.borderLight}`,
                    }}
                  >
                    <div
                      style={{
                        width: isMobile ? '36px' : '42px',
                        height: isMobile ? '36px' : undefined,
                        minHeight: isMobile ? '36px' : '72px',
                        background: '#EEF1F1',
                        color: '#6B7280',
                        borderRadius: radius.lg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(ah.name)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'baseline', justifyContent: 'space-between', gap: isMobile ? '4px' : '12px', minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: colors.text, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                          {cleanName(ah.name) || '—'}
                        </div>
                        {ah.relationship && (
                          <div style={{ fontSize: '11px', color: colors.textMuted, fontWeight: 500, flexShrink: 0, overflowWrap: 'anywhere' }}>
                            {ah.relationship}
                          </div>
                        )}
                      </div>
                      {!ah.is_primary && <div style={{ fontSize: '12px', color: colors.textMuted }}>Additional account manager</div>}
                      {(ah.phone || ah.email) && (
                        <div style={{ fontSize: '12px', color: colors.text, display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: isMobile ? '6px' : '12px', minWidth: 0 }}>
                          {ah.phone ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, minWidth: 0 }}>
                              <span style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{displayPhone(ah.phone)}</span>
                              <button
                                type="button"
                                onClick={() => handleCall(ah.phone)}
                                disabled={calling}
                                aria-label={`Call ${cleanName(ah.name) || 'account holder'}`}
                                title={`Call ${displayPhone(ah.phone)}`}
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '2px', color: colors.textSecondary, background: 'transparent', border: 'none', cursor: calling ? 'wait' : 'pointer', opacity: calling ? 0.55 : 1 }}
                              >
                                <Phone size={14} strokeWidth={1.8} />
                              </button>
                            </span>
                          ) : <span style={{ color: colors.textMuted }}>—</span>}
                          {ah.email ? <span style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{ah.email}</span> : <span style={{ color: colors.textMuted }}>—</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </DenseSectionPanel>
          ) : null}

          {/* AI Insights */}
          {!isInstructor && <DenseSectionPanel
            title={<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: typography.sizeSm, fontWeight: 400, color: colors.textMuted }}><Sparkles size={15} /> AI highlights</div>}
            style={{ borderRadius: radius.lg, boxShadow: shadows.sm, marginBottom: spacing.lg, border: `1px solid ${colors.borderLight}` }}
          >
          {actionInsights.length === 0 && passiveInsights.length === 0 ? (
            <p style={{ fontSize: '13px', color: colors.textMuted, margin: '10px 0 0', fontFamily: typography.fontSans }}>
              No insights available for this contact yet.
            </p>
          ) : (
            <div style={{ marginTop: '10px' }}>
              {/* Action cards — headline + detail only, no CTA */}
              {actionInsights.map((insight, i) => {
                const config = valenceConfig[insight.valence || 'passive']
                return (
                  <div key={i} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: config.bg,
                    marginBottom: '12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: config.titleColor, lineHeight: 1.4, minWidth: 0, overflowWrap: 'anywhere' }}>
                        {insight.headline}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {insight.source === 'internal_note' && (
                          <span style={{
                            fontSize: '10px', fontWeight: 600, color: '#6B7280',
                            background: 'rgba(255,255,255,0.7)',
                            border: '1px solid rgba(0,0,0,0.06)',
                            borderRadius: '4px', padding: '1px 6px',
                            whiteSpace: 'nowrap',
                          }}>🔒 team</span>
                        )}
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: config.dotColor, marginTop: '5px' }} />
                      </div>
                    </div>
                    {insight.detail && (
                      <div style={{ fontSize: '13px', color: colors.text, lineHeight: 1.5, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                        {insight.detail}
                      </div>
                    )}
                  </div>
                )
              })}

            </div>
          )}
          </DenseSectionPanel>}

          {isInstructor && (
            <DenseSectionPanel
              title={`Active students (${activeStudents.length})`}
              style={{ borderRadius: radius.lg, boxShadow: shadows.sm, marginBottom: spacing.lg, border: `1px solid ${colors.borderLight}` }}
              contentStyle={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}
            >
              {activeStudents.length === 0 ? (
                <p style={{ margin: 0, fontSize: typography.sizeSm, color: colors.textMuted }}>
                  No active students are currently subscribed to this instructor.
                </p>
              ) : activeStudents.map(student => (
                <div
                  key={student.enrollment_id}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, padding: '10px 12px', border: `1px solid ${colors.borderLight}`, borderRadius: radius.md, background: colors.surface }}
                >
                  <div style={{ minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => onViewInstructor?.(student.person_id)}
                      disabled={!onViewInstructor}
                      style={{ padding: 0, border: 'none', background: 'transparent', color: onViewInstructor ? '#2563EB' : colors.text, fontSize: typography.sizeSm, fontWeight: 600, fontFamily: typography.fontSans, textAlign: 'left', cursor: onViewInstructor ? 'pointer' : 'default', textDecoration: onViewInstructor ? 'underline' : 'none' }}
                    >
                      {student.name}
                    </button>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', marginTop: '3px', fontSize: typography.sizeXs, color: colors.textMuted }}>
                      {student.instrument && <span>{student.instrument}</span>}
                      {student.service_type && <span>{student.service_type}</span>}
                      {student.lesson_day && <span>{student.lesson_day}</span>}
                      {student.lesson_time && <span>{student.lesson_time}</span>}
                    </div>
                  </div>
                  <StatusBadge status={student.client_status} label={student.client_status.charAt(0).toUpperCase() + student.client_status.slice(1)} />
                </div>
              ))}
            </DenseSectionPanel>
          )}

          {/* Details grid */}
          {(populatedFields.length > 0 || contact.date_of_birth) && (
            <DenseSectionPanel title="Details" style={{ borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '1fr 1fr', gap: isMobile ? '16px' : '16px 32px', minWidth: 0 }}>
                {contact.date_of_birth && (
                  <div>
                    <FieldLabel>DOB</FieldLabel>
                    <FieldValue style={{ overflowWrap: 'anywhere' }}>{formatDOB(contact.date_of_birth)}</FieldValue>
                  </div>
                )}
                {populatedFields.map(f => {
                  const val = contact.custom_fields?.[f.field_key]

                  if (f.field_key === 'instructor') {
                    // Instructor name may come from instructor.name or custom_fields
                    const instrName = contact.instructor?.name || String(val || '')
                    const firstName = instrName.split(' ')[0] || ''
                    const lastName = instrName.split(' ').slice(1).join(' ') || ''

                    const content = (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <Avatar
                          firstName={firstName}
                          lastName={lastName}
                          size={28}
                          src={shouldUseDemoPhotos(tenantId) && contact.instructor?.person_id
                            ? getDemoAvatarUrl(tenantId, firstName, lastName, { isMinor: false })
                            : undefined}
                        />
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color: contact.instructor?.person_id ? '#2563EB' : colors.text,
                            textDecoration: contact.instructor?.person_id ? 'underline' : 'none',
                             minWidth: 0,
                             overflowWrap: 'anywhere',
                             wordBreak: 'break-word',
                          }}
                        >
                          {instrName || 'Unassigned'}
                        </span>
                      </div>
                    )

                    // Open the instructor's contact card using the stable person id.
                    if (contact.instructor?.person_id && onViewInstructor) {
                      return (
                        <div key={f.field_key}>
                          <FieldLabel>{f.field_label}</FieldLabel>
                          <button
                            onClick={() => onViewInstructor(contact.instructor!.person_id!)}
                            style={{
                              background: 'none', border: 'none', padding: 0,
                              cursor: 'pointer', fontFamily: typography.fontSans,
                              maxWidth: '100%', textAlign: 'left',
                            }}
                          >
                            {content}
                          </button>
                        </div>
                      )
                    }

                    return (
                      <div key={f.field_key}>
                        <FieldLabel>{f.field_label}</FieldLabel>
                        {content}
                      </div>
                    )
                  }

                  return (
                    <div key={f.field_key}>
                      <FieldLabel>{f.field_label}</FieldLabel>
                      <FieldValue style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{String(val).charAt(0).toUpperCase() + String(val).slice(1)}</FieldValue>
                    </div>
                  )
                })}
              </div>
            </DenseSectionPanel>
          )}
        </div>

        {/* RIGHT COLUMN — Notes + Internal notes */}
        <div style={{ overflowY: isMobile ? 'visible' : 'auto', overflowX: 'hidden', padding: isMobile ? '0 16px 16px' : '24px 28px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <DenseSectionPanel tone="default" style={{ borderRadius: radius.lg, boxShadow: shadows.sm, height: 'fit-content', border: `1px solid ${colors.borderLight}` }}>
            <Tabs
              items={[
                { key: 'notes', label: 'Notes' },
                { key: 'internal', label: 'Internal notes' },
              ]}
              activeKey={activeNotesTab}
              onChange={setActiveNotesTab}
              style={{ marginBottom: spacing.lg }}
            />

            {activeNotesTab === 'notes' ? (
              <NotesSection
                title="Notes"
                notes={studentNotesHistory}
                avatarInitial="S"
                avatarBg={colors.crimson}
                cardBg="#FFFFFF"
                addLabel="Add a note"
                saving={studentNotesSaving}
                showHeader={false}
                onSave={(text) => {
                  const newEntry = { text, timestamp: new Date().toISOString() }
                  const updated = [newEntry, ...studentNotesHistory]
                  patch({ student_notes_history: updated }, true)
                  setStudentNotesHistory(updated)
                  showToast('changes saved')
                }}
                onToggleComplete={(index) => {
                  const updated = studentNotesHistory.map((entry, noteIndex) => noteIndex === index
                    ? { ...entry, completed_at: entry.completed_at ? null : new Date().toISOString() }
                    : entry)
                  patch({ student_notes_history: updated }, true)
                  setStudentNotesHistory(updated)
                }}
              />
            ) : (
              <NotesSection
                title="Internal notes"
                notes={internalNotesHistory}
                avatarInitial="T"
                avatarBg={colors.textMuted}
                cardBg="#f6f8f8"
                addLabel="Add internal note"
                saving={internalNotesSaving}
                signifierLabel="Internal comms"
                helperText="Visible to staff only. Use for coaching, coordination, and operational follow-up."
                showHeader={false}
                mentionsEnabled
                onSave={async (text, mentionMembershipIds) => {
                  const response = await fetch(`/api/contacts/${contact.id}/internal-notes?tenant=${tenantId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, mention_membership_ids: mentionMembershipIds }),
                  })
                  const newEntry = await response.json()
                  if (!response.ok) {
                    showToast(newEntry?.error || 'Could not save note')
                    return false
                  }
                  setInternalNotesHistory((current) => [newEntry, ...current])
                  showToast('changes saved')
                  return true
                }}
                onToggleComplete={(index) => {
                  const updated = internalNotesHistory.map((entry, noteIndex) => noteIndex === index
                    ? { ...entry, completed_at: entry.completed_at ? null : new Date().toISOString() }
                    : entry)
                  patch({ notes_history: updated }, true)
                  setInternalNotesHistory(updated)
                }}
              />
            )}
          </DenseSectionPanel>
        </div>
      </div>
      )}

      <InvoiceStatusModal invoice={invoiceEdit} onClose={() => setInvoiceEdit(null)} onSave={saveInvoiceStatus} />
    </SlidePanel>
  )
}

const mobileActionControlStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const emailControlStyle: React.CSSProperties = {
  gap: spacing.xs,
  color: colors.textSecondary,
  fontWeight: typography.weightMedium,
  flexWrap: 'wrap',
  minHeight: `calc(${typography.sizeBase} + ${spacing.lg} + ${spacing.sm})`,
  padding: `${spacing.sm} ${spacing.lg}`,
  fontSize: typography.sizeBase,
  maxWidth: '100%',
  minWidth: 0,
  overflow: 'hidden',
}