'use client'

import { useEffect, useState } from 'react'
import DashboardPage from '@/app/dashboard/page'
import DemoIntroPage from '@/components/demo/DemoIntroPage'
import { setActiveTenantId } from '@/lib/tenant'

export default function DemoExperiencePage({ tenantId }: { tenantId: string }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setActiveTenantId(tenantId)
    setReady(true)
  }, [tenantId])

  if (!ready) return null

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <DashboardPage />
      <DemoIntroPage overlay tenantId={tenantId} />
    </div>
  )
}