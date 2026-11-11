export const workAreas = [
  { id: 'operations', label: 'Operations', description: 'Run your day-to-day work', pages: ['Overview', 'Notes', 'Leads', 'Contacts', 'Communications', 'Campaigns', 'Event RSVPs'] },
  { id: 'school', label: 'School Setup', description: 'Build the foundation for your school', pages: ['School details', 'Locations & rooms', 'Plans & pricing', 'Services & programs', 'Teachers', 'Policies', 'Academic calendar', 'Curriculum'] },
  { id: 'funding', label: 'Funding', description: 'Manage programs and funded students', pages: ['Overview', 'Funded students', 'Funding programs'] },
  { id: 'website', label: 'Website', description: 'Create and publish your public content', pages: ['All content', 'Events', 'Deadlines', 'Announcements', 'Articles', 'Community posts'] },
] as const

export type AreaId = typeof workAreas[number]['id']
export type Destination = { area: AreaId | 'settings'; page: string }
export const settingsPages = ['Team & permissions', 'Integrations', 'Billing', 'Security']
export const defaultDestination: Destination = { area: 'operations', page: 'Overview' }

export function destinationHash(destination: Destination) {
  return `#${destination.area}/${encodeURIComponent(destination.page)}`
}

export function parseDestination(hash: string): Destination {
  const [area, encodedPage] = hash.replace(/^#/, '').split('/')
  let page: string
  try { page = decodeURIComponent(encodedPage || '') } catch { return defaultDestination }
  if (area === 'settings' && settingsPages.includes(page)) return { area, page }
  const match = workAreas.find(item => item.id === area)
  if (match && (match.pages as readonly string[]).includes(page)) return { area: match.id, page }
  return defaultDestination
}

export function searchDestinations(query: string): Destination[] {
  const all = [
    ...workAreas.flatMap(area => area.pages.map(page => ({ area: area.id, page }))),
    ...settingsPages.map(page => ({ area: 'settings' as const, page })),
  ]
  const normalized = query.trim().toLowerCase()
  return all.filter(item => `${item.area} ${workAreas.find(area => area.id === item.area)?.label || 'Settings'} ${item.page}`.toLowerCase().includes(normalized))
}