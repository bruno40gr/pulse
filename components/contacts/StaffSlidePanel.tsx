'use client'
import { useState, useEffect } from 'react'
import { Badge, Button, SlidePanel, SlidePanelHeader, FieldLabel, FieldValue, SectionTitle, NotesSection } from '@/components/ui'
import { colors, typography, spacing } from '@/lib/tokens'
import { getActiveTenantId, shouldUseDemoPhotos, getDemoAvatarUrl } from '@/lib/tenant'

interface StaffStudent {
  enrollment_id: string
  student_id: string | null
  person_id: string | null
  name: string | null
  phone: string | null
  email: string | null
  client_status: string | null
  last_attended: string | null
  instrument: string | null
  service_type: string | null
  lesson_day: string | null
  lesson_time: string | null
}

interface StaffMember {
  id: string
  role: string
  is_active: boolean
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
  date_of_birth: string | null
  students: StaffStudent[]
}

interface StaffSlidePanelProps {
  staffId: string
  onClose: () => void
  onViewStudent?: (personId: string) => void
}

export default function StaffSlidePanel({ staffId, onClose, onViewStudent }: StaffSlidePanelProps) {
  const [staff, setStaff] = useState<StaffMember | null>(null)
  const [loading, setLoading] = useState(true)
  const tenantId = getActiveTenantId()

  useEffect(() => {
    fetch(`/api/staff/${staffId}`)
      .then(r => r.json())
      .then(data => {
        setStaff(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [staffId])

  const displayPhone = (phone: string | null) => {
    if (!phone) return null
    const cleaned = phone.replace(/^\+1\s?/, '').replace(/\D/g, '')
    if (cleaned.length === 10) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    if (cleaned.length === 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
    return phone.replace(/^\+1\s?/, '')
  }

  const formatDate = (date: string | null | undefined) => {
    if (!date) return null
    return new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const getInitials = (first: string | null, last: string | null) => {
    return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || '?'
  }

  if (loading) {
    return (
      <SlidePanel isOpen={true} onClose={onClose}>
        <SlidePanelHeader
          title="Loading..."
          onClose={onClose}
        />
        <div style={{ padding: spacing['2xl'], textAlign: 'center', color: colors.textMuted }}>
          Loading staff details...
        </div>
      </SlidePanel>
    )
  }

  if (!staff) {
    return (
      <SlidePanel isOpen={true} onClose={onClose}>
        <SlidePanelHeader
          title="Staff not found"
          onClose={onClose}
        />
        <div style={{ padding: spacing['2xl'], textAlign: 'center', color: colors.textMuted }}>
          Could not load staff member.
        </div>
      </SlidePanel>
    )
  }

  const fullName = `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
  const roleLabel = staff.role.charAt(0).toUpperCase() + staff.role.slice(1)
  const hasContactInfo = !!(staff.phone || staff.email || staff.date_of_birth)

  return (
    <SlidePanel isOpen={true} onClose={onClose}>
      <SlidePanelHeader
        title={fullName}
        avatar={{
          firstName: staff.first_name || '',
          lastName: staff.last_name || '',
          size: 48,
          src: shouldUseDemoPhotos(tenantId)
            ? getDemoAvatarUrl(tenantId, staff.first_name || '', staff.last_name || '', { isMinor: false })
            : undefined,
        }}
        titleSize={typography.size2xl}
        badge={
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Badge variant={staff.is_active ? 'success' : 'neutral'}>
              {roleLabel}
            </Badge>
            {!staff.is_active && (
              <span style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 500,
                background: '#F3F4F6',
                color: '#9CA3AF',
              }}>Inactive</span>
            )}
          </div>
        }
        onClose={onClose}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 480px', flex: 1, overflow: 'hidden', background: colors.surface }}>
        {/* LEFT COLUMN */}
        <div style={{ overflowY: 'auto', borderRight: `1px solid ${colors.borderLight}` }}>
          {/* Contact info */}
          {hasContactInfo && (
            <div style={{ padding: `${spacing.xl} ${spacing['2xl']}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${spacing.lg} ${spacing['3xl']}` }}>
                {staff.phone && (
                  <div>
                    <FieldLabel>Phone</FieldLabel>
                    <FieldValue>{displayPhone(staff.phone)}</FieldValue>
                  </div>
                )}
                {staff.email && (
                  <div>
                    <FieldLabel>Email</FieldLabel>
                    <FieldValue>{staff.email}</FieldValue>
                  </div>
                )}
                {staff.date_of_birth && (
                  <div>
                    <FieldLabel>Date of birth</FieldLabel>
                    <FieldValue>{formatDate(staff.date_of_birth)}</FieldValue>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Students */}
          {hasContactInfo && (
            <div style={{ height: '1px', background: colors.borderLight, margin: `0 ${spacing['2xl']}` }} />
          )}
          <div style={{ padding: `${spacing.lg} ${spacing['2xl']} ${spacing.xs}` }}>
            <SectionTitle>Students</SectionTitle>
            <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: spacing.md }}>
              {staff.students.length} {staff.students.length === 1 ? 'student' : 'students'}
            </div>
          </div>
          <div style={{ padding: `0 ${spacing['2xl']} ${spacing['2xl']}` }}>
            {staff.students.length === 0 ? (
              <p style={{ fontSize: typography.sizeSm, color: colors.textMuted, margin: 0 }}>
                No students assigned yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {staff.students.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    background: '#f6f8f8',
                    borderRadius: '8px',
                  }}>
                    <div style={{
                      width: '32px', height: '32px',
                      background: '#E5E7EB',
                      color: '#6B7280',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}>
                      {s.name ? getInitials(s.name.split(' ')[0], s.name.split(' ').slice(1).join(' ')) : '?'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
                      <button
                        onClick={() => s.person_id && onViewStudent?.(s.person_id)}
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#2563EB',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          textAlign: 'left',
                          fontFamily: typography.fontSans,
                          textDecoration: 'underline',
                        }}
                      >
                        {s.name || '—'}
                      </button>
                      <div style={{ fontSize: '12px', color: colors.textMuted, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {s.instrument && <span>{s.instrument}</span>}
                        {s.lesson_day && <span>{s.lesson_day}</span>}
                        {s.lesson_time && <span>{s.lesson_time}</span>}
                      </div>
                    </div>
                    {s.client_status && (
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '10px',
                        fontWeight: 500,
                        marginLeft: 'auto',
                        flexShrink: 0,
                        background: s.client_status === 'active' ? '#F0FDF4' :
                                   s.client_status === 'inactive' ? '#F3F4F6' :
                                   '#EEF2FF',
                        color: s.client_status === 'active' ? '#16A34A' :
                               s.client_status === 'inactive' ? '#9CA3AF' :
                               '#4F46E5',
                      }}>
                        {s.client_status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN — Notes */}
        <div style={{ overflowY: 'auto', padding: `${spacing.xl} ${spacing['2xl']}`, background: colors.surface }}>
          <NotesSection
            title="Notes"
            notes={[]}
            avatarInitial="T"
            avatarBg={colors.textMuted}
            cardBg="#f6f8f8"
            addLabel="Add a note"
            onSave={() => {}}
          />
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: `${spacing.lg} ${spacing['2xl']}`, borderTop: `1px solid ${colors.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0, background: colors.surface }}>
        <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
      </div>
    </SlidePanel>
  )
}