import DashboardShell from './DashboardShell'

/** Route layout stays prop-free; the sandbox renders DashboardShell directly. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
