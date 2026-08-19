'use client'
import { useState, useEffect } from 'react'
import { getActiveTenantId } from '@/lib/tenant'
import { colors, typography, spacing } from '@/lib/tokens'

export default function DemoBanner() {
  const [isDemo, setIsDemo] = useState(false)
  const tenantId = getActiveTenantId()

  useEffect(() => {
    fetch(`/api/tenant/sync-status?tenant=${tenantId}`)
      .then(r => r.json())
      .then(data => {
        setIsDemo(data.is_demo ?? false)
      })
      .catch(() => {})
  }, [tenantId])

  if (!isDemo) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing.md,
      background: colors.backgroundSecondary,
      borderBottom: `1px solid ${colors.border}`,
      padding: `${spacing.sm} ${spacing['2xl']}`,
    }}>
      <span style={{
        ...typography.bodySmall,
        color: colors.teal,
      }}>
        Demo mode — messages are simulated and no SMS will be sent.
      </span>
    </div>
  )
}