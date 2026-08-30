import DemoBanner from '@/components/ui/DemoBanner'
import { colors, typography } from '@/lib/tokens'

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: colors.background, color: colors.text, fontFamily: typography.fontSans }}>
      <DemoBanner />
      {children}
    </div>
  )
}
