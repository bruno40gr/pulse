'use client'
import { useState, useEffect } from 'react'
import { getActiveTenantId } from '@/lib/tenant'
import { Avatar, Badge, Button, PageHeader, SlidePanel, SlidePanelHeader } from '@/components/ui'
import ContactSlidePanel from '@/components/contacts/ContactSlidePanel'
import ComposePanel from '@/components/campaigns/ComposePanel'
import { Send } from 'lucide-react'
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
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set())

  const fetchStaff = () => fetch(`/api/staff?tenant=${tenantId}`).then(r => r.json())

  useEffect(() => {
    fetchStaff()
      .then(data => {
        const list = (Array.isArray(data) ? data : []).filter((s: StaffMember) => s.is_active !== false)
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
  const selectableStaff = staff.filter(member => member.person_id)
  const selectedStaff = selectableStaff.filter(member => selectedStaffIds.has(member.id))

  const toggleStaffSelection = (staffId: string) => {
    setSelectedStaffIds(previous => {
      const next = new Set(previous)
      if (next.has(staffId)) next.delete(staffId)
      else next.add(staffId)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedStaffIds(selectedStaffIds.size === selectableStaff.length ? new Set() : new Set(selectableStaff.map(member => member.id)))
  }

  const openBulkCompose = () => {
    if (!selectedStaff.length) return
    setComposeContact({
      bulk: true,
      recipientIds: selectedStaff.map(member => member.person_id as string),
      recipientPreview: selectedStaff.map(member => ({
        id: member.person_id as string,
        first_name: member.first_name || '',
        last_name: member.last_name || '',
      })),
    })
  }

  return (
    <div style={{ padding: spacing['3xl'], maxWidth: 1100 }}>
      <PageHeader
        title="Staff"
        subtitle="Instructors and team members. Click a row to edit contact info, add a phone number, or sunset/offboard."
      />

      {selectedStaff.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.lg, padding: `${spacing.sm} ${spacing.md}`, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surfaceMuted }}>
          <span style={{ fontSize: typography.sizeSm, color: colors.textSecondary, fontFamily: typography.fontSans }}>
            {selectedStaff.length} {selectedStaff.length === 1 ? 'staff member selected' : 'staff members selected'}
          </span>
          <Button type="button" variant="primary" size="sm" onClick={openBulkCompose}>
            <Send size={14} />
            Send message
          </Button>
        </div>
      )}

      {loading ? (
        <p style={{ color: colors.textMuted, fontFamily: typography.fontSans }}>Loading staff…</p>
      ) : staff.length === 0 ? (
        <p style={{ color: colors.textMuted, fontFamily: typography.fontSans }}>No staff found.</p>
      ) : (
        <div style={{ background: colors.surface, borderRadius: radius.lg, border: `1px solid ${colors.borderLight}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '48px' }}>
                  <input type="checkbox" checked={selectableStaff.length > 0 && selectedStaffIds.size === selectableStaff.length} onChange={toggleSelectAll} aria-label="Select all staff" style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                </th>
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
                  style={{ cursor: 'pointer', transition: 'background 0.1s', borderBottom: `1px solid ${colors.borderLight}`, background: selectedStaffIds.has(s.id) ? colors.surfaceMuted : colors.surface }}
                  onMouseEnter={e => (e.currentTarget.style.background = colors.surfaceMuted)}
                  onMouseLeave={e => (e.currentTarget.style.background = selectedStaffIds.has(s.id) ? colors.surfaceMuted : colors.surface)}
                >
                  <td style={tdStyle} onClick={event => event.stopPropagation()}>
                    <input type="checkbox" checked={selectedStaffIds.has(s.id)} onChange={() => toggleStaffSelection(s.id)} aria-label={`Select ${fullName(s)}`} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  </td>
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
            title={composeContact.bulk ? `Message to ${composeContact.recipientIds.length} staff members` : `Message to ${composeContact.first_name}`}
            onClose={() => setComposeContact(null)}
            onBack={composeContact.bulk ? undefined : () => setComposeContact(null)}
            backLabel="Staff card"
          />
          <div style={{ flex: 1, overflow: 'auto' }}>
            <ComposePanel
              recipientCount={composeContact.bulk ? composeContact.recipientIds.length : 1}
              filterExplanation={composeContact.bulk ? `Message to ${composeContact.recipientIds.length} selected staff members` : `Message to ${composeContact.first_name} ${composeContact.last_name}`}
              recipientIds={composeContact.bulk ? composeContact.recipientIds : [composeContact.id]}
              channel="sms"
              mode={composeContact.bulk ? 'bulk' : 'single'}
              contactContext={composeContact.bulk ? undefined : composeContact}
              composeSource="scratch"
              composeIntent="neutral"
              recipientPreview={composeContact.bulk ? composeContact.recipientPreview : [{
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
