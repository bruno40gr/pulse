'use client'
import { useState, useEffect } from 'react'

interface Contact {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
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
  internal_notes?: string
  student_notes?: string
}

interface TenantField {
  field_key: string
  field_label: string
  field_type: string
  field_options: string[] | null
}

interface Insight {
  icon: string
  text: string
}

interface ContactSlidePanelProps {
  contact: Contact
  tenantFields: TenantField[]
  onClose: () => void
  onUpdated: (updated: Contact) => void
}

const avatarColors = ['#C8392B', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#0891B2']

export default function ContactSlidePanel({ contact, tenantFields, onClose, onUpdated }: ContactSlidePanelProps) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [internalNotes, setInternalNotes] = useState(contact.internal_notes || contact.notes || '')
  const [studentNotes, setStudentNotes] = useState(contact.student_notes || '')
  const [saving, setSaving] = useState(false)

  const avatarColor = avatarColors[(contact.first_name.charCodeAt(0) + contact.last_name.charCodeAt(0)) % avatarColors.length]

  useEffect(() => {
    console.log('Contact phone:', contact.phone, 'is_minor:', contact.is_minor, 'message_routing:', contact.message_routing)
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
      body: JSON.stringify({ contact: contactSummary, notes: internalNotes })
    })
      .then(r => r.json())
      .then(data => {
        if (data.insights) setInsights(data.insights)
        setInsightsLoading(false)
      })
      .catch(() => setInsightsLoading(false))
  }, [contact.id])

  const patch = async (fields: Partial<Contact>) => {
    setSaving(true)
    try {
      const updated = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      }).then(r => r.json())
      onUpdated(updated)
    } finally {
      setSaving(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 600, color: '#6B6B6B',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px'
  }

  const fieldRowStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '8px', fontSize: '13px'
  }

  const fieldLabelStyle: React.CSSProperties = { color: '#6B6B6B' }
  const fieldValueStyle: React.CSSProperties = { color: '#1A1A1A', fontWeight: 500 }

  const sectionStyle: React.CSSProperties = {
    padding: '20px 24px', borderBottom: '1px solid #F0F0EC'
  }

  const routing = contact.is_minor ? 'account_holder' : (contact.message_routing || 'account_holder')

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh',
        width: 'min(75vw, 900px)',
        background: 'white', zIndex: 50,
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E8E4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', background: avatarColor, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 600, color: 'white' }}>
              {contact.first_name[0]}{contact.last_name[0]}
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: '#1A1A1A', fontFamily: 'var(--font-dm-sans), sans-serif' }}>{contact.first_name} {contact.last_name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
                  background: contact.client_status === 'active' ? '#F0FDF4' : '#F8F8F7',
                  color: contact.client_status === 'active' ? '#16A34A' : '#6B6B6B',
                }}>{contact.client_status}</span>
                {contact.opted_out && (
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: '#FEF2F2', color: '#DC2626' }}>Opted out</span>
                )}
                {contact.is_minor && (
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: '#EFF6FF', color: '#1D4ED8' }}>Minor</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6B6B6B' }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', flex: 1, overflow: 'hidden' }}>
          {/* LEFT COLUMN */}
          <div style={{ overflowY: 'auto', borderRight: '1px solid #F0F0EC' }}>
            {/* Contact info */}
            <div style={sectionStyle}>
              <div style={labelStyle}>Contact</div>
              {contact.phone && (
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Phone</span>
                  <span style={{ ...fieldValueStyle, fontFamily: 'monospace', fontSize: '12px' }}>{contact.phone}</span>
                </div>
              )}
              {contact.email && (
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Email</span>
                  <span style={fieldValueStyle}>{contact.email}</span>
                </div>
              )}
              {contact.last_attended && (
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Last attended</span>
                  <span style={fieldValueStyle}>{new Date(contact.last_attended).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {/* Account holder */}
            {(contact.account_holder_name || contact.account_holder_phone || contact.account_holder_email || contact.family_name) && (
              <div style={sectionStyle}>
                <div style={labelStyle}>Account holder</div>
                {contact.family_name && (
                  <div style={fieldRowStyle}>
                    <span style={fieldLabelStyle}>Family</span>
                    <span style={fieldValueStyle}>{contact.family_name}</span>
                  </div>
                )}
                {contact.account_holder_name && (
                  <div style={fieldRowStyle}>
                    <span style={fieldLabelStyle}>Name</span>
                    <span style={fieldValueStyle}>{contact.account_holder_name}</span>
                  </div>
                )}
                {contact.account_holder_phone && (
                  <div style={fieldRowStyle}>
                    <span style={fieldLabelStyle}>Phone</span>
                    <span style={{ ...fieldValueStyle, fontFamily: 'monospace', fontSize: '12px' }}>{contact.account_holder_phone}</span>
                  </div>
                )}
                {contact.account_holder_email && (
                  <div style={fieldRowStyle}>
                    <span style={fieldLabelStyle}>Email</span>
                    <span style={fieldValueStyle}>{contact.account_holder_email}</span>
                  </div>
                )}
              </div>
            )}

            {/* Select message recipient */}
            <div style={sectionStyle}>
              <div style={labelStyle}>Select message recipient</div>

              {(() => {
                const hasAccountHolder = !!(contact.account_holder_phone || contact.account_holder_email)
                const hasStudentPhone = !!contact.phone

                if (contact.is_minor) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button
                        onClick={() => patch({ message_routing: 'account_holder' })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          background: 'white', border: `1px solid ${routing === 'account_holder' ? '#1A1A1A' : '#E8E8E4'}`,
                          borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', outline: 'none',
                          textAlign: 'left', fontFamily: 'var(--font-dm-sans), sans-serif', width: '100%',
                        }}
                      >
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${routing === 'account_holder' ? '#1A1A1A' : '#D0D0D0'}`, background: routing === 'account_holder' ? '#1A1A1A' : 'white', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {routing === 'account_holder' && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white' }} />}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#1A1A1A', fontFamily: 'var(--font-dm-sans), sans-serif' }}>Parent or account holder</span>
                      </button>

                      <button
                        onClick={() => hasStudentPhone && patch({ message_routing: 'student' })}
                        disabled={!hasStudentPhone}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          background: hasStudentPhone ? 'white' : '#FAFAF9',
                          border: `1px solid ${routing === 'student' ? '#1A1A1A' : '#E8E8E4'}`,
                          borderRadius: '10px', padding: '12px 14px', outline: 'none',
                          cursor: hasStudentPhone ? 'pointer' : 'not-allowed',
                          textAlign: 'left', fontFamily: 'var(--font-dm-sans), sans-serif', width: '100%',
                          opacity: hasStudentPhone ? 1 : 0.5,
                        }}
                      >
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${routing === 'student' ? '#1A1A1A' : '#D0D0D0'}`, background: routing === 'student' ? '#1A1A1A' : 'white', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {routing === 'student' && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white' }} />}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#1A1A1A', fontFamily: 'var(--font-dm-sans), sans-serif' }}>Student</div>
                          {!hasStudentPhone && <div style={{ fontSize: '11px', color: '#A0A0A0', marginTop: '2px' }}>No phone on file</div>}
                        </div>
                      </button>

                      {routing === 'student' && (
                        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#92400E', lineHeight: 1.5 }}>
                          This student is under 18. Make sure you have permission to contact them directly.
                        </div>
                      )}
                    </div>
                  )
                }

                const options = []
                if (hasAccountHolder) {
                  options.push({ value: 'account_holder', label: 'Account holder', hasPhone: true })
                }
                options.push({ value: 'student', label: 'Student', hasPhone: hasStudentPhone })

                if (options.length === 0) return (
                  <p style={{ fontSize: '13px', color: '#A0A0A0', margin: 0 }}>No phone numbers on file.</p>
                )

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {options.map(option => (
                      <button
                        key={option.value}
                        onClick={() => option.hasPhone && patch({ message_routing: option.value })}
                        disabled={!option.hasPhone}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          background: option.hasPhone ? 'white' : '#FAFAF9',
                          border: `1px solid ${routing === option.value ? '#1A1A1A' : '#E8E8E4'}`,
                          borderRadius: '10px', padding: '12px 14px', outline: 'none',
                          cursor: option.hasPhone ? 'pointer' : 'not-allowed',
                          textAlign: 'left', fontFamily: 'var(--font-dm-sans), sans-serif', width: '100%',
                          opacity: option.hasPhone ? 1 : 0.5,
                        }}
                      >
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${routing === option.value ? '#1A1A1A' : '#D0D0D0'}`, background: routing === option.value ? '#1A1A1A' : 'white', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {routing === option.value && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white' }} />}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#1A1A1A', fontFamily: 'var(--font-dm-sans), sans-serif' }}>{option.label}</div>
                          {!option.hasPhone && <div style={{ fontSize: '11px', color: '#A0A0A0', marginTop: '2px' }}>No phone on file</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Custom fields */}
            {tenantFields.length > 0 && (
              <div style={sectionStyle}>
                <div style={labelStyle}>Details</div>
                {tenantFields.map(f => (
                  <div key={f.field_key} style={fieldRowStyle}>
                    <span style={fieldLabelStyle}>{f.field_label}</span>
                    <span style={fieldValueStyle}>{contact.custom_fields?.[f.field_key] ? (contact.custom_fields[f.field_key].charAt(0).toUpperCase() + contact.custom_fields[f.field_key].slice(1)) : '—'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* AI Insights */}
            <div style={sectionStyle}>
              <div style={labelStyle}>Insights</div>
              {insightsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} style={{ height: '40px', background: '#F0F0EC', borderRadius: '8px' }} />
                  ))}
                </div>
              ) : insights.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#A0A0A0', margin: 0 }}>No insights yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {insights.map((insight, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#FAFAF9', border: '1px solid #E8E8E4', borderRadius: '8px', padding: '10px 12px' }}>
                      <span style={{ fontSize: '15px', flexShrink: 0 }}>{insight.icon}</span>
                      <span style={{ fontSize: '13px', color: '#1A1A1A', lineHeight: 1.5, fontFamily: 'var(--font-dm-sans), sans-serif' }}>{insight.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN — Notes */}
          <div style={{ background: '#FAFAF9', overflowY: 'auto', padding: '28px 24px', borderLeft: '1px solid #F0F0EC', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Internal notes */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px', fontFamily: 'var(--font-dm-sans), sans-serif' }}>Internal notes</div>
              <div style={{ fontSize: '12px', color: '#A0A0A0', marginBottom: '10px' }}>Visible to your team only</div>
              <textarea
                value={internalNotes}
                onChange={e => setInternalNotes(e.target.value)}
                onBlur={() => patch({ notes: internalNotes })}
                placeholder="Add internal notes about this contact..."
                style={{
                  width: '100%', minHeight: '120px', border: '1px solid #E8E8E4',
                  borderRadius: '8px', padding: '10px 12px', fontSize: '13px',
                  fontFamily: 'var(--font-dm-sans), sans-serif', resize: 'vertical',
                  outline: 'none', lineHeight: 1.6, boxSizing: 'border-box', color: '#1A1A1A',
                  background: 'white',
                }}
              />
            </div>

            {/* Student notes */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px', fontFamily: 'var(--font-dm-sans), sans-serif' }}>Student notes</div>
              <div style={{ fontSize: '12px', color: '#A0A0A0', marginBottom: '10px' }}>About this student</div>
              <textarea
                value={studentNotes}
                onChange={e => setStudentNotes(e.target.value)}
                onBlur={() => patch({ student_notes: studentNotes })}
                placeholder="Notes about progress, preferences, or history..."
                style={{
                  width: '100%', minHeight: '120px', border: '1px solid #E8E8E4',
                  borderRadius: '8px', padding: '10px 12px', fontSize: '13px',
                  fontFamily: 'var(--font-dm-sans), sans-serif', resize: 'vertical',
                  outline: 'none', lineHeight: 1.6, boxSizing: 'border-box', color: '#1A1A1A',
                  background: 'white',
                }}
              />
            </div>

            {/* Send a message CTA */}
            <button style={{
              marginTop: 'auto', width: '100%', background: '#C8392B', color: 'white',
              border: 'none', borderRadius: '10px', padding: '12px',
              fontSize: '14px', fontWeight: 500, cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans), sans-serif',
            }}>
              Send a message
            </button>
          </div>
        </div>
      </div>
    </>
  )
}