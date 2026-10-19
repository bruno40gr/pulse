'use client'

import { useId } from 'react'
import { ChevronLeft } from 'lucide-react'
import { ControlButton } from './ControlButton'
import { colors, radius, typography } from '@/lib/tokens'

type BackControlProps = {
  label: string
} & ({ onClick: () => void; href?: never } | { href: string; onClick?: never })

/** Navigation only: callers retain ownership of history, drafts, and confirmation. */
export function BackControl({ label, onClick, href }: BackControlProps) {
  const tooltipId = useId()
  const accessibleLabel = /^Back(?: to\b|$)/i.test(label) ? label : `Back to ${label}`
  const props = {
    className: 'pulse-back-control',
    'aria-label': accessibleLabel,
    'aria-describedby': tooltipId,
    style: { width: 44, height: 44, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: colors.textSecondary, background: 'transparent', border: 'none', borderRadius: radius.sm },
  } as const
  const icon = <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
  return <span className="pulse-back-wrap" style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
    {href !== undefined ? <a {...props} href={href}>{icon}</a> : <ControlButton {...props} kind="icon" type="button" onClick={onClick}>{icon}</ControlButton>}
    <span id={tooltipId} role="tooltip" className="pulse-back-tooltip" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: colors.espresso, color: colors.surface, borderRadius: radius.sm, padding: '6px 10px', fontSize: typography.sizeSm, fontFamily: typography.fontSans, maxWidth: 'min(260px, 70vw)', width: 'max-content', pointerEvents: 'none' }}>{accessibleLabel}</span>
    <style>{`.pulse-back-tooltip{visibility:hidden;opacity:0}.pulse-back-wrap:hover>.pulse-back-tooltip,.pulse-back-wrap:focus-within>.pulse-back-tooltip{visibility:visible;opacity:1}.pulse-back-control:focus-visible{outline:2px solid #0090AA;outline-offset:2px}`}</style>
  </span>
}