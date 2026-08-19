'use client'

import { useEffect, useState } from 'react'
import DashboardPage from '@/app/dashboard/page'
import DemoIntroPage from '@/components/demo/DemoIntroPage'
import { TENANT_BRAND, getActiveTenantId, setActiveTenantId } from '@/lib/tenant'

export default function DemoExperiencePage() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (getActiveTenantId() !== TENANT_BRAND.kumon.id) {
      setActiveTenantId(TENANT_BRAND.kumon.id)
    }
    setReady(true)
  }, [])

  if (!ready) return null

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <DashboardPage />
      <DemoIntroPage overlay />
    </div>
  )
}