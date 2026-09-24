import { cookies } from 'next/headers'
import DashboardLayout from '@/app/dashboard/layout'
import DemoExperiencePage from '@/components/demo/DemoExperiencePage'
import GatePage from '@/components/demo/GatePage'
import { ACCESS_COOKIE_NAME, getAccessScope, readAccessSession } from '@/lib/access'

export default async function DemoPage() {
  const cookieStore = await cookies()
  const session = await readAccessSession(cookieStore.get(ACCESS_COOKIE_NAME)?.value)
  const scope = getAccessScope(session?.actor)

  if (scope.kind === 'demo') {
    return (
      <DashboardLayout>
        <DemoExperiencePage tenantId={scope.tenantId} />
      </DashboardLayout>
    )
  }

  return <GatePage />
}
