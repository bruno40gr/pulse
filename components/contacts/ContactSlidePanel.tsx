'use client'
import { useState, useEffect, useRef } from 'react'
import { AlertCircle, TrendingDown, Clock, AlertTriangle, Star, CheckCircle, Info, Calendar } from 'lucide-react'
import { Avatar, Badge, SectionLabel, FieldRow, Button, Textarea, SlidePanel, SlidePanelHeader } from '@/components/ui'
import { colors, typography, radius, spacing, shadows } from '@/lib/tokens'
import { getActiveTenantId, shouldUseDiceBear, getDiceBearUrl } from '@/lib/tenant'

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
  custom_fields: Record<string, any>
  message_routing?: string
  is_minor?: boolean
  notes_history?: {text: string, timestamp: string}[]
  student_notes_history?: {text: string, timestamp: string}[]
}

interface TenantField {
  field_key: string
  field_label: string
  field_type: string
  field_options: string[] | null
}

interface Insight {
  type?: 'risk' | 'milestone' | 'info' | 'nudge'
  icon?: string
  text: string
}

const insightConfig: Record<string, { icon: React.ReactNode; borderColor: string; bg: string }> = {
  risk: { icon: <AlertCircle size={14} />, borderColor: colors.error, bg: 'rgba(220,38,38,0.06)' },
  milestone: { icon: <Star size={14} />, borderColor: colors.green, bg: 'rgba(61,139,95,0.06)' },
  info: { icon: <Info size={14} />, borderColor: colors.teal, bg: 'rgba(0,168,200,0.06)' },
  nudge: { icon: <Clock size={14} />, borderColor: colors.yellow, bg: 'rgba(245,166,35,0.06)' },
}

interface ContactSlidePanelProps {
  contact: Contact
  tenantFields: TenantField[]
  onClose: () => void
  onUpdated: (updated: Contact) => void
  onCompose?: (contactIds: string[]) => void
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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'auto',
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: typography.sizeBase,
  fontWeight: typography.weightMedium,
  color: colors.textMuted,
  marginBottom: '2px',
  fontFamily: typography.fontSans,
}

const fieldValueStyle: React.CSSProperties = {
  ...typography.body,
  fontWeight: typography.weightMedium,
  color: colors.text,
}

export default function ContactSlidePanel({ contact, tenantFields, onClose, onUpdated, onCompose }: ContactSlidePanelProps) {
  const cleanName = (name: string | null | undefined) =>
    name?.replace(' (account)', '').trim() || null

  const hasDistinctAccountHolder = !!(
    contact.account_holder_name &&
    !contact.account_holder_name.includes('(account)') &&
    (
      contact.account_holder_phone !== contact.phone ||
      contact.account_holder_email !== contact.email
    )
  )

  const hasEnrollment = !!(
    contact.custom_fields?.instrument ||
    contact.custom_fields?.service_type ||
    contact.custom_fields?.lesson_day ||
    contact.custom_fields?.instructor ||
    contact.custom_fields?.plan_name ||
    contact.custom_fields?.band_name
  )

  const formatDate = (date: string | null | undefined) => {
    if (!date) return null
    return new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightSemibold,
    color: colors.textMuted,
    marginBottom: '12px',
    fontFamily: typography.fontSans,
  }

  const [insights, setInsights] = useState<Insight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [internalNoteInput, setInternalNoteInput] = useState('')
  const [studentNoteInput, setStudentNoteInput] = useState('')
  const [internalNotesSaving, setInternalNotesSaving] = useState(false)
  const [studentNotesSaving, setStudentNotesSaving] = useState(false)
  const [notesHistory, setNotesHistory] = useState<{text: string, timestamp: string}[]>(
    Array.isArray(contact.notes_history) ? contact.notes_history : []
  )
  const [studentNotesHistory, setStudentNotesHistory] = useState<{text: string, timestamp: string}[]>(
    Array.isArray(contact.student_notes_history) ? contact.student_notes_history : []
  )
  const [saving, setSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [edits, setEdits] = useState<Record<string, any>>({})
  const [showInternalInput, setShowInternalInput] = useState(false)
  const [showStudentInput, setShowStudentInput] = useState(false)
  const [showActions, setShowActions] = useState(false)
      const actionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
            setInsights(parsed)
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
      body: JSON.stringify({ contact: contactSummary, notes: '' })
    })
      .then(r => r.json())
      .then(data => {
        if (data.insights) {
          setInsights(data.insights)
          localStorage.setItem(cacheKey, JSON.stringify(data.insights))
          localStorage.setItem(cacheTimeKey, new Date().toISOString())
        }
        setInsightsLoading(false)
      })
      .catch(() => setInsightsLoading(false))
  }, [contact.id])

  useEffect(() => {
    if (!showActions) return
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showActions])

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
      onUpdated(updated)
      if (!silent) showToast('changes saved')
    } finally {
      setSaving(false)
    }
  }

  const saveInternalNote = async () => {
    if (!internalNoteInput.trim()) return
    setInternalNotesSaving(true)
    const newEntry = { text: internalNoteInput.trim(), timestamp: new Date().toISOString() }
    const updated = [newEntry, ...notesHistory]
    await patch({ notes_history: updated, notes: internalNoteInput.trim() }, true)
    setNotesHistory(updated)
    setInternalNoteInput('')
    setInternalNotesSaving(false)
    setShowInternalInput(false)
    showToast('changes saved')
  }

  const saveStudentNote = async () => {
    if (!studentNoteInput.trim()) return
    setStudentNotesSaving(true)
    const newEntry = { text: studentNoteInput.trim(), timestamp: new Date().toISOString() }
    const updated = [newEntry, ...studentNotesHistory]
    await patch({ student_notes_history: updated }, true)
    setStudentNotesHistory(updated)
    setStudentNoteInput('')
    setStudentNotesSaving(false)
    setShowStudentInput(false)
    showToast('changes saved')
  }

  const handleStartEditing = () => {
    const initial: Record<string, any> = {}
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

  const updateEdit = (key: string, value: string) => {
    setEdits(prev => ({ ...prev, [key]: value }))
  }

  const displayPhone = (phone: string | null) => {
    if (!phone) return null
    const cleaned = phone.replace(/^\+1\s?/, '').replace(/\D/g, '')
    if (cleaned.length === 10) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    if (cleaned.length === 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
    return phone.replace(/^\+1\s?/, '')
  }

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
  const ageLabel = age !== null ? `${age} y.o` : null
  const statusLabel = contact.client_status.charAt(0).toUpperCase() + contact.client_status.slice(1)
  const optedOutLabel = contact.opted_out ? 'Opted out' : null

  const showAccountHolder = computedIsMinor
    ? !!(contact.account_holder_name)
    : hasDistinctAccountHolder

  const divider = <div style={{ height: '1px', background: colors.borderLight, margin: `${spacing.md} ${spacing['2xl']}` }} />
  const sectionPad: React.CSSProperties = { padding: `0 ${spacing['2xl']}` }

  const noteAvatar = (initial: string, bg: string) => (
    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: 'white', flexShrink: 0, marginTop: '1px' }}>
      {initial}
    </div>
  )

  const formatNoteTimestamp = (ts: string) => {
    const d = new Date(ts)
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
  }

  return (
    <SlidePanel isOpen={true} onClose={onClose}>
      <SlidePanelHeader
        title={`${contact.first_name} ${contact.last_name}`}
        subtitle={[ageLabel, optedOutLabel].filter(Boolean).join(' \u2022 ') || undefined}
        avatar={{
          firstName: contact.first_name,
          lastName: contact.last_name,
          size: 48,
          src: shouldUseDiceBear(getActiveTenantId()) ? getDiceBearUrl(contact.first_name, contact.last_name) : undefined,
        }}
        titleSize={typography.size2xl}
        badge={<Badge variant={
          contact.opted_out ? 'error' :
          contact.client_status === 'active' ? 'success' :
          contact.client_status === 'pending' ? 'warning' :
          contact.client_status === 'inactive' ? 'neutral' :
          contact.client_status === 'lead' ? 'info' :
          'neutral'
        }>{statusLabel}</Badge>}
        onClose={onClose}
        toast={toastMessage || undefined}
      />

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 480px', flex: 1, overflow: 'hidden', background: colors.surface }}>
        {/* LEFT COLUMN */}
        <div style={{ overflowY: 'auto', borderRight: `1px solid ${colors.borderLight}` }}>
          {/* Account holder — always first for minors, only if distinct for adults */}
          {showAccountHolder && (
            <>
              <div style={{ padding: `${spacing.xl} ${spacing['2xl']} ${spacing.xs}` }}>
                <SectionLabel style={sectionHeaderStyle}>Account holder</SectionLabel>
              </div>
              <div style={sectionPad}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${spacing.lg} ${spacing['3xl']}` }}>
                  {contact.account_holder_name && (
                    <div>
                      <div style={fieldLabelStyle}>Name</div>
                      <div style={fieldValueStyle}>{cleanName(contact.account_holder_name)}</div>
                    </div>
                  )}
                  {contact.family_name && (
                    <div>
                      <div style={fieldLabelStyle}>Family</div>
                      <div style={fieldValueStyle}>{cleanName(contact.family_name)}</div>
                    </div>
                  )}
                  {contact.account_holder_phone && (
                    <div>
                      <div style={fieldLabelStyle}>Phone</div>
                      <div style={fieldValueStyle}>{displayPhone(contact.account_holder_phone)}</div>
                    </div>
                  )}
                  {contact.account_holder_email && (
                    <div>
                      <div style={fieldLabelStyle}>Email</div>
                      <div style={fieldValueStyle}>{contact.account_holder_email}</div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Student contact info — Phone, Email, DOB */}
          <div style={{ padding: `${showAccountHolder ? spacing.md : spacing.xl} ${spacing['2xl']} 0` }}>
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                <div>
                  <div style={fieldLabelStyle}>Phone</div>
                  <input
                    type="text"
                    value={edits.phone ?? contact.phone ?? ''}
                    onChange={e => updateEdit('phone', e.target.value)}
                    placeholder="Phone number"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <div style={fieldLabelStyle}>Email</div>
                  <input
                    type="email"
                    value={edits.email ?? contact.email ?? ''}
                    onChange={e => updateEdit('email', e.target.value)}
                    placeholder="Email address"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <div style={fieldLabelStyle}>Date of birth</div>
                  <input
                    type="date"
                    value={edits.date_of_birth ?? contact.date_of_birth ?? ''}
                    onChange={e => updateEdit('date_of_birth', e.target.value || '')}
                    style={{ ...inputStyle, width: '160px' }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${spacing.lg} ${spacing['3xl']}` }}>
                {displayPhone(contact.phone) && (
                  <div>
                    <div style={fieldLabelStyle}>Phone</div>
                    <div style={fieldValueStyle}>{displayPhone(contact.phone)}</div>
                  </div>
                )}
                {contact.email && (
                  <div>
                    <div style={fieldLabelStyle}>Email</div>
                    <div style={fieldValueStyle}>{contact.email}</div>
                  </div>
                )}
                {contact.date_of_birth && (
                  <div>
                    <div style={fieldLabelStyle}>Date of birth</div>
                    <div style={fieldValueStyle}>{formatDate(contact.date_of_birth)}</div>
                  </div>
                )}
                {contact.custom_fields?.preferred_channel && (
                  <div>
                    <div style={fieldLabelStyle}>Preferred channel</div>
                    <div style={fieldValueStyle}>{contact.custom_fields.preferred_channel}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Insights — in left column, tinted backgrounds */}
          {!showAccountHolder && divider}
          <div style={{ padding: `${spacing.md} ${spacing['2xl']} ${spacing.xs}` }}>
            <SectionLabel style={sectionHeaderStyle}>AI Insights</SectionLabel>
          </div>
          <div style={{ ...sectionPad, paddingBottom: spacing.sm }}>
            {insightsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {[...Array(3)].map((_, i) => (
                  <div key={i} style={{ height: '36px', background: colors.borderLight, borderRadius: radius.md, width: i === 2 ? '60%' : '100%' }} />
                ))}
              </div>
            ) : insights.length === 0 ? (
              <p style={{ ...typography.bodySmall, color: colors.textMuted, margin: 0 }}>No insights yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {insights.map((insight, i) => {
                  const config = insightConfig[insight.type ?? 'info'] ?? insightConfig.info
                  return (
                    <div key={i} style={{
                      background: config.bg,
                      borderLeft: `3px solid ${config.borderColor}`,
                      borderRadius: radius.md,
                      padding: `${spacing.sm} ${spacing.md}`,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: spacing.sm,
                    }}>
                      <span style={{ color: config.borderColor, flexShrink: 0, marginTop: '2px' }}>{config.icon}</span>
                      <span style={{ ...typography.bodySmall, color: colors.text, lineHeight: 1.5 }}>{insight.text}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* More details */}
          {tenantFields.length > 0 && (
            <>
              {divider}
              <div style={{ padding: `0 ${spacing['2xl']} ${spacing.xs}` }}>
                <SectionLabel style={sectionHeaderStyle}>More details</SectionLabel>
              </div>
              <div style={{ ...sectionPad, paddingBottom: spacing['2xl'] }}>
                {!hasEnrollment && !isEditing ? (
                  <p style={{ fontSize: typography.sizeSm, color: colors.textMuted, margin: 0, fontFamily: typography.fontSans }}>
                    No classes scheduled.
                  </p>
                ) : isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                    {tenantFields.map(f => {
                      const currentVal = edits[f.field_key] ?? contact.custom_fields?.[f.field_key] ?? ''
                      if (f.field_options?.length) {
                        return (
                          <div key={f.field_key}>
                            <div style={fieldLabelStyle}>{f.field_label}</div>
                            <select
                              value={String(currentVal)}
                              onChange={e => updateEdit(f.field_key, e.target.value)}
                              style={selectStyle}
                            >
                              <option value="">—</option>
                              {f.field_options.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </div>
                        )
                      }
                      return (
                        <div key={f.field_key}>
                          <div style={fieldLabelStyle}>{f.field_label}</div>
                          <input
                            type="text"
                            value={String(currentVal)}
                            onChange={e => updateEdit(f.field_key, e.target.value)}
                            placeholder={f.field_label}
                            style={inputStyle}
                          />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  tenantFields.map(f => {
                    const val = contact.custom_fields?.[f.field_key]
                    if (!val) return null
                    return (
                      <FieldRow key={f.field_key} label={f.field_label} value={String(val).charAt(0).toUpperCase() + String(val).slice(1)} />
                    )
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* RIGHT COLUMN — wider, notes-focused */}
        <div style={{ overflowY: 'auto', padding: `${spacing.xl} ${spacing['2xl']} ${spacing['2xl']}`, display: 'flex', flexDirection: 'column', gap: spacing.xl, background: colors.surface }}>
          {/* Notes */}
          <div>
            <SectionLabel style={sectionHeaderStyle}>Notes</SectionLabel>
            <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: spacing.md }}>Staff and parent communications</div>

            {!showStudentInput ? (
              <Button
                variant="secondary"
                onClick={() => setShowStudentInput(true)}
                style={{ width: '100%', justifyContent: 'flex-start' }}
              >
                + Add a note
              </Button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                <Textarea
                  value={studentNoteInput}
                  onChange={e => setStudentNoteInput(e.target.value)}
                  placeholder="Write a note..."
                  style={{ minHeight: '100px', border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: spacing.md, fontSize: typography.sizeBase, fontFamily: typography.fontSans, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end' }}>
                  <Button variant="ghost" size="sm" onClick={() => { setShowStudentInput(false); setStudentNoteInput('') }}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={saveStudentNote} disabled={studentNotesSaving}>
                    {studentNotesSaving ? 'Saving...' : 'Save note'}
                  </Button>
                </div>
              </div>
            )}
            {studentNotesHistory.length > 0 && !showStudentInput && (
              <div style={{ marginTop: spacing.md, display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {studentNotesHistory.map((entry, i) => (
                  <div key={i} style={{ background: colors.surface, border: `1px solid ${colors.borderLight}`, borderRadius: radius.md, padding: `${spacing.md}`, display: 'flex', gap: spacing.md }}>
                    {noteAvatar('S', colors.crimson)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: spacing.xs }}>
                        {formatNoteTimestamp(entry.timestamp)}
                      </div>
                      <div style={{ fontSize: typography.sizeBase, color: colors.text, lineHeight: 1.5 }}>{entry.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Internal notes */}
          <div>
            <SectionLabel style={sectionHeaderStyle}>Internal notes</SectionLabel>
            <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: spacing.md }}>Visible to your team only</div>

            {!showInternalInput ? (
              <Button
                variant="secondary"
                onClick={() => setShowInternalInput(true)}
                style={{ width: '100%', justifyContent: 'flex-start' }}
              >
                + Add internal note
              </Button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                <Textarea
                  value={internalNoteInput}
                  onChange={e => setInternalNoteInput(e.target.value)}
                  placeholder="Write an internal note..."
                  style={{ minHeight: '100px', border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: spacing.md, fontSize: typography.sizeBase, fontFamily: typography.fontSans, background: colors.backgroundSecondary, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end' }}>
                  <Button variant="ghost" size="sm" onClick={() => { setShowInternalInput(false); setInternalNoteInput('') }}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={saveInternalNote} disabled={internalNotesSaving}>
                    {internalNotesSaving ? 'Saving...' : 'Save note'}
                  </Button>
                </div>
              </div>
            )}
            {notesHistory.length > 0 && !showInternalInput && (
              <div style={{ marginTop: spacing.md, display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {notesHistory.map((entry, i) => (
                  <div key={i} style={{ background: colors.backgroundSecondary, borderRadius: radius.md, padding: `${spacing.md}`, display: 'flex', gap: spacing.md }}>
                    {noteAvatar('T', colors.textMuted)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: spacing.xs }}>
                        {formatNoteTimestamp(entry.timestamp)}
                      </div>
                      <div style={{ fontSize: typography.sizeBase, color: colors.text, lineHeight: 1.5 }}>{entry.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: `${spacing.lg} ${spacing['2xl']}`, borderTop: `1px solid ${colors.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: colors.surface }}>
        <span />
        {isEditing ? (
          <div style={{ display: 'flex', gap: spacing.sm }}>
            <Button variant="secondary" onClick={handleCancelEditing}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveEdits} disabled={saving}>{saving ? 'Saving...' : 'Done'}</Button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: spacing.sm }}>
            <Button variant="secondary" size="sm" onClick={handleStartEditing}>Edit</Button>
            <Button variant="primary" size="sm" onClick={() => onCompose?.([contact.id])}>Send a message</Button>
          </div>
        )}
      </div>

    </SlidePanel>
  )
}