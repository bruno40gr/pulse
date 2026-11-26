'use client'

import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'
import { PersonName } from '@/components/ui/PersonName'
import { getStaffAvatarUrl } from '@/lib/staff-avatars'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { getActiveTenantId } from '@/lib/tenant'
import { Avatar, Button, PageHeader, SlidePanel, SlidePanelHeader, StatusBadge, type DataTableColumn, type DataTableSort } from '@/components/ui'
import { RichDataTable } from '@/components/ui/RichDataTable'
import { useTablePreferences } from '@/components/ui/TableDisplayControls'
import { STAFF_TABLE_SCHEMA } from '@/lib/staff-table-preferences'
import ConversationProfilePanel from '@/components/inbox/ConversationProfilePanel'
import type { Contact } from '@/app/dashboard/contacts/page'
import type { ConversationPerson } from '@/lib/conversations-live'
import { conversationComposeHref } from '@/lib/conversation-links'
import ComposePanel from '@/components/campaigns/ComposePanel'
import { Send } from 'lucide-react'
import { colors, typography, spacing, radius } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'

type StaffSortKey = import('@/lib/staff-table-preferences').StaffSortKey

interface StaffMember {
  id: string
  person_id: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
  is_active: boolean
}

type ComposeContact = (Contact & { bulk?: false }) | {
  bulk: true
  recipientIds: string[]
  recipientPreview: Array<{ id: string; first_name: string; last_name: string }>
}

export default function StaffPage() {
  const router = useRouter()
  const tenantId = getActiveTenantId()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [profileStaff, setProfileStaff] = useState<StaffMember | null>(null)
  const profilePerson = useMemo<ConversationPerson | null>(() => profileStaff?.person_id ? {
    id: profileStaff.person_id, profileId: profileStaff.person_id, profileType: 'contact', smsContactId: profileStaff.person_id,
    name: `${profileStaff.first_name || ''} ${profileStaff.last_name || ''}`.trim(),
    phone: profileStaff.phone || '', email: profileStaff.email || '', student: '', stage: '',
  } : null, [profileStaff])
  const [composeContact, setComposeContact] = useState<ComposeContact | null>(null)
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set())
  const tablePreferences = useTablePreferences(STAFF_TABLE_SCHEMA)
  const [staffSort, setStaffSort] = useState<DataTableSort<StaffSortKey>>(() => (tablePreferences.preferences.sort as DataTableSort<StaffSortKey>) || { key: 'name', direction: 'asc' })
  const storedSort = tablePreferences.preferences.sort
  useEffect(() => {
    if (storedSort) setStaffSort({ key: storedSort.key as StaffSortKey, direction: storedSort.direction })
  }, [storedSort?.key, storedSort?.direction]) // eslint-disable-line react-hooks/exhaustive-deps -- identity comes from the stored values
  const isMobile = useIsMobile()

  useEffect(() => {
    fetch(`/api/staff?tenant=${encodeURIComponent(tenantId)}`).then(r => r.json())
      .then(data => {
        const list = (Array.isArray(data) ? data : []).filter((s: StaffMember) => s.is_active !== false)
        list.sort((a: StaffMember, b: StaffMember) =>
          `${a.last_name || ''} ${a.first_name || ''}`.localeCompare(`${b.last_name || ''} ${b.first_name || ''}`)
        )
        setStaff(list)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [tenantId])

  const displayPhone = (phone: string | null) => {
    if (!phone) return '—'
    const cleaned = phone.replace(/^\+1\s?/, '').replace(/\D/g, '')
    if (cleaned.length === 10) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    if (cleaned.length === 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
    return phone.replace(/^\+1\s?/, '')
  }

  const fullName = (s: StaffMember) => `${s.first_name || ''} ${s.last_name || ''}`.trim()
  const sortedStaff = [...staff].sort((left, right) => {
    const direction = staffSort.direction === 'asc' ? 1 : -1
    const values: Record<StaffSortKey, [string, string]> = {
      name: [`${left.last_name || ''} ${left.first_name || ''}`, `${right.last_name || ''} ${right.first_name || ''}`],
      contact: [left.phone || left.email || '', right.phone || right.email || ''],
      status: [left.is_active ? 'active' : 'sunset', right.is_active ? 'active' : 'sunset'],
    }
    const [leftValue, rightValue] = values[staffSort.key]
    const comparison = leftValue.localeCompare(rightValue, undefined, { sensitivity: 'base' })
    if (comparison !== 0) return comparison * direction
    return `${left.last_name || ''} ${left.first_name || ''}`.localeCompare(`${right.last_name || ''} ${right.first_name || ''}`, undefined, { sensitivity: 'base' })
  })
  const selectableStaff = staff.filter(member => member.person_id)
  const selectedStaff = selectableStaff.filter(member => selectedStaffIds.has(member.id))

  const staffColumns: DataTableColumn<StaffMember, StaffSortKey>[] = [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(220px, 1.2fr)',
      sortable: true,
      sortKey: 'name',
      render: (member) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 }}>
          <Avatar firstName={member.first_name || ''} lastName={member.last_name || ''} size={32} src={getStaffAvatarUrl(tenantId, `${member.first_name || ''} ${member.last_name || ''}`)} />
          <PersonName>{fullName(member)}</PersonName>
        </span>
      ),
    },
    {
      id: 'contact',
      header: 'Contact',
      width: 'minmax(260px, 1.4fr)',
      sortable: true,
      sortKey: 'contact',
      render: (member) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, minWidth: 0 }}>
          <span>{member.phone ? displayPhone(member.phone) : 'No phone'}</span>
          <span style={{ color: colors.textSecondary, overflowWrap: 'anywhere' }}>{member.email || 'No email'}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: '120px',
      sortable: true,
      sortKey: 'status',
      render: (member) => <StatusBadge status={member.is_active ? 'active' : 'sunset'} label={member.is_active ? 'Active' : 'Sunset'} />,
    },
  ]

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
    <div style={{ padding: spacing['3xl'], width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
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

      <RichDataTable
        preferenceSchema={STAFF_TABLE_SCHEMA}
        preferenceState={tablePreferences}
        rows={sortedStaff}
        columns={staffColumns}
        getRowKey={(member) => member.id}
        sort={staffSort}
        onSortChange={nextSort => { setStaffSort(nextSort); tablePreferences.updatePreferences({ ...tablePreferences.preferences, sort: nextSort }) }}
        selection={{
          selectedKeys: selectedStaffIds,
          isSelectable: (member) => Boolean(member.person_id),
          onToggle: (member) => toggleStaffSelection(member.id),
          onToggleAll: toggleSelectAll,
          allSelected: selectableStaff.length > 0 && selectableStaff.every((member) => selectedStaffIds.has(member.id)),
          someSelected: selectedStaff.length > 0 && selectedStaff.length < selectableStaff.length,
          selectAllLabel: 'Select all staff',
          getRowLabel: fullName,
        }}
        loading={loading}
        skeletonRows={6}
        emptyContent="No staff found."
        onRowClick={(member) => {
          if (member.person_id) setProfileStaff(member)
        }}
        getRowStyle={(member) => ({
          background: selectedStaffIds.has(member.id) ? colors.surfaceMuted : colors.surface,
          cursor: member.person_id ? 'pointer' : 'default',
        })}
        ariaLabel="Staff"
      />

      {profilePerson && (
        <ConversationProfilePanel
          key={profilePerson.id}
          person={profilePerson}
          tenantId={tenantId}
          onClose={() => setProfileStaff(null)}
          onCompose={channel => router.push(conversationComposeHref(tenantId, profilePerson.id, channel))}
          onContactUpdated={(updated) => {
            setStaff(rows => {
              const member = rows.find(row => row.person_id === updated.id)
              const saved = { id: member?.id || updated.staff_id || '', person_id: updated.id, first_name: updated.first_name, last_name: updated.last_name, phone: updated.phone, email: updated.email, is_active: updated.is_active !== false }
              if (!saved.id) return rows
              return [...rows.filter(row => row.person_id !== updated.id), saved].filter(member => member.is_active !== false)
            })
          }}
        />
      )}

      {composeContact && (
        <SlidePanel isOpen={true} onClose={() => setComposeContact(null)} fullScreen={isMobile} width={PROFILE_PANEL_WIDTH}>
          <SlidePanelHeader
            title={composeContact.bulk ? `Message to ${composeContact.recipientIds.length} staff members` : `Message to ${composeContact.first_name}`}
            onClose={() => setComposeContact(null)}
            onBack={composeContact.bulk ? undefined : () => setComposeContact(null)}
            backLabel="Back to staff card"
          />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
