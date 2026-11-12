export type NavigationAccess = {
  roleKey?: string
  canAccessDesignSystem?: boolean
  canManageIntegrations?: boolean
  canManageBrand?: boolean
  canManageRoles?: boolean
}

export function canAccessBeta(access: NavigationAccess) {
  return access.roleKey === 'owner' || access.roleKey === 'admin'
}

export type WorkAreaId = 'operations' | 'school' | 'funding' | 'website' | 'settings'
export type NavigationLink = { href: string; label: string }
export type WorkArea = { id: WorkAreaId; label: string; description: string; links: NavigationLink[] }

export const websiteViews = [
  { slug: 'events', kind: 'event', label: 'Events', singular: 'event' },
  { slug: 'deadlines', kind: 'deadline', label: 'Deadlines', singular: 'deadline' },
  { slug: 'announcements', kind: 'announcement', label: 'Announcements', singular: 'announcement' },
  { slug: 'articles', kind: 'article', label: 'Articles', singular: 'article' },
] as const
export type WebsiteViewKind = typeof websiteViews[number]['kind']

export function workAreasForAccess(access: NavigationAccess): WorkArea[] {
  return [
    { id: 'operations', label: 'Operations', description: 'Run your day-to-day work', links: [
      { href: '/dashboard', label: 'Overview' },
      { href: '/dashboard/notes', label: 'Notes' },
      { href: '/dashboard/leads', label: 'Leads' },
      { href: '/dashboard/contacts', label: 'Contacts' },
      { href: '/dashboard/inbox', label: 'Communications' },
      { href: '/dashboard/history', label: 'Campaigns' },
      { href: '/dashboard/rsvps', label: 'Event RSVPs' },
    ] },
    { id: 'school', label: 'School Setup', description: 'Manage your school’s teaching team', links: [
      { href: '/dashboard/staff', label: 'Teachers & staff' },
    ] },
    { id: 'funding', label: 'Funding', description: 'Manage funded students and programs', links: [
      { href: '/dashboard/funding/students', label: 'Funded students' },
      { href: '/dashboard/funding/programs', label: 'Funding programs' },
    ] },
    { id: 'website', label: 'Website', description: 'Manage your public content', links: [
      ...(access.canAccessDesignSystem ? [
        { href: '/dashboard/website-content', label: 'All content' },
        ...websiteViews.map(view => ({ href: `/dashboard/website-content/${view.slug}`, label: view.label })),
      ] : []),
      { href: '/dashboard/community', label: 'Community posts' },
    ] },
  ]
}

export function settingsLinks(access: NavigationAccess): NavigationLink[] {
  return [
    { href: '/dashboard/settings', label: 'Account settings' },
    ...(access.canManageIntegrations ? [{ href: '/dashboard/settings/integrations', label: 'Integrations' }] : []),
    ...(access.canManageBrand ? [{ href: '/dashboard/settings/brand', label: 'Brand' }] : []),
    ...(access.canManageRoles ? [
      { href: '/dashboard/settings/roles', label: 'Roles' },
      { href: '/dashboard/settings/permissions', label: 'Permissions' },
    ] : []),
  ]
}

export function workAreaForPath(pathname: string): WorkAreaId {
  if (pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/')) return 'settings'
  if (pathname === '/dashboard/staff' || pathname.startsWith('/dashboard/staff/')) return 'school'
  if (pathname.startsWith('/dashboard/funding/') || pathname === '/dashboard/funded-cases') return 'funding'
  if (pathname === '/dashboard/community' || pathname.startsWith('/dashboard/community/') || pathname === '/dashboard/website-content' || pathname.startsWith('/dashboard/website-content/')) return 'website'
  return 'operations'
}

export function activeNavigationLink(href: string, pathname: string) {
  if (href === '/dashboard' || href === '/dashboard/settings' || href === '/dashboard/website-content') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Memory is scoped by tenant and only points at currently authorized destinations. */
export function rememberedAreaHref(area: WorkArea, saved: string | null) {
  return area.links.some(link => link.href === saved) ? saved! : area.links[0].href
}