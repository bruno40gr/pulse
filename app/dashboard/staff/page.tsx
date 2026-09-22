'use client'
import { useState, useEffect } from 'react'
import { getActiveTenantId } from '@/lib/tenant'
import { Avatar, Badge, PageHeader, SlidePanel, SlidePanelHeader } from '@/components/ui'
import ContactSlidePanel from '@/components/contacts/ContactSlidePanel'
import ComposePanel from '@/components/campaigns/ComposePanel'
import { colors, typography, spacing, radius } from '@/lib/tokens'

interface StaffMember {
  id: string
  person_id: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
  is_active: boolean
}

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 600,
  color: colors.textSecondary,
  borderBottom: `1px solid ${colors.borderLight}`,
  fontFamily: typography.fontSans,
}

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '14px',
  color: colors.text,
  borderBottom: `1px solid ${colors.borderLight}`,
  fontFamily: typography.fontSans,
}

export default function StaffPage() {
  const tenantId = getActiveTenantId()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedContact, setSelectedContact] = useState<any>(null)
  const [tenantFields, setTenantFields] = useState<any[]>([])
  const [composeContact, setComposeContact] = useState<any>(null)

  const fetchStaff = () => fetch(`/api/staff?tenant=${tenantId}`).then(r => r.json())

  useEffect(() => {
    fetchStaff()
      .then(data => {
        const list = Array.isArray(data) ? data : []
        list.sort((a: StaffMember, b: StaffMember) =>
          `${a.last_name || ''} ${a.first_name || ''}`.localeCompare(`${b.last_name || ''} ${b.first_name || ''}`)
        )
        setStaff(list)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetch(`/api/tenant-fields?tenant=${tenantId}`)
      .then(r => r.json())
      .then(d => setTenantFields(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [tenantId])

  const openContact = async (personId: string) => {
    const contact = await fetch(`/api/contacts/${personId}`).then(r => r.json())
    if (contact && !contact.error) setSelectedContact(contact)
  }

  const displayPhone = (phone: string | null) => {
    if (!phone) return '—'
    const cleaned = phone.replace(/^\+1\s?/, '').replace(/\D/g, '')
    if (cleaned.length === 10) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    if (cleaned.length === 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
    return phone.replace(/^\+1\s?/, '')
  }

  const fullName = (s: StaffMember) => `${s.first_name || ''} ${s.last_name || ''}`.trim()

  return (
    <div style={{ padding: spacing['3xl'], maxWidth: 1100 }}>
      <PageHeader
        title="Staff"
        subtitle="Instructors and team members. Click a row to edit contact info, add a phone number, or sunset/offboard."
      />

      {loading ? (
        <p style={{ color: colors.textMuted, fontFamily: typography.fontSans }}>Loading staff…</p>
      ) : staff.length === 0 ? (
        <p style={{ color: colors.textMuted, fontFamily: typography.fontSans }}>No staff found.</p>
      ) : (
        <div style={{ background: colors.surface, borderRadius: radius.lg, border: `1px solid ${colors.borderLight}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Phone</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr
                  key={s.id}
                  onClick={() => s.person_id && openContact(s.person_id)}
                  style={{ cursor: 'pointer', transition: 'background 0.1s', borderBottom: `1px solid ${colors.borderLight}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = colors.surfaceMuted)}
                  onMouseLeave={e => (e.currentTarget.style.background = colors.surface)}
                >
                  <td style={tdStyle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                      <Avatar firstName={s.first_name || ''} lastName={s.last_name || ''} size={32} />
                      <span style={{ fontWeight: 600 }}>{fullName(s)}</span>
                    </span>
                  </td>
                  <td style={tdStyle}>{displayPhone(s.phone)}</td>
                  <td style={tdStyle}>{s.email || '—'}</td>
                  <td style={tdStyle}>
                    <Badge size="sm" variant={s.is_active ? 'success' : 'inactive'}>
                      {s.is_active ? 'Active' : 'Sunset'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedContact && (
        <ContactSlidePanel
          contact={selectedContact}
          tenantFields={tenantFields}
          onClose={() => setSelectedContact(null)}
          onCompose={(ids) => {
            if (ids.length === 1 && selectedContact) {
              setComposeContact(selectedContact)
              setSelectedContact(null)
            }
          }}
          onUpdated={(updated) => {
            setSelectedContact(updated)
            fetchStaff().then(data => setStaff(Array.isArray(data) ? data : []))
          }}
        />
      )}

      {composeContact && (
        <SlidePanel isOpen={true} onClose={() => setComposeContact(null)}>
          <SlidePanelHeader
            title={`Message to ${composeContact.first_name}`}
            onClose={() => setComposeContact(null)}
          />
          <div style={{ flex: 1, overflow: 'auto' }}>
            <ComposePanel
              recipientCount={1}
              filterExplanation={`Message to ${composeContact.first_name} ${composeContact.last_name}`}
              recipientIds={[composeContact.id]}
              channel="sms"
              mode="single"
              contactContext={composeContact}
              composeSource="scratch"
              composeIntent="neutral"
              recipientPreview={[{
                id: composeContact.id,
                first_name: composeContact.first_name,
                last_name: composeContact.last_name,
              }]}
              onClose={() => setComposeContact(null)}
              onSent={() => {
                setTimeout(() => setComposeContact(null), 3000)
              }}
            />
          </div>
        </SlidePanel>
      )}
    </div>
  )
}
