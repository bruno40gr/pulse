'use client'

import type { ComponentPropsWithRef } from 'react'
import { ButtonBase } from './ButtonBase'
import { colors, radius, spacing, typography } from '@/lib/tokens'

export type ControlKind = 'icon' | 'link' | 'row' | 'tab' | 'navigation' | 'toggle' | 'swatch'

type ControlButtonProps = ComponentPropsWithRef<'button'> & {
  kind: ControlKind
  selected?: boolean
  inverse?: boolean
  /** Semantic swatch color, not an action-button appearance override. */
  swatchColor?: string
}

/** Shared appearances for non-form controls. Keep event semantics at call sites. */
export function ControlButton({ kind, selected = false, inverse = false, swatchColor, style, disabled, ...props }: ControlButtonProps) {
  return (
    <ButtonBase
      {...props}
      disabled={disabled}
      style={{
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
        ...(kind === 'icon' ? { width: 32, height: 32, flexShrink: 0, padding: spacing.xs } : {}),
        ...(kind === 'link' ? { padding: 0, textDecoration: 'underline', textUnderlineOffset: '2px' } : {}),
        ...(kind === 'row' ? { width: '100%', padding: `${spacing.sm} ${spacing.md}`, textAlign: 'left', justifyContent: 'space-between' } : {}),
        ...(kind === 'navigation' ? { width: '100%', padding: `${spacing.sm} ${spacing.md}`, textAlign: 'left', justifyContent: 'flex-start' } : {}),
        ...(kind === 'tab' ? { padding: `${spacing.sm} ${spacing.md}`, border: `1px solid ${selected ? colors.espresso : colors.border}` } : {}),
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
      }}
    />
  )
}