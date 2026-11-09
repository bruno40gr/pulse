'use client'

import type { ReactNode } from 'react'
import { Avatar, Button, DenseSectionPanel, FieldLabel, FieldValue } from '@/components/ui'
import { colors } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'
import { getActiveTenantId, shouldUseDemoPhotos, getDemoAvatarUrl } from '@/lib/tenant'
import { getStaffAvatarUrl } from '@/lib/staff-avatars'

type DetailContact = { date_of_birth?: string | null; custom_fields: Record<string, unknown>; instructor?: { name: string | null; person_id: string | null } | null }
export function ContactDetailsPanel({ contact, populatedFields, onViewInstructor, children }: { contact: DetailContact; populatedFields: { field_key: string; field_label: string }[]; onViewInstructor?: (id: string) => void; children?: ReactNode }) {
  const isMobile = useIsMobile()
  const tenantId = getActiveTenantId()
  const formatDOB = (date: string) => new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return <DenseSectionPanel title="Details">
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '1fr 1fr', gap: isMobile ? '16px' : '16px 32px', minWidth: 0 }}>
                {contact.date_of_birth && (
                  <div>
                    <FieldLabel>DOB</FieldLabel>
                    <FieldValue style={{ overflowWrap: 'anywhere' }}>{formatDOB(contact.date_of_birth)}</FieldValue>
                  </div>
                )}
                {children}
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
                            : getStaffAvatarUrl(tenantId, instrName)}
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
                          <Button variant="secondary" size="sm"
                            onClick={() => onViewInstructor(contact.instructor!.person_id!)}
                            style={{ maxWidth: '100%' }}
                          >
                            {content}
                          </Button>
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
}
