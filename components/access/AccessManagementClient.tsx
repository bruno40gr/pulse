'use client'

import { ControlButton } from '@/components/ui/ControlButton'
import { getStaffAvatarUrl } from '@/lib/staff-avatars'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, LockKeyhole, Plus, RefreshCw, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { Avatar, Badge, Button, Input, PageContainer, PageHeader, Select, SlidePanel, SlidePanelHeader, SurfacePanel, Tabs } from '@/components/ui'
import { colors, radius, spacing, typography } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'

type AccessTab = 'people' | 'roles'

type Permission = {
  id: string
  key: string
  description: string
}

type Role = {
  id: string
  key: string
  name: string
  description: string | null
  is_system: boolean
  permissionIds: string[]
}

type Membership = {
  id: string
  person_id: string
  role_id: string
  status: 'unclaimed' | 'invited' | 'active' | 'suspended' | 'deactivated'
  auth_user_id: string | null
  invited_at: string | null
  activated_at: string | null
  person: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    custom_fields?: Record<string, unknown> | null
  } | null
}

type AccessData = {
  currentMembershipId: string
  currentRoleKey: string
  canManageRoles: boolean
  roles: Role[]
  permissions: Permission[]
  memberships: Membership[]
  availableStaff: AvailableStaff[]
}

type AvailableStaff = {
  id: string
  person_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  custom_fields?: Record<string, unknown> | null
}

const permissionGroupLabels: Record<string, string> = {
  accounts: 'Accounts',
  roles: 'Roles & permissions',
  staff: 'Staff',
  contacts: 'Contacts',
  leads: 'Leads',
  notes: 'Notes',
  communications: 'Communications',
  tenant_settings: 'Tenant settings',
  audit: 'Audit log',
  data_migrations: 'Data tools',
}

const statusLabels: Record<Membership['status'], string> = {
  unclaimed: 'Not set up',
  invited: 'Invited',
  active: 'Active',
  suspended: 'Suspended',
  deactivated: 'Deactivated',
}

const statusVariants: Record<Membership['status'], 'neutral' | 'info' | 'success' | 'warning' | 'inactive'> = {
  unclaimed: 'neutral',
  invited: 'info',
  active: 'success',
  suspended: 'warning',
  deactivated: 'inactive',
}

function fullName(membership: Membership) {
  const firstName = membership.person?.first_name || ''
  const lastName = membership.person?.last_name || ''
  return `${firstName} ${lastName}`.trim() || 'Unnamed staff member'
}

function permissionGroup(permission: Permission) {
  return permission.key.split('.')[0]
}

export default function AccessManagementClient({ tenantId, embedded = false }: { tenantId: string; embedded?: boolean }) {
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState<AccessTab>('people')
  const [data, setData] = useState<AccessData | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [draftPermissionIds, setDraftPermissionIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDescription, setNewRoleDescription] = useState('')
  const [showAccountForm, setShowAccountForm] = useState(false)
  const [accountSource, setAccountSource] = useState<'existing' | 'new'>('new')
  const [accountPersonId, setAccountPersonId] = useState('')
  const [accountRoleId, setAccountRoleId] = useState('')
  const [accountFirstName, setAccountFirstName] = useState('')
  const [accountLastName, setAccountLastName] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [accountPhone, setAccountPhone] = useState('')

  const fetchAccessData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/account/access?tenant=${tenantId}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not load access settings.')
      setData(payload)
      setSelectedRoleId(current => current || payload.roles.find((role: Role) => role.key === 'admin')?.id || payload.roles[0]?.id || '')
      setAccountRoleId(current => current || payload.roles.find((role: Role) => role.key === 'admin')?.id || payload.roles[0]?.id || '')
      setAccountSource(current => payload.availableStaff?.length ? current : 'new')
      setAccountPersonId(current => current || payload.availableStaff?.[0]?.person_id || '')
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    fetchAccessData()
  }, [fetchAccessData])

  const selectedRole = data?.roles.find(role => role.id === selectedRoleId) || null
  const assignableRoles = useMemo(
    () => (data?.roles || []).filter(role => data?.canManageRoles || role.key !== 'owner'),
    [data?.canManageRoles, data?.roles],
  )

  useEffect(() => {
    setDraftPermissionIds(new Set(selectedRole?.permissionIds || []))
    setMessage('')
    setError('')
  }, [selectedRole])

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, Permission[]>()
    for (const permission of data?.permissions || []) {
      const group = permissionGroup(permission)
      groups.set(group, [...(groups.get(group) || []), permission])
    }
    return [...groups.entries()]
  }, [data?.permissions])

  const saveRoleAssignment = async (membership: Membership, roleId: string) => {
    if (!data || membership.role_id === roleId) return
    const previousRoleId = membership.role_id
    setSavingKey(`membership:${membership.id}`)
    setError('')
    setMessage('')
    setData({
      ...data,
      memberships: data.memberships.map(item => item.id === membership.id ? { ...item, role_id: roleId } : item),
    })

    try {
      const response = await fetch(`/api/account/access?tenant=${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign_role', membershipId: membership.id, roleId }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not update this staff member.')
      setMessage(`${fullName(membership)}’s role was updated.`)
    } catch (caught) {
      setData(current => current ? {
        ...current,
        memberships: current.memberships.map(item => item.id === membership.id ? { ...item, role_id: previousRoleId } : item),
      } : current)
      setError((caught as Error).message)
    } finally {
      setSavingKey('')
    }
  }

  const savePermissions = async () => {
    if (!data || !selectedRole || selectedRole.key === 'owner') return
    setSavingKey(`role:${selectedRole.id}`)
    setError('')
    setMessage('')
    const permissionIds = [...draftPermissionIds]

    try {
      const response = await fetch(`/api/account/access?tenant=${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_role_permissions', roleId: selectedRole.id, permissionIds }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not save permissions.')
      setData({
        ...data,
        roles: data.roles.map(role => role.id === selectedRole.id ? { ...role, permissionIds } : role),
      })
      setMessage(`${selectedRole.name} permissions were saved.`)
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setSavingKey('')
    }
  }

  const createRole = async () => {
    if (!data || !newRoleName.trim()) return
    setSavingKey('new-role')
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/account/access?tenant=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoleName, description: newRoleDescription }),
      })
      const role = await response.json()
      if (!response.ok) throw new Error(role.error || 'Could not create the role.')
      setData({ ...data, roles: [...data.roles, role].sort((left, right) => left.name.localeCompare(right.name)) })
      setSelectedRoleId(role.id)
      setNewRoleName('')
      setNewRoleDescription('')
      setShowRoleForm(false)
      setMessage(`${role.name} was created. Choose what this role can do.`)
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setSavingKey('')
    }
  }

  const resetAccountForm = () => {
    setAccountSource(data?.availableStaff.length ? 'existing' : 'new')
    setAccountPersonId(data?.availableStaff[0]?.person_id || '')
    setAccountRoleId(assignableRoles.find(role => role.key === 'admin')?.id || assignableRoles[0]?.id || '')
    setAccountFirstName('')
    setAccountLastName('')
    setAccountEmail('')
    setAccountPhone('')
  }

  const closeAccountForm = () => {
    setShowAccountForm(false)
    resetAccountForm()
  }

  const createAccount = async () => {
    if (!data || !accountRoleId) return
    if (accountSource === 'existing' && !accountPersonId) return
    if (accountSource === 'new' && (!accountFirstName.trim() || !accountLastName.trim())) return

    setSavingKey('new-account')
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/account/access?tenant=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_account',
          source: accountSource,
          personId: accountSource === 'existing' ? accountPersonId : undefined,
          roleId: accountRoleId,
          firstName: accountSource === 'new' ? accountFirstName : undefined,
          lastName: accountSource === 'new' ? accountLastName : undefined,
          email: accountSource === 'new' ? accountEmail : undefined,
          phone: accountSource === 'new' ? accountPhone : undefined,
        }),
      })
      const membership = await response.json()
      if (!response.ok) throw new Error(membership.error || 'Could not add the account.')
      setData({
        ...data,
        memberships: [...data.memberships, membership],
        availableStaff: data.availableStaff.filter(staff => staff.person_id !== membership.person_id),
      })
      const name = `${membership.person?.first_name || ''} ${membership.person?.last_name || ''}`.trim() || 'Staff member'
      setMessage(`${name} now has an unclaimed account. No invitation was sent.`)
      closeAccountForm()
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setSavingKey('')
    }
  }

  const sendInvitation = async (membership: Membership) => {
    const isResend = membership.status === 'invited'
    setSavingKey(`invitation:${membership.id}`)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/account/access?tenant=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isResend ? 'resend_invitation' : 'invite',
          membershipId: membership.id,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not send the account email.')
      setData(current => current ? {
        ...current,
        memberships: current.memberships.map(item => item.id === membership.id ? {
          ...item,
          status: 'invited',
          auth_user_id: result.auth_user_id || item.auth_user_id,
          invited_at: result.invited_at || item.invited_at,
        } : item),
      } : current)
      setMessage(`${isResend ? 'Another setup email was sent to' : 'Invitation sent to'} ${membership.person?.email}.`)
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setSavingKey('')
    }
  }

  const openAccountForm = () => {
    resetAccountForm()
    setShowAccountForm(true)
  }

  const headerActions = data ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' }}>
      <Badge variant="info"><ShieldCheck size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />{data.currentRoleKey === 'owner' ? 'Owner' : 'Admin'}</Badge>
      {activeTab === 'people' && <Button onClick={openAccountForm}><Plus size={16} />Add account</Button>}
    </div>
  ) : null

  const content = (
    <>
      {!embedded && (
        <PageHeader
          title="Roles & permissions"
          subtitle="Manage your people, staff accounts, roles, and permissions."
          right={headerActions}
        />
      )}

      {embedded && headerActions && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: spacing.lg }}>{headerActions}</div>
      )}

      {data && (
        <>
          <Tabs
            items={data.canManageRoles
              ? [
                  { key: 'people', label: 'People', count: data.memberships.length },
                  { key: 'roles', label: 'Roles & permissions', count: data.roles.length },
                ]
              : [{ key: 'people', label: 'People', count: data.memberships.length }]}
            activeKey={activeTab}
            onChange={setActiveTab}
            variant="prominent"
            style={{ marginBottom: spacing.lg, maxWidth: data.canManageRoles ? 620 : 310, width: '100%' }}
          />
          <div style={{ marginBottom: spacing['2xl'], color: colors.textSecondary, fontSize: typography.sizeSm }}>
            {activeTab === 'people'
              ? 'Manage the people who work in your organization and review who can sign in.'
              : 'Define roles and choose the permissions granted to each role. The Owner role remains protected.'}
          </div>
        </>
      )}

      {data && (message || error) && (
        <div style={{ marginBottom: spacing.lg, padding: `${spacing.md} ${spacing.lg}`, borderRadius: radius.md, background: error ? '#FEF2F2' : '#F0FDF4', color: error ? colors.error : colors.greenDark, fontSize: typography.sizeBase }}>
          {error || message}
        </div>
      )}

      {loading ? (
        <AccessLoadingState />
      ) : !data ? (
        <AccessErrorState error={error || 'Access settings are unavailable.'} onRetry={fetchAccessData} />
      ) : activeTab === 'people' ? (
        <PeopleAccessPanel
          tenantId={tenantId}
          data={data}
          savingKey={savingKey}
          onRoleChange={saveRoleAssignment}
          onInvitation={sendInvitation}
          onAddAccount={openAccountForm}
        />
      ) : (
        <RolesPanel
          data={data}
          selectedRole={selectedRole}
          selectedRoleId={selectedRoleId}
          draftPermissionIds={draftPermissionIds}
          groupedPermissions={groupedPermissions}
          savingKey={savingKey}
          showRoleForm={showRoleForm}
          newRoleName={newRoleName}
          newRoleDescription={newRoleDescription}
          onSelectRole={setSelectedRoleId}
          onTogglePermission={(permissionId) => setDraftPermissionIds(current => {
            const next = new Set(current)
            if (next.has(permissionId)) next.delete(permissionId)
            else next.add(permissionId)
            return next
          })}
          onSavePermissions={savePermissions}
          onShowRoleForm={setShowRoleForm}
          onNewRoleName={setNewRoleName}
          onNewRoleDescription={setNewRoleDescription}
          onCreateRole={createRole}
        />
      )}

      {data && (
        <SlidePanel isOpen={showAccountForm} onClose={closeAccountForm} width="min(92vw, 520px)">
          <SlidePanelHeader
            title="Add account"
            subtitle="Create an unclaimed staff account without sending an invitation."
            onClose={closeAccountForm}
          />
          <div style={{ flex: 1, overflowY: 'auto', padding: spacing.xl }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm, marginBottom: spacing.xl }}>
              <Button
                type="button"
                variant={accountSource === 'existing' ? 'teal' : 'secondary'}
                disabled={!data.availableStaff.length}
                onClick={() => setAccountSource('existing')}
              >
                Existing staff
              </Button>
              <Button type="button" variant={accountSource === 'new' ? 'teal' : 'secondary'} onClick={() => setAccountSource('new')}>
                New staff
              </Button>
            </div>

            {accountSource === 'existing' ? (
              <Select
                label="Staff member"
                value={accountPersonId}
                onChange={event => setAccountPersonId(event.target.value)}
                hint="Only active staff without an account appear here."
              >
                {data.availableStaff.map(staff => (
                  <option key={staff.person_id} value={staff.person_id}>
                    {`${staff.first_name || ''} ${staff.last_name || ''}`.trim()}
                  </option>
                ))}
              </Select>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
                  <Input label="First name" value={accountFirstName} onChange={event => setAccountFirstName(event.target.value)} maxLength={100} required />
                  <Input label="Last name" value={accountLastName} onChange={event => setAccountLastName(event.target.value)} maxLength={100} required />
                </div>
                <Input label="Email (optional)" type="email" value={accountEmail} onChange={event => setAccountEmail(event.target.value)} maxLength={320} hint="Can be added later before personal account claiming." />
                <Input label="Phone (optional)" type="tel" value={accountPhone} onChange={event => setAccountPhone(event.target.value)} maxLength={40} hint="Not required to create staff access." />
              </div>
            )}

            <div style={{ marginTop: spacing.xl }}>
              <Select label="Role" value={accountRoleId} onChange={event => setAccountRoleId(event.target.value)}>
                {assignableRoles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
              </Select>
            </div>

            <div style={{ marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.md, background: colors.surfaceMuted, color: colors.textSecondary, fontSize: typography.sizeSm, lineHeight: 1.5 }}>
              This creates a staff record and an unclaimed account only. It does not create a Supabase Auth user, send email or SMS, or require an email or phone number.
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm, padding: spacing.lg, borderTop: `1px solid ${colors.borderLight}` }}>
            <Button type="button" variant="ghost" onClick={closeAccountForm}>Cancel</Button>
            <Button
              type="button"
              onClick={createAccount}
              disabled={savingKey === 'new-account'
                || !accountRoleId
                || (accountSource === 'existing' ? !accountPersonId : !accountFirstName.trim() || !accountLastName.trim())}
            >
              <UserPlus size={16} />
              {savingKey === 'new-account' ? 'Adding…' : 'Add account'}
            </Button>
          </div>
        </SlidePanel>
      )}
    </>
  )

  if (embedded) return <div>{content}</div>

  return (
    <PageContainer maxWidth="1180px" style={{ padding: isMobile ? spacing.lg : spacing['3xl'] }}>
      {content}
    </PageContainer>
  )
}

function PeopleAccessPanel({
  tenantId,
  data,
  savingKey,
  onRoleChange,
  onInvitation,
  onAddAccount,
}: {
  tenantId: string
  data: AccessData
  savingKey: string
  onRoleChange: (membership: Membership, roleId: string) => void
  onInvitation: (membership: Membership) => void
  onAddAccount: () => void
}) {
  const memberships = [...data.memberships].sort((left, right) => fullName(left).localeCompare(fullName(right)))

  return (
    <SurfacePanel padding="0" style={{ overflow: 'hidden' }}>
      <div style={{ padding: spacing.xl, borderBottom: `1px solid ${colors.borderLight}` }}>
        <div>
          <h2 style={{ ...typography.h2, margin: 0, color: colors.text }}>People</h2>
          <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: `${spacing.xs} 0 0` }}>
            {data.canManageRoles ? 'Choose one role per staff member. Role changes apply to their next authorized request.' : 'Review staff accounts and access status.'}
          </p>
        </div>
      </div>

      {memberships.length === 0 ? (
        <div style={{ padding: spacing['4xl'], textAlign: 'center' }}>
          <Users size={28} color={colors.textMuted} style={{ marginBottom: spacing.md }} />
          <h3 style={{ ...typography.h2, margin: 0, color: colors.text }}>No staff accounts yet</h3>
          <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: `${spacing.xs} auto ${spacing.lg}`, maxWidth: 440 }}>
            Add an existing staff member or create a new staff record to begin managing account access.
          </p>
          <Button onClick={onAddAccount}><Plus size={16} />Add first account</Button>
        </div>
      ) : <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ background: colors.surfaceMuted }}>
              {['Staff member', 'Account', 'Role', 'Access level', 'Action'].map(label => (
                <th key={label} style={tableHeaderStyle}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {memberships.map(membership => {
              const role = data.roles.find(item => item.id === membership.role_id)
              const isSaving = savingKey === `membership:${membership.id}`
              const isSendingInvitation = savingKey === `invitation:${membership.id}`
              const isCurrentOwner = membership.id === data.currentMembershipId && role?.key === 'owner'
              return (
                <tr key={membership.id} style={{ borderTop: `1px solid ${colors.borderLight}` }}>
                  <td style={tableCellStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                      <Avatar firstName={membership.person?.first_name || ''} lastName={membership.person?.last_name || ''} size={36} src={getStaffAvatarUrl(tenantId, fullName(membership))} />
                      <div>
                        <div style={{ fontWeight: typography.weightSemibold, color: colors.text }}>{fullName(membership)}</div>
                        <div style={{ fontSize: typography.sizeSm, color: colors.textMuted }}>{membership.person?.email || 'No email yet'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={tableCellStyle}>
                    <Badge size="sm" variant={statusVariants[membership.status]}>{statusLabels[membership.status]}</Badge>
                  </td>
                  <td style={{ ...tableCellStyle, width: 230 }}>
                    <Select
                      aria-label={`Role for ${fullName(membership)}`}
                      value={membership.role_id}
                      disabled={isSaving || !data.canManageRoles}
                      onChange={event => onRoleChange(membership, event.target.value)}
                    >
                      {data.roles.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                    </Select>
                    {isCurrentOwner && <div style={{ marginTop: spacing.xs, fontSize: typography.sizeXs, color: colors.textMuted }}>Your role</div>}
                  </td>
                  <td style={tableCellStyle}>
                    <span style={{ color: colors.textSecondary, fontSize: typography.sizeSm }}>
                      {role?.key === 'owner' ? 'Full access' : `${role?.permissionIds.length || 0} permissions`}
                    </span>
                  </td>
                  <td style={{ ...tableCellStyle, width: 130 }}>
                    {membership.status === 'unclaimed' || membership.status === 'invited' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isSendingInvitation || !membership.person?.email}
                        title={membership.person?.email ? undefined : 'Add an email before inviting this staff member.'}
                        onClick={() => onInvitation(membership)}
                      >
                        {isSendingInvitation ? 'Sending…' : membership.status === 'invited' ? 'Resend' : 'Invite'}
                      </Button>
                    ) : <span style={{ color: colors.textMuted, fontSize: typography.sizeSm }}>—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>}
    </SurfacePanel>
  )
}

function AccessLoadingState() {
  return (
    <SurfacePanel aria-busy="true" style={{ display: 'grid', gap: spacing.lg }}>
      <div style={{ width: 180, height: 18, borderRadius: radius.md, background: colors.backgroundSecondary }} />
      <div style={{ width: 'min(100%, 520px)', height: 12, borderRadius: radius.md, background: colors.borderLight }} />
      <div style={{ display: 'grid', gap: spacing.sm, marginTop: spacing.sm }}>
        {[1, 2, 3].map(row => <div key={row} style={{ height: 52, borderRadius: radius.md, background: colors.surfaceMuted }} />)}
      </div>
      <span style={{ color: colors.textMuted, fontSize: typography.sizeSm }}>Loading staff accounts…</span>
    </SurfacePanel>
  )
}

function AccessErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <SurfacePanel style={{ padding: spacing['3xl'], textAlign: 'center' }}>
      <AlertCircle size={30} color={colors.error} style={{ marginBottom: spacing.md }} />
      <h2 style={{ ...typography.h2, margin: 0, color: colors.text }}>Could not load access settings</h2>
      <p role="alert" style={{ ...typography.bodySmall, color: colors.textSecondary, margin: `${spacing.sm} auto ${spacing.lg}`, maxWidth: 560 }}>{error}</p>
      <Button variant="secondary" onClick={onRetry}><RefreshCw size={15} />Try again</Button>
    </SurfacePanel>
  )
}

function RolesPanel({
  data,
  selectedRole,
  selectedRoleId,
  draftPermissionIds,
  groupedPermissions,
  savingKey,
  showRoleForm,
  newRoleName,
  newRoleDescription,
  onSelectRole,
  onTogglePermission,
  onSavePermissions,
  onShowRoleForm,
  onNewRoleName,
  onNewRoleDescription,
  onCreateRole,
}: {
  data: AccessData
  selectedRole: Role | null
  selectedRoleId: string
  draftPermissionIds: Set<string>
  groupedPermissions: Array<[string, Permission[]]>
  savingKey: string
  showRoleForm: boolean
  newRoleName: string
  newRoleDescription: string
  onSelectRole: (roleId: string) => void
  onTogglePermission: (permissionId: string) => void
  onSavePermissions: () => void
  onShowRoleForm: (show: boolean) => void
  onNewRoleName: (name: string) => void
  onNewRoleDescription: (description: string) => void
  onCreateRole: () => void
}) {
  const isMobile = useIsMobile()
  const isOwnerRole = selectedRole?.key === 'owner'
  const hasPermissionChanges = selectedRole
    ? selectedRole.permissionIds.length !== draftPermissionIds.size
      || selectedRole.permissionIds.some(permissionId => !draftPermissionIds.has(permissionId))
    : false

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(220px, 280px) minmax(0, 1fr)', gap: spacing.xl, alignItems: 'start' }}>
      <SurfacePanel padding={spacing.md}>
        <div style={{ padding: `${spacing.sm} ${spacing.sm} ${spacing.md}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <div>
            <div style={{ fontWeight: typography.weightSemibold, color: colors.text }}>Roles</div>
            <div style={{ fontSize: typography.sizeXs, color: colors.textMuted }}>Reusable access levels</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onShowRoleForm(true)} aria-label="Create role"><Plus size={16} /></Button>
        </div>

        {showRoleForm && (
          <div style={{ padding: spacing.md, marginBottom: spacing.sm, borderRadius: radius.md, background: colors.surfaceMuted }}>
            <label style={fieldLabelStyle}>Role name</label>
            <input value={newRoleName} onChange={event => onNewRoleName(event.target.value)} placeholder="e.g. Teacher" style={inputStyle} />
            <label style={{ ...fieldLabelStyle, marginTop: spacing.md }}>Description</label>
            <textarea value={newRoleDescription} onChange={event => onNewRoleDescription(event.target.value)} placeholder="Who should use this role?" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.md }}>
              <Button size="sm" onClick={onCreateRole} disabled={!newRoleName.trim() || savingKey === 'new-role'}>{savingKey === 'new-role' ? 'Creating…' : 'Create role'}</Button>
              <Button size="sm" variant="ghost" onClick={() => onShowRoleForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
          {data.roles.map(role => {
            const selected = role.id === selectedRoleId
            const staffCount = data.memberships.filter(membership => membership.role_id === role.id).length
            return (
              <ControlButton kind="row"
                key={role.id}
                type="button"
                onClick={() => onSelectRole(role.id)}

              >
                <span>
                  <span style={{ display: 'block', fontWeight: selected ? typography.weightSemibold : typography.weightMedium }}>{role.name}</span>
                  <span style={{ display: 'block', fontSize: typography.sizeXs, color: colors.textMuted, marginTop: 2 }}>{staffCount} {staffCount === 1 ? 'person' : 'people'}</span>
                </span>
                {role.key === 'owner' && <LockKeyhole size={15} color={colors.textMuted} />}
              </ControlButton>
            )
          })}
        </div>
      </SurfacePanel>

      <SurfacePanel>
        {selectedRole && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.lg, paddingBottom: spacing.xl, borderBottom: `1px solid ${colors.borderLight}` }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  <h2 style={{ ...typography.h2, margin: 0, color: colors.text }}>{selectedRole.name}</h2>
                  {isOwnerRole && <Badge size="sm" variant="info">Protected</Badge>}
                </div>
                <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: `${spacing.xs} 0 0`, maxWidth: 600 }}>
                  {isOwnerRole
                    ? 'Owners always have full access and are the only people who can manage staff roles and permissions.'
                    : selectedRole.description || 'Choose the capabilities staff with this role should have.'}
                </p>
              </div>
              {!isOwnerRole && (
                <Button onClick={onSavePermissions} disabled={!hasPermissionChanges || savingKey === `role:${selectedRole.id}`}>
                  <Check size={15} />
                  {savingKey === `role:${selectedRole.id}` ? 'Saving…' : 'Save permissions'}
                </Button>
              )}
            </div>

            <div style={{ marginTop: spacing.xl }}>
              {groupedPermissions.map(([group, permissions]) => (
                <div key={group} style={{ padding: `${spacing.lg} 0`, borderBottom: `1px solid ${colors.borderLight}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                    {group === 'accounts' || group === 'roles' ? <ShieldCheck size={17} color={colors.tealDark} /> : <Users size={17} color={colors.textMuted} />}
                    <div style={{ fontWeight: typography.weightSemibold, color: colors.text }}>{permissionGroupLabels[group] || group}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: spacing.sm }}>
                    {permissions.map(permission => {
                      const checked = isOwnerRole || draftPermissionIds.has(permission.id)
                      return (
                        <label key={permission.id} style={{ display: 'flex', gap: spacing.md, padding: spacing.md, border: `1px solid ${checked ? '#B7E2EA' : colors.borderLight}`, borderRadius: radius.md, background: checked ? '#F4FBFC' : colors.surface, cursor: isOwnerRole ? 'default' : 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isOwnerRole}
                            onChange={() => onTogglePermission(permission.id)}
                            style={{ width: 18, height: 18, marginTop: 2, accentColor: colors.teal }}
                          />
                          <span>
                            <span style={{ display: 'block', color: colors.text, fontWeight: typography.weightMedium }}>{permission.key.split('.').slice(1).join(' ')}</span>
                            <span style={{ display: 'block', color: colors.textSecondary, fontSize: typography.sizeSm, lineHeight: 1.45, marginTop: 2 }}>{permission.description}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </SurfacePanel>
    </div>
  )
}

const tableHeaderStyle: React.CSSProperties = {
  padding: `${spacing.md} ${spacing.lg}`,
  textAlign: 'left',
  color: colors.textSecondary,
  fontSize: typography.sizeSm,
  fontWeight: typography.weightSemibold,
  whiteSpace: 'nowrap',
}

const tableCellStyle: React.CSSProperties = {
  padding: `${spacing.md} ${spacing.lg}`,
  color: colors.text,
  fontSize: typography.sizeBase,
  verticalAlign: 'middle',
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: spacing.xs,
  color: colors.text,
  fontSize: typography.sizeSm,
  fontWeight: typography.weightMedium,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  background: colors.surface,
  color: colors.text,
  padding: `${spacing.sm} ${spacing.md}`,
  fontFamily: typography.fontSans,
  fontSize: typography.sizeBase,
  outline: 'none',
}