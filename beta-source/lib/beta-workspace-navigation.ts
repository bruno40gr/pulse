export const betaWorkflowScreens = ['opportunities', 'book', 'groups', 'events', 'setup'] as const
export type BetaWorkflowScreen = typeof betaWorkflowScreens[number]
export type BetaScreen = 'contacts' | 'staff' | 'teacher' | 'parent' | 'calendar' | BetaWorkflowScreen

export const betaNavigation: { screen: BetaScreen; label: string; href: string }[] = [
  { screen: 'calendar', label: 'Calendar', href: '/odeon-demo?screen=calendar' },
  { screen: 'contacts', label: 'Contacts', href: '/odeon-demo' },
  { screen: 'opportunities', label: 'Opportunities', href: '/odeon-demo?screen=opportunities' },
  { screen: 'book', label: 'Enroll & Book', href: '/odeon-demo?screen=book' },
  { screen: 'groups', label: 'Bands & ensembles', href: '/odeon-demo?screen=groups' },
  { screen: 'events', label: 'Events', href: '/odeon-demo?screen=events' },
  { screen: 'staff', label: 'Staff', href: '/odeon-demo?screen=staff' },
]

export function betaScreen(screen: string | null, view: string | null): BetaScreen {
  if (view === 'parent') return 'parent'
  if (screen === 'teacher') return 'teacher'
  if (screen === 'staff') return 'staff'
  if (screen === 'calendar') return 'calendar'
  return betaWorkflowScreens.includes(screen as BetaWorkflowScreen) ? screen as BetaWorkflowScreen : 'contacts'
}