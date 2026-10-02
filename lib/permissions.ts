export const PERMISSIONS = {
  accountsManage: 'accounts.manage',
  rolesManage: 'roles.manage',
  staffRead: 'staff.read',
  staffManage: 'staff.manage',
  contactsRead: 'contacts.read',
  contactsManage: 'contacts.manage',
  contactsDelete: 'contacts.delete',
  leadsRead: 'leads.read',
  leadsManage: 'leads.manage',
  leadsDelete: 'leads.delete',
  notesRead: 'notes.read',
  notesManage: 'notes.manage',
  communicationsRead: 'communications.read',
  communicationsSend: 'communications.send',
  communicationsConfigure: 'communications.configure',
  tenantSettingsRead: 'tenant_settings.read',
  tenantSettingsManage: 'tenant_settings.manage',
  auditRead: 'audit.read',
  dataMigrationsRun: 'data_migrations.run',
  fundingRead: 'funding.read',
  fundingManage: 'funding.manage',
} as const

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS]

export const PERMISSION_KEYS = Object.values(PERMISSIONS)