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

const insightConfig: Record<string, { icon: React.ReactNode; borderColor: string }> = {
  risk: { icon: <AlertCircle size={14} />, borderColor: colors.error },
  milestone: { icon: <Star size={14} />, borderColor: colors.green },
  info: { icon: <Info size={14} />, borderColor: colors.teal },
  nudge: { icon: <Clock size={14} />, borderColor: colors.yellow },
}

interface ContactSlidePanelProps {
  contact: Contact
  tenantFields: TenantField[]
  onClose: () => void
  onUpdated: (updated: Contact) => void
  onCompose?: (contactIds: string[]) => void
}

function RadioGroup({ options, value, onChange }: {
  options: { value: string; label: string; disabled?: boolean }[]
  value: string
  onChange: (val: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: spacing.lg }}>
      {options.map((opt) => {
        const isDisabled = opt.disabled
        return (
          <label
            key={opt.value}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing.sm,
              padding: `${spacing.xs} 0`,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.5 : 1,
              fontFamily: typography.fontSans,
              fontSize: typography.sizeBase,
              color: colors.text,
            }}
          >
            <input
              type="radio"
              checked={value === opt.value}
              onChange={() => !isDisabled && onChange(opt.value)}
              disabled={isDisabled}
              style={{ accentColor: colors.espresso, width: '16px', height: '16px', cursor: isDisabled ? 'not-allowed' : 'pointer', margin: 0 }}
            />
            {opt.label}
          </label>
        )
      })}
    </div>
  )
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
  const [showMessageHistory, setShowMessageHistory] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cacheKey = `pulse_contact_insights_${contact.id}`
    const cacheTimeKey = `pulse_contact_insights_time_${contact.id}`
    const cached = localStorage.getItem(cacheKey)
    const cachedTime = localStorage.getItem(cacheTimeKey)

    // Show cached data instantly if within 10 min
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
    // Populate edits from current contact values
    const initial: Record<string, any> = {}
    if (contact.phone) initial.phone = contact.phone
    if (contact.email) initial.email = contact.email
    if (contact.date_of_birth) initial.date_of_birth = contact.date_of_birth
    // Include all tenant field values
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

  const routing = contact.message_routing || 'account_holder'
  const hasStudentPhone = !!contact.phone

  const displayPhone = (phone: string | null) => {
    if (!phone) return null
    const cleaned = phone.replace(/^\+1\s?/, '').replace(/\D/g, '')
    if (cleaned.length === 10) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    if (cleaned.length === 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
    return phone.replace(/^\+1\s?/, '')
  }

  // Calculate age from date_of_birth
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
  const ageLabel = age !== null ? `${age} y.o` : (contact.is_minor ? 'Minor' : null)
  const statusLabel = contact.client_status.charAt(0).toUpperCase() + contact.client_status.slice(1)
  const optedOutLabel = contact.opted_out ? 'Opted out' : null

  const divider = <div style={{ height: '1px', background: colors.borderLight, margin: `${spacing.md} ${spacing['2xl']}` }} />
  const sectionPad: React.CSSProperties = { padding: `0 ${spacing['2xl']}` }

  return (
    <SlidePanel isOpen={true} onClose={onClose}>
      <SlidePanelHeader
        title={`${contact.first_name} ${contact.last_name}`}
        subtitle={[ageLabel, optedOutLabel].filter(Boolean).join(' \u2022 ') || undefined}
        avatar={{
          firstName: contact.first_name,
          lastName: contact.last_name,
          size: 40,
          src: shouldUseDiceBear(getActiveTenantId()) ? getDiceBearUrl(contact.first_name, contact.last_name) : undefined,
        }}
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', flex: 1, overflow: 'hidden', background: colors.surface }}>
        {/* LEFT COLUMN */}
        <div style={{ overflowY: 'auto', borderRight: `1px solid ${colors.borderLight}` }}>
          <div style={{ padding: `${spacing.md} ${spacing['2xl']} 0` }}>
            <SectionLabel style={sectionHeaderStyle}>Contact info</SectionLabel>
          </div>
          <div style={sectionPad}>
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                <div>
                  <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: '2px', fontFamily: typography.fontSans }}>Phone</div>
                  <input
                    type="text"
                    value={edits.phone ?? contact.phone ?? ''}
                    onChange={e => updateEdit('phone', e.target.value)}
                    placeholder="Phone number"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: '2px', fontFamily: typography.fontSans }}>Email</div>
                  <input
                    type="email"
                    value={edits.email ?? contact.email ?? ''}
                    onChange={e => updateEdit('email', e.target.value)}
                    placeholder="Email address"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: '2px', fontFamily: typography.fontSans }}>Date of birth</div>
                  <input
                    type="date"
                    value={edits.date_of_birth ?? contact.date_of_birth ?? ''}
                    onChange={e => updateEdit('date_of_birth', e.target.value || '')}
                    style={{ ...inputStyle, width: '160px' }}
                  />
                </div>
              </div>
            ) : (
              <>
                {displayPhone(contact.phone) && <FieldRow label="Phone" value={displayPhone(contact.phone)} />}
                {contact.email && <FieldRow label="Email" value={contact.email} />}
                {contact.date_of_birth && (
                  <FieldRow label="DOB">
                    <span style={{ fontSize: typography.size15, fontWeight: typography.weightMedium, color: colors.text, fontFamily: typography.fontSans }}>
                      {formatDate(contact.date_of_birth)}
                    </span>
                  </FieldRow>
                )}
              </>
            )}
            {contact.custom_fields?.preferred_channel && (
              <FieldRow label="Preferred channel" value={contact.custom_fields.preferred_channel} />
            )}
            {hasDistinctAccountHolder && contact.account_holder_name && (
              <FieldRow label="Parent" value={cleanName(contact.account_holder_name)} />
            )}
          </div>

          {hasDistinctAccountHolder && (
            <div style={{ padding: `${spacing.sm} ${spacing['2xl']} 0` }}>
              <SectionLabel style={sectionHeaderStyle}>Account holder</SectionLabel>
              <div style={{ marginTop: spacing.xs }}>
                {contact.family_name && <FieldRow label="Family" value={cleanName(contact.family_name)} />}
                {contact.account_holder_name && <FieldRow label="Name" value={cleanName(contact.account_holder_name)} />}
                {contact.account_holder_phone && <FieldRow label="Phone" value={displayPhone(contact.account_holder_phone)} />}
                {contact.account_holder_email && <FieldRow label="Email" value={contact.account_holder_email} />}
              </div>
            </div>
          )}

          {tenantFields.length > 0 && (
            <>
              {divider}
              <div style={{ padding: `0 ${spacing['2xl']} ${spacing.xs}` }}>
                <SectionLabel style={sectionHeaderStyle}>Details</SectionLabel>
              </div>
              <div style={sectionPad}>
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
                            <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: '2px', fontFamily: typography.fontSans }}>{f.field_label}</div>
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
                          <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: '2px', fontFamily: typography.fontSans }}>{f.field_label}</div>
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

          {computedIsMinor && (
            <>
              {divider}
              <div style={{ padding: `0 ${spacing['2xl']} ${spacing.xs}` }}>
                <SectionLabel style={sectionHeaderStyle}>Message recipient</SectionLabel>
              </div>
              <div style={sectionPad}>
                <RadioGroup
                  options={[
                    { value: 'account_holder', label: 'Parent or account holder' },
                    { value: 'student', label: 'Student', disabled: !hasStudentPhone },
                  ]}
                  value={routing}
                  onChange={(val) => patch({ message_routing: val })}
                />
                {routing === 'student' && (
                  <div style={{ marginTop: spacing.sm, background: colors.warningLight, borderRadius: radius.sm, padding: `${spacing.xs} ${spacing.sm}`, fontSize: typography.sizeSm, color: colors.warning, lineHeight: 1.5 }}>
                    Under 18. Confirm you have permission before messaging this student.
                  </div>
                )}
              </div>
            </>
          )}

          {divider}
          <div style={{ padding: `0 ${spacing['2xl']} ${spacing.xs}` }}>
            <SectionLabel style={sectionHeaderStyle}>Message history</SectionLabel>
          </div>
          <div style={sectionPad}>
            <div style={{
              border: `1px dashed ${colors.border}`,
              borderRadius: radius.md,
              padding: `${spacing.md} ${spacing.lg}`,
              textAlign: 'center',
            }}>
              <p style={{ fontSize: typography.sizeSm, color: colors.textMuted, margin: 0 }}>No messages sent yet</p>
            </div>
          </div>

          {divider}
          <div style={{ padding: `0 ${spacing['2xl']} ${spacing.xs}` }}>
            <SectionLabel style={sectionHeaderStyle}>Insights</SectionLabel>
          </div>
          <div style={{ ...sectionPad, paddingBottom: spacing['2xl'] }}>
            {insightsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {[...Array(3)].map((_, i) => (
                  <div key={i} style={{ height: '36px', background: colors.borderLight, borderRadius: radius.md, width: i === 2 ? '60%' : '80%' }} />
                ))}
              </div>
            ) : insights.length === 0 ? (
              <p style={{ fontSize: typography.sizeSm, color: colors.textMuted, margin: 0 }}>No insights yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {insights.map((insight, i) => {
                  const config = insightConfig[insight.type ?? 'info'] ?? insightConfig.info
                  return (
                    <div key={i} style={{
                      background: colors.surface,
                      borderLeft: `3px solid ${config.borderColor}`,
                      borderRadius: radius.sm,
                      padding: `${spacing.sm} ${spacing.md}`,
                      fontSize: typography.sizeBase,
                      color: colors.text,
                      lineHeight: 1.5,
                      fontFamily: typography.fontSans,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: spacing.sm,
                    }}>
                      <span style={{ color: config.borderColor, flexShrink: 0, marginTop: '2px' }}>{config.icon}</span>
                      <span>{insight.text}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ overflowY: 'auto', padding: `${spacing.md} ${spacing['2xl']} ${spacing['2xl']}`, borderLeft: `1px solid ${colors.borderLight}`, display: 'flex', flexDirection: 'column', gap: spacing.lg, background: colors.surface }}>
          {/* Notes */}
          <div>
            <SectionLabel style={sectionHeaderStyle}>Notes</SectionLabel>
            <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: spacing.sm }}>Staff and parent communications</div>

            {!showStudentInput ? (
              <Button
                variant="ghost"
                onClick={() => setShowStudentInput(true)}
                style={{ width: '100%', justifyContent: 'flex-start', border: '1px dashed #E8E8E4' }}
              >
                + Add a note...
              </Button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Textarea
                  value={studentNoteInput}
                  onChange={e => setStudentNoteInput(e.target.value)}
                  placeholder="Add a note..."
                  style={{ minHeight: '80px' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="primary" size="sm" onClick={saveStudentNote} disabled={studentNotesSaving}>
                    {studentNotesSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setShowStudentInput(false); setStudentNoteInput('') }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {studentNotesHistory.length > 0 && !showStudentInput && (
              <div style={{ marginTop: spacing.sm, display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                {studentNotesHistory.map((entry, i) => (
                  <div key={i} style={{ background: colors.surface, border: `1px solid ${colors.borderLight}`, borderRadius: radius.md, padding: `${spacing.sm} ${spacing.md}`, display: 'flex', gap: spacing.sm }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: colors.crimson, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, color: 'white', flexShrink: 0, marginTop: '1px' }}>S</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: spacing.xs }}>
                        {new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
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
            <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: spacing.sm }}>Visible to your team only</div>

            {!showInternalInput ? (
              <Button
                variant="ghost"
                onClick={() => setShowInternalInput(true)}
                style={{ width: '100%', justifyContent: 'flex-start', border: '1px dashed #E8E8E4' }}
              >
                + Add a note...
              </Button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Textarea
                  value={internalNoteInput}
                  onChange={e => setInternalNoteInput(e.target.value)}
                  placeholder="Add a note..."
                  style={{ minHeight: '80px' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="primary" size="sm" onClick={saveInternalNote} disabled={internalNotesSaving}>
                    {internalNotesSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setShowInternalInput(false); setInternalNoteInput('') }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {notesHistory.length > 0 && !showInternalInput && (
              <div style={{ marginTop: spacing.sm, display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                {notesHistory.map((entry, i) => (
                  <div key={i} style={{ background: colors.backgroundSecondary, borderRadius: radius.md, padding: `${spacing.sm} ${spacing.md}` }}>
                    <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: spacing.xs }}>
                      {new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: typography.sizeBase, color: colors.text, lineHeight: 1.5 }}>{entry.text}</div>
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

      {/* Message history modal */}
      {showMessageHistory && (
        <>
          <div onClick={() => setShowMessageHistory(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 70 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: colors.surface, borderRadius: radius.xl,
            boxShadow: shadows.xl, zIndex: 80,
            width: 'min(90vw, 640px)', maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: `${spacing.xl} ${spacing['2xl']}`, borderBottom: `1px solid ${colors.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: typography.sizeLg, fontWeight: typography.weightSemibold, margin: 0, color: colors.text, fontFamily: typography.fontSans }}>
                Message history
              </h3>
              <button onClick={() => setShowMessageHistory(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: colors.textSecondary }}>×</button>
            </div>
            <div style={{ padding: spacing['2xl'], overflowY: 'auto', flex: 1 }}>
              <p style={{ fontSize: typography.sizeBase, color: colors.textMuted, textAlign: 'center', padding: spacing['4xl'] }}>
                Message history will appear here.
              </p>
            </div>
          </div>
        </>
      )}
    </SlidePanel>
  )
}