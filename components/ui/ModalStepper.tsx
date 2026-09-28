'use client'

import { Check } from 'lucide-react'
import { colors, radius, spacing, typography } from '@/lib/tokens'

interface ModalStepperProps {
  steps: string[]
  currentStep: number
  compact?: boolean
}

export function ModalStepper({ steps, currentStep, compact = false }: ModalStepperProps) {
  const safeStep = Math.max(0, Math.min(currentStep, steps.length - 1))

  if (compact) {
    return (
      <div aria-label={`Step ${safeStep + 1} of ${steps.length}: ${steps[safeStep]}`} style={{ display: 'grid', gap: spacing.sm }}>
        <span style={{ fontSize: typography.sizeSm, color: colors.textSecondary }}>Step {safeStep + 1} of {steps.length} · {steps[safeStep]}</span>
        <div style={{ height: 4, borderRadius: radius.full, background: colors.borderLight, overflow: 'hidden' }}>
          <div style={{ width: `${((safeStep + 1) / steps.length) * 100}%`, height: '100%', background: colors.crimson }} />
        </div>
      </div>
    )
  }

  return (
    <ol aria-label="Progress" style={{ display: 'grid', gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`, gap: spacing.xs, listStyle: 'none', padding: 0, margin: 0 }}>
      {steps.map((step, index) => {
        const complete = index < safeStep
        const active = index === safeStep
        return (
          <li key={step} aria-current={active ? 'step' : undefined} style={{ display: 'grid', gap: spacing.xs, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ width: 24, height: 24, flexShrink: 0, borderRadius: radius.full, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: complete || active ? colors.crimson : colors.surface, color: complete || active ? colors.surface : colors.textMuted, border: `1px solid ${complete || active ? colors.crimson : colors.border}`, fontSize: typography.sizeXs, fontWeight: typography.weightSemibold }}>
                {complete ? <Check size={13} aria-hidden="true" /> : index + 1}
              </span>
              {index < steps.length - 1 && <span style={{ height: 1, flex: 1, background: complete ? colors.crimson : colors.border, marginInline: spacing.xs }} />}
            </div>
            <span style={{ color: active ? colors.text : colors.textSecondary, fontSize: typography.sizeXs, fontWeight: active ? typography.weightSemibold : typography.weightNormal, overflowWrap: 'anywhere' }}>{step}</span>
          </li>
        )
      })}
    </ol>
  )
}