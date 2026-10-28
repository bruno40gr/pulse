'use client'

import type { ComponentPropsWithoutRef } from 'react'
import { ControlButton } from './ControlButton'
import { colors, typography } from '@/lib/tokens'

const nameStyle = {
  fontFamily: typography.fontSans,
  fontSize: typography.size15,
  fontWeight: typography.weightBold,
  color: colors.text,
  textDecoration: 'none',
  minWidth: 0,
  overflowWrap: 'anywhere' as const,
}

type PersonNameProps = { weight?: 'normal' | 'medium' | 'semibold' | 'bold' } & (
  | ({ as?: 'span' } & ComponentPropsWithoutRef<'span'>)
  | ({ as: 'button' } & ComponentPropsWithoutRef<'button'>)
)

/** One name appearance for every people table; button mode preserves native action semantics. */
export function PersonName(props: PersonNameProps) {
  if (props.as === 'button') {
    const { as: element, style, weight = 'bold', type = 'button', ...buttonProps } = props
    return <ControlButton kind="name" {...buttonProps} type={type} style={{ ...style, ...nameStyle, fontWeight: nameWeights[weight] }} data-person-name={element} />
  }
  const { as: element = 'span', style, weight = 'bold', ...spanProps } = props
  return <span {...spanProps} style={{ ...style, ...nameStyle, fontWeight: nameWeights[weight] }} data-person-name={element} />
}

const nameWeights = { normal: typography.weightNormal, medium: typography.weightMedium, semibold: typography.weightSemibold, bold: typography.weightBold }