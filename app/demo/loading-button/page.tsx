'use client'
import { useState } from 'react'
import { LoadingButton, type LoadingFill } from '@/components/ui/LoadingButton'
import { colors, typography, spacing, radius } from '@/lib/tokens'

const VARIATIONS: { fill: LoadingFill; name: string; desc: string }[] = [
  { fill: 1, name: 'Sweep', desc: 'A soft darker band sweeps left → right.' },
  { fill: 2, name: 'Fill', desc: 'A solid darker hue fills left → right, holds, resets.' },
  { fill: 3, name: 'Bottom bar', desc: 'A thin darker bar fills along the bottom edge.' },
  { fill: 4, name: 'Gradient sheen', desc: 'A darker-to-transparent gradient flows across.' },
  { fill: 5, name: 'Stripes', desc: 'Diagonal darker stripes march across.' },
]

export default function LoadingButtonDemoPage() {
  const [loading, setLoading] = useState(true)

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: spacing['3xl'], background: colors.background, minHeight: '100vh' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: colors.text, margin: 0 }}>Loading button — 5 variations</h1>
      <p style={{ color: colors.textSecondary, fontSize: typography.sizeBase, margin: `${spacing.xs} 0 ${spacing['2xl']}`, lineHeight: 1.5 }}>
        Same element, no spinner — a darker hue fills the button from left to right while sending.
      </p>

      <button
        onClick={() => setLoading(v => !v)}
        style={{
          background: colors.espresso,
          color: 'white',
          border: 'none',
          borderRadius: radius.sm,
          padding: `${spacing.sm} ${spacing.lg}`,
          fontSize: typography.sizeSm,
          fontFamily: typography.fontSans,
          cursor: 'pointer',
          marginBottom: spacing['2xl'],
        }}
      >
        {loading ? 'Stop (show idle)' : 'Play (show loading)'}
      </button>

      {VARIATIONS.map(v => (
        <div
          key={v.fill}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.xl,
            padding: `${spacing.lg} 0`,
            borderBottom: `1px solid ${colors.borderLight}`,
          }}
        >
          <div style={{ width: 220, flexShrink: 0 }}>
            <LoadingButton loading={loading} fill={v.fill} style={{ width: '100%' }}>
              {loading ? 'Sending…' : 'Send message'}
            </LoadingButton>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: colors.text, fontFamily: typography.fontSans, fontSize: typography.sizeMd }}>
              {v.fill}. {v.name}
            </div>
            <div style={{ fontSize: typography.sizeSm, color: colors.textSecondary, fontFamily: typography.fontSans, marginTop: 2 }}>
              {v.desc}
            </div>
          </div>
        </div>
      ))}
    </main>
  )
}
