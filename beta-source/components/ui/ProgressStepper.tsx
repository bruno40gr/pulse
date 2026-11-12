'use client'

import { useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { colors, radius, spacing, typography } from '@/beta-source/lib/tokens'
import styles from './ProgressStepper.module.css'

export type ProgressStep = { id: string; label: string; complete: boolean }

/** Compact, read-only progress. The caller owns validation and navigation. */
export function ProgressStepper({ steps, currentStep, label, notStarted = false }: {
  steps: readonly ProgressStep[]
  currentStep: number
  label: string
  notStarted?: boolean
}) {
  const tooltipId = useId()
  const [tooltip, setTooltip] = useState<{ index: number; left: number; top: number } | null>(null)
  function showTooltip(index: number, element: HTMLElement) {
    const rect = element.getBoundingClientRect()
    setTooltip({ index, left: Math.max(120, Math.min(window.innerWidth - 120, rect.left + rect.width / 2)), top: rect.bottom })
  }
  const complete = steps.length > 0 && steps.every(step => step.complete)
  const current = Math.max(0, Math.min(currentStep, steps.length - 1))
  const description = notStarted ? 'Not started' : complete ? 'Ready for review' : `${current + 1} of ${steps.length} · ${steps[current]?.label || ''}`
  return <div role="group" aria-label={`${label}: ${description}`} style={{ display: 'flex', minWidth: 0 }}>
    <ol style={{ display: 'flex', alignItems: 'center', listStyle: 'none', padding: 0, margin: 0 }}>
      {steps.map((step, index) => {
        const active = !notStarted && !complete && index === current
        return <li key={step.id} aria-current={active ? 'step' : undefined} aria-label={`${step.label}: ${step.complete ? 'complete' : active ? 'current' : 'incomplete'}`} style={{ display: 'flex', alignItems: 'center' }}>
          {index > 0 && <span aria-hidden="true" style={{ width: spacing.xl, height: 1, background: steps[index - 1].complete ? colors.teal : colors.border }} />}
          <span tabIndex={0} aria-label={`Step ${index + 1}: ${step.label}`} aria-describedby={tooltip?.index === index ? tooltipId : undefined} onMouseEnter={event => showTooltip(index, event.currentTarget)} onMouseLeave={() => setTooltip(null)} onFocus={event => showTooltip(index, event.currentTarget)} onBlur={() => setTooltip(null)} onKeyDown={event => { if (event.key === 'Escape') setTooltip(null) }} className={styles.circle} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: spacing.xl, height: spacing.xl, borderRadius: radius.full, border: `1px solid ${step.complete || active ? colors.teal : colors.border}`, background: step.complete ? colors.teal : colors.surface, color: step.complete ? colors.surface : active ? colors.teal : colors.textMuted, fontSize: typography.sizeXs, fontWeight: typography.weightBold }}>
            {step.complete ? <Check size={12} aria-hidden="true" /> : index + 1}
          </span>
        </li>
      })}
    </ol>
    {tooltip && createPortal(<span id={tooltipId} role="tooltip" style={{ position: 'fixed', top: tooltip.top, left: tooltip.left, transform: 'translateX(-50%)', marginTop: spacing.sm, zIndex: 100, background: colors.espresso, color: colors.surface, borderRadius: radius.sm, padding: `${spacing.xs} ${spacing.sm}`, maxWidth: 'calc(100vw - 16px)', width: 'max-content', fontFamily: typography.fontSans, fontSize: typography.sizeSm, fontWeight: typography.weightNormal, pointerEvents: 'none' }}>{steps[tooltip.index].label}</span>, document.body)}
  </div>
}