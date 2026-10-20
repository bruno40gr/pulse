'use client'

import type { ComponentPropsWithRef, CSSProperties } from 'react'
import { X } from 'lucide-react'
import { ButtonBase } from './ButtonBase'
import { colors, radius, spacing, typography } from '@/lib/tokens'
import styles from './ControlButton.module.css'

export type ControlKind = 'close' | 'icon' | 'link' | 'row' | 'tab' | 'navigation' | 'toggle' | 'swatch'

type ControlButtonProps = ComponentPropsWithRef<'button'> & {
  kind: ControlKind
  selected?: boolean
  inverse?: boolean
  /** Semantic swatch color, not an action-button appearance override. */
  swatchColor?: string
}

/** Shared appearances for non-form controls. Keep event semantics at call sites. */
export function ControlButton({ kind, selected = false, inverse = false, swatchColor, style, disabled, children, className, ...props }: ControlButtonProps) {
  return (
    <ButtonBase
      {...props}
      className={[styles.control, className].filter(Boolean).join(' ')}
      data-kind={kind}
      disabled={disabled}
      style={{
        '--control-active-background': inverse ? 'rgba(255,255,255,0.08)' : colors.surfaceMuted,
        '--control-active-color': inverse ? colors.surface : colors.text,
        '--control-focus-color': colors.tealDark,
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
        ...(kind === 'link' ? { padding: 0, textDecoration: 'underline', textUnderlineOffset: '2px' } : {}),
        ...(kind === 'row' ? { width: '100%', padding: `${spacing.sm} ${spacing.md}`, textAlign: 'left', justifyContent: 'space-between' } : {}),
        ...(kind === 'navigation' ? { width: '100%', padding: `${spacing.sm} ${spacing.md}`, textAlign: 'left', justifyContent: 'flex-start' } : {}),
        ...(kind === 'tab' ? { padding: `${spacing.sm} ${spacing.md}`, border: `1px solid ${colors.border}` } : {}),
        ...(kind === 'toggle' ? { padding: `${spacing.xs} ${spacing.sm}` } : {}),
        ...(selected && kind !== 'swatch' ? {
          background: inverse ? 'rgba(255,255,255,0.08)' : colors.surfaceMuted,
          color: inverse ? colors.surface : colors.text,
          fontWeight: typography.weightSemibold,
        } : {}),
        ...(kind === 'swatch' ? {
          width: 20, height: 20, padding: 0, borderRadius: '50%', background: swatchColor,
          border: `2px solid ${selected ? colors.espresso : colors.border}`,
        } : {}),
        ...style,
        ...(kind === 'close' ? { width: 48, height: 48, minWidth: 48, minHeight: 48, flexShrink: 0 } : {}),
      } as CSSProperties}
    >
      {kind === 'close' ? <X size={22} strokeWidth={2} aria-hidden="true" /> : children}
    </ButtonBase>
  )
}