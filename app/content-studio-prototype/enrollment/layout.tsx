import DashboardLayout from '@/app/dashboard/layout'

/** Keep prototype access/navigation unchanged while using the real app shell. */
export default function EnrollmentLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>
}