'use client'

import type { ComponentPropsWithRef, CSSProperties } from 'react'
import { X } from 'lucide-react'
import { ButtonBase } from './ButtonBase'
import { interaction, colors, radius, spacing, typography } from '@/lib/tokens'
import styles from './ControlButton.module.css'

export type ControlKind = 'close' | 'icon' | 'link' | 'name' | 'row' | 'tab' | 'navigation' | 'toggle' | 'swatch' | 'block' | 'card' | 'slot' | 'subtle'

type ControlButtonProps = ComponentPropsWithRef<'button'> & {
  kind: ControlKind
  selected?: boolean
  inverse?: boolean
  /** Semantic swatch color, not an action-button appearance override. */
  swatchColor?: string
  /** Calendar-style slot appearance; open slots stay visibly tentative. */
  slotState?: 'booked' | 'open'
}

/** Shared appearances for non-form controls. Keep event semantics at call sites. */
export function ControlButton({ kind, selected = false, inverse = false, swatchColor, slotState, style, disabled, children, className, ...props }: ControlButtonProps) {
  return (
    <ButtonBase
      {...props}
      className={[styles.control, className].filter(Boolean).join(' ')}
      data-kind={kind}
      data-slot={slotState}
      disabled={disabled}
      style={{
        '--control-active-background': inverse ? 'rgba(255,255,255,0.08)' : colors.surfaceMuted,
        '--control-active-color': inverse ? colors.surface : colors.text,
        '--control-focus-color': interaction.focus,
        fontFamily: typography.fontSans,
        fontSize: typography.sizeBase,
        fontWeight: typography.weightMedium,
        color: inverse ? '#B8B8B8' : colors.textSecondary,
        background: 'transparent',
        border: 'none',
        borderRadius: radius.sm,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        ...(kind === 'icon' || kind === 'close' ? { width: 32, height: 32, flexShrink: 0, padding: spacing.xs } : {}),
        ...(kind === 'link' ? { padding: 0, color: colors.link, textDecoration: 'none' } : {}),
        ...(kind === 'name' ? { padding: 0, color: colors.text, textDecoration: 'none' } : {}),
        ...(kind === 'row' ? { width: '100%', padding: `${spacing.sm} ${spacing.md}`, textAlign: 'left', justifyContent: 'space-between' } : {}),
        ...(kind === 'navigation' ? { width: '100%', padding: `${spacing.sm} ${spacing.md}`, textAlign: 'left', justifyContent: 'flex-start' } : {}),
        ...(kind === 'tab' ? { padding: `${spacing.sm} ${spacing.md}`, border: `1px solid ${colors.border}` } : {}),
        ...(kind === 'toggle' ? { padding: `${spacing.xs} ${spacing.sm}` } : {}),
        ...(kind === 'block' ? { display: 'block', width: '100%', padding: spacing['2xl'], textAlign: 'left', borderRadius: 0, borderBottom: `1px solid ${colors.borderLight}` } : {}),
        ...(kind === 'card' ? { display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr)', gap: `${spacing.xs} ${spacing.lg}`, width: '100%', padding: `${spacing['2xl']} ${spacing.lg}`, textAlign: 'left', border: `1px solid ${colors.border}`, borderRadius: radius.lg, background: colors.surface, color: colors.text } : {}),
        ...(kind === 'subtle' ? { display: 'flex', justifyContent: 'space-between', width: '100%', minWidth: 0, padding: `${spacing.xs} ${spacing.xs}`, textAlign: 'left', fontFamily: typography.fontSans, fontWeight: typography.weightSemibold, fontSize: typography.sizeBase, color: colors.text } : {}),
        ...(kind === 'slot' ? {
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 2,
          width: '100%', height: '100%', padding: spacing.xs, overflow: 'hidden',
          border: `1px solid ${colors.border}`, borderRadius: radius.sm,
          background: colors.surfaceMuted, color: colors.text,
          fontFamily: typography.fontSans, fontSize: typography.sizeXs, lineHeight: 1.25, textAlign: 'left',
          ...(slotState === 'open' ? { background: 'transparent', borderStyle: 'dashed', color: colors.textSecondary } : {}),
        } : {}),
        ...(selected && kind !== 'swatch' ? {
          background: inverse ? 'rgba(255,255,255,0.08)' : interaction.selectedSurface,
          color: inverse ? colors.surface : interaction.selectedText,
          fontWeight: typography.weightSemibold,
        } : {}),
        ...(kind === 'swatch' ? {
          width: 20, height: 20, padding: 0, borderRadius: '50%', background: swatchColor,
          border: `2px solid ${selected ? interaction.selected : colors.border}`,
        } : {}),
        ...style,
        ...(kind === 'link' ? { color: colors.link, textDecoration: 'none' } : {}),
        ...(kind === 'close' ? { width: 48, height: 48, minWidth: 48, minHeight: 48, flexShrink: 0 } : {}),
      } as CSSProperties}
    >
      {kind === 'close' ? <X size={22} strokeWidth={2} aria-hidden="true" /> : children}
    </ButtonBase>
  )
}