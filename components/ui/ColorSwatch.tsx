'use client'

import type { ComponentPropsWithRef } from 'react'
import { ButtonBase } from './ButtonBase'
import { colors } from '@/lib/tokens'

type ColorSwatchProps = Omit<ComponentPropsWithRef<'button'>, 'style' | 'className' | 'children'> & {
  color: string
  selected: boolean
  label: string
}

export function ColorSwatch({ color, selected, label, ...props }: ColorSwatchProps) {
  return <ButtonBase {...props} aria-label={label} aria-pressed={selected} title={label} style={{
    width: 22, height: 22, minWidth: 22, minHeight: 22, flexShrink: 0,
    boxSizing: 'border-box', padding: 0, borderRadius: '50%', background: color,
    border: `2px solid ${selected ? colors.espresso : colors.border}`,
    boxShadow: selected ? `0 0 0 2px ${colors.surface}` : 'none',
    cursor: props.disabled ? 'not-allowed' : 'pointer',
  }} />
}