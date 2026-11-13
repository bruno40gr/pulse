import { colors, spacing, typography } from '@/lib/tokens'

export default function DashboardLoading() {
  return <div role="status" aria-live="polite" style={{ padding: spacing.lg, color: colors.textSecondary, fontFamily: typography.fontSans }}>
    Loading page…
  </div>
}