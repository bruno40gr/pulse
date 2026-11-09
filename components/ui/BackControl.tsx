'use client'

import { ChevronLeft } from 'lucide-react'
import { ControlButton } from './ControlButton'
import { colors, radius } from '@/lib/tokens'
import styles from './BackControl.module.css'

type BackControlProps = {
  label: string
  showLabel?: boolean
} & ({ onClick: () => void; href?: never } | { href: string; onClick?: never })

/** Navigation only: callers retain ownership of history, drafts, and confirmation. */
export function BackControl({ label, onClick, href, showLabel = false }: BackControlProps) {
  const accessibleLabel = /^Back(?: to\b|$)/i.test(label) ? label : `Back to ${label}`
  const props = {
    className: ['pulse-back-control', styles.control, showLabel ? styles.labeled : ''].filter(Boolean).join(' '),
    'aria-label': accessibleLabel,
    style: { '--back-color': colors.textSecondary, width: showLabel ? undefined : 44, minHeight: 44, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: colors.textSecondary, background: 'transparent', border: 'none', borderRadius: radius.sm, textDecoration: 'none', cursor: 'pointer' },
  } as const
  const icon = <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
  return <span className="pulse-back-wrap" style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
    {href !== undefined ? <a {...props} href={href}>{icon}{showLabel && <span>{label}</span>}</a> : <ControlButton {...props} kind={showLabel ? 'name' : 'icon'} type="button" onClick={onClick}>{icon}{showLabel && <span>{label}</span>}</ControlButton>}
  </span>
}