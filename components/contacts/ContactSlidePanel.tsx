'use client'
import { useState, useEffect, useRef } from 'react'
import { AlertCircle, TrendingDown, Clock, AlertTriangle, Star, CheckCircle, Info, Calendar } from 'lucide-react'
import { Avatar, Badge, SectionLabel, FieldRow, Button, Textarea, SlidePanel } from '@/components/ui'
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
  risk: { icon: <AlertCircle size={14} />, borderColor: colors.crimson },
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

export default function ContactSlidePanel({ contact, tenantFields, onClose, onUpdated, onCompose }: ContactSlidePanelProps) {
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
  const [showInternalNoteInput, setShowInternalNoteInput] = useState(false)
  const [showStudentNoteInput, setShowStudentNoteInput] = useState(false)
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
    setShowInternalNoteInput(false)
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
    setShowStudentNoteInput(false)
    showToast('changes saved')
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
      if (age > 0 && age < 100) return age
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
      {/* Header */}
      <div style={{ padding: `${spacing.xl} ${spacing['2xl']} ${spacing.lg}`, borderBottom: `1px solid ${colors.borderLight}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <Avatar firstName={contact.first_name} lastName={contact.last_name} size={56} src={shouldUseDiceBear(getActiveTenantId()) ? getDiceBearUrl(contact.first_name, contact.last_name) : undefined} />
          <div>
            <h2 style={{ fontSize: typography.size3xl, fontWeight: typography.weightSemibold, margin: 0, color: colors.text, fontFamily: typography.fontSans, lineHeight: 1.15 }}>
              {contact.first_name} {contact.last_name}
              <Badge variant={contact.client_status === 'active' ? 'success' : 'neutral'} style={{ marginLeft: spacing.sm, verticalAlign: 'middle' }}>{statusLabel}</Badge>
            </h2>
            <div style={{ fontSize: typography.sizeBase, color: colors.textSecondary, marginTop: '3px', fontFamily: typography.fontSans }}>
              {[ageLabel, optedOutLabel].filter(Boolean).join(' \u2022 ')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, paddingTop: spacing.xs }}>
          {toastMessage && (
            <span style={{ fontSize: typography.sizeSm, color: colors.textMuted, fontFamily: typography.fontSans }}>
              {toastMessage}
            </span>
          )}
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: colors.textSecondary, lineHeight: 1 }}>×</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', flex: 1, overflow: 'hidden', background: colors.surface }}>
        {/* LEFT COLUMN */}
        <div style={{ overflowY: 'auto', borderRight: `1px solid ${colors.borderLight}` }}>
          <div style={{ padding: `${spacing.md} ${spacing['2xl']} 0` }}>
            <SectionLabel>Contact info</SectionLabel>
          </div>
          <div style={sectionPad}>
            {displayPhone(contact.phone) && <FieldRow label="Phone" value={displayPhone(contact.phone)} />}
            {contact.email && <FieldRow label="Email" value={contact.email} />}
            {contact.date_of_birth && (
              <FieldRow label="DOB">
                {isEditing ? (
                  <input
                    type="date"
                    value={contact.date_of_birth || ''}
                    onChange={(e) => patch({ date_of_birth: e.target.value || null })}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: radius.sm,
                      padding: `${spacing.xs} ${spacing.sm}`,
                      fontSize: typography.sizeBase,
                      fontFamily: typography.fontSans,
                      color: colors.text,
                      background: colors.surface,
                      outline: 'none',
                      width: '140px',
                    }}
                  />
                ) : (
                  <span style={{ fontSize: typography.size15, fontWeight: typography.weightMedium, color: colors.text, fontFamily: typography.fontSans }}>
                    {new Date(contact.date_of_birth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </FieldRow>
            )}
            {contact.is_minor && contact.account_holder_name && (
              <FieldRow label="Parent" value={contact.account_holder_name} />
            )}
          </div>

          {(contact.account_holder_name || contact.account_holder_phone || contact.account_holder_email || contact.family_name) && (
            <div style={{ padding: `${spacing.sm} ${spacing['2xl']} 0` }}>
              <SectionLabel>Account holder</SectionLabel>
              <div style={{ marginTop: spacing.xs }}>
                {contact.family_name && <FieldRow label="Family" value={contact.family_name} />}
                {contact.account_holder_name && <FieldRow label="Name" value={contact.account_holder_name} />}
                {contact.account_holder_phone && <FieldRow label="Phone" value={displayPhone(contact.account_holder_phone)} />}
                {contact.account_holder_email && <FieldRow label="Email" value={contact.account_holder_email} />}
              </div>
            </div>
          )}

          {tenantFields.length > 0 && (
            <>
              {divider}
              <div style={{ padding: `0 ${spacing['2xl']} ${spacing.xs}` }}>
                <SectionLabel>Details</SectionLabel>
              </div>
              <div style={sectionPad}>
                {tenantFields.map(f => {
                  const val = contact.custom_fields?.[f.field_key]
                  return (
                    <FieldRow key={f.field_key} label={f.field_label} value={val ? (val.charAt(0).toUpperCase() + val.slice(1)) : null} />
                  )
                })}
              </div>
            </>
          )}

          {computedIsMinor && (
            <>
              {divider}
              <div style={{ padding: `0 ${spacing['2xl']} ${spacing.xs}` }}>
                <SectionLabel>Message recipient</SectionLabel>
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
            <SectionLabel>Message history</SectionLabel>
          </div>
          <div style={sectionPad}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
              {[
                { date: 'Apr 12', text: 'Hey Tyler, see you in class at 4pm this Thursday...' },
                { date: 'Mar 28', text: 'Thanks for confirming the schedule change...' },
                { date: 'Feb 15', text: 'Welcome to Headliner! Your first lesson is...' },
              ].map((msg, i) => (
                <div key={i} style={{ display: 'flex', gap: spacing.sm, fontSize: typography.sizeBase, lineHeight: 1.4 }}>
                  <span style={{ color: colors.textMuted, fontFamily: typography.fontSans, flexShrink: 0, fontSize: typography.sizeSm }}>{msg.date}</span>
                  <span style={{ color: colors.text, fontFamily: typography.fontSans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.text}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowMessageHistory(true)}
              style={{
                background: 'transparent', border: 'none', padding: 0,
                marginTop: spacing.sm,
                fontSize: typography.sizeSm, color: colors.textSecondary,
                cursor: 'pointer', fontFamily: typography.fontSans,
                textDecoration: 'underline', textUnderlineOffset: '2px',
              }}
            >
              View all messages →
            </button>
          </div>

          {divider}
          <div style={{ padding: `0 ${spacing['2xl']} ${spacing.xs}` }}>
            <SectionLabel>Insights</SectionLabel>
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
                  const config = insightConfig[insight.type || 'info']
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
            <SectionLabel>Notes</SectionLabel>
            <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: spacing.sm }}>Staff and parent communications</div>

            {!showStudentNoteInput && studentNotesHistory.length === 0 ? (
              <div style={{ background: colors.backgroundSecondary, borderRadius: radius.md, padding: `${spacing.md} ${spacing.lg}`, textAlign: 'center' }}>
                <div style={{ fontSize: typography.sizeSm, color: colors.textMuted, marginBottom: spacing.sm }}>No notes yet</div>
                <Button size="sm" variant="secondary" onClick={() => setShowStudentNoteInput(true)}>Add note</Button>
              </div>
            ) : (
              <>
                {studentNotesHistory.length > 0 && !showStudentNoteInput && (
                  <div style={{ marginBottom: spacing.sm }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, marginBottom: spacing.sm }}>
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
                    <Button size="sm" variant="secondary" onClick={() => setShowStudentNoteInput(true)}>Add note</Button>
                  </div>
                )}

                {(showStudentNoteInput || (studentNotesHistory.length === 0 && showStudentNoteInput)) && (
                  <>
                    <Textarea
                      value={studentNoteInput}
                      onChange={e => setStudentNoteInput(e.target.value)}
                      placeholder="Add a note..."
                      style={{ minHeight: '72px' }}
                    />
                    <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm }}>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={saveStudentNote}
                        disabled={studentNotesSaving || !studentNoteInput.trim()}
                        style={{ background: studentNoteInput.trim() ? colors.espresso : undefined, color: studentNoteInput.trim() ? 'white' : undefined }}
                      >
                        {studentNotesSaving ? 'Saving...' : 'Save note'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setShowStudentNoteInput(false); setStudentNoteInput('') }}>Cancel</Button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Internal notes */}
          <div>
            <SectionLabel>Internal notes</SectionLabel>
            <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: spacing.sm }}>Visible to your team only</div>

            {!showInternalNoteInput && notesHistory.length === 0 ? (
              <div style={{ background: colors.backgroundSecondary, borderRadius: radius.md, padding: `${spacing.md} ${spacing.lg}`, textAlign: 'center' }}>
                <div style={{ fontSize: typography.sizeSm, color: colors.textMuted, marginBottom: spacing.sm }}>No notes yet</div>
                <Button size="sm" variant="secondary" onClick={() => setShowInternalNoteInput(true)}>Add note</Button>
              </div>
            ) : (
              <>
                {notesHistory.length > 0 && !showInternalNoteInput && (
                  <div style={{ marginBottom: spacing.sm }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, marginBottom: spacing.sm }}>
                      {notesHistory.map((entry, i) => (
                        <div key={i} style={{ background: colors.backgroundSecondary, borderRadius: radius.md, padding: `${spacing.sm} ${spacing.md}` }}>
                          <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: spacing.xs }}>
                            {new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div style={{ fontSize: typography.sizeBase, color: colors.text, lineHeight: 1.5 }}>{entry.text}</div>
                        </div>
                      ))}
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setShowInternalNoteInput(true)}>Add note</Button>
                  </div>
                )}

                {(showInternalNoteInput || (notesHistory.length === 0 && showInternalNoteInput)) && (
                  <>
                    <Textarea
                      value={internalNoteInput}
                      onChange={e => setInternalNoteInput(e.target.value)}
                      placeholder="Add a note..."
                      style={{ minHeight: '72px' }}
                    />
                    <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm }}>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={saveInternalNote}
                        disabled={internalNotesSaving || !internalNoteInput.trim()}
                        style={{ background: internalNoteInput.trim() ? colors.espresso : undefined, color: internalNoteInput.trim() ? 'white' : undefined }}
                      >
                        {internalNotesSaving ? 'Saving...' : 'Save note'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setShowInternalNoteInput(false); setInternalNoteInput('') }}>Cancel</Button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: `${spacing.lg} ${spacing['2xl']}`, borderTop: `1px solid ${colors.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: colors.surface }}>
        <span />
        {isEditing ? (
          <div style={{ display: 'flex', gap: spacing.sm }}>
            <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setIsEditing(false)}>Save changes</Button>
          </div>
        ) : (
          <div ref={actionsRef} style={{ position: 'relative' }}>
            <Button
              variant="secondary"
              onClick={() => setShowActions(!showActions)}
              style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}
            >
              Actions
              <span style={{ fontSize: '10px', marginLeft: '2px' }}>▾</span>
            </Button>
            {showActions && (
              <div style={{
                position: 'absolute', bottom: '100%', right: 0, marginBottom: spacing.xs,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                boxShadow: shadows.elevated,
                minWidth: '160px',
                zIndex: 60,
                overflow: 'hidden',
              }}>
                <button
                  onClick={() => { setIsEditing(true); setShowActions(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: 'transparent', border: 'none',
                    fontSize: typography.sizeBase, color: colors.text,
                    cursor: 'pointer', fontFamily: typography.fontSans,
                  }}
                >
                  Edit contact
                </button>
                <button
                  onClick={() => { onCompose?.([contact.id]); setShowActions(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: 'transparent', border: 'none',
                    borderTop: `1px solid ${colors.borderLight}`,
                    fontSize: typography.sizeBase, color: colors.text,
                    cursor: 'pointer', fontFamily: typography.fontSans,
                  }}
                >
                  Send a message
                </button>
              </div>
            )}
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