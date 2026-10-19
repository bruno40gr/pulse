'use client'

import { colors, radius, spacing } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'

/** Shared loading geometry for contact and lead profile drawers. */
export function ProfilePanelSkeleton() {
  const mobile = useIsMobile()
  const block = { borderRadius: radius.lg, background: colors.borderLight }
  return <div role="status" aria-label="Loading profile" aria-busy="true" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: spacing.xl }}>
    <div aria-hidden="true">
      <div style={{ ...block, width: '48%', height: 28, marginBottom: spacing.xl }} />
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: spacing.xl }}>
        {[0, 1].map(column => <div key={column} style={{ display: 'grid', gap: spacing.lg }}>
          {[120, 220, 160].map((height, index) => <div key={index} style={{ ...block, height }} />)}
        </div>)}
      </div>
    </div>
  </div>
}