'use client'

import type { ComponentPropsWithRef } from 'react'
import { Check } from 'lucide-react'
import { ButtonBase } from './ButtonBase'
import { colors, radius, spacing, typography } from '@/lib/tokens'

type TaskCompletionButtonProps = Omit<ComponentPropsWithRef<'button'>, 'style' | 'className' | 'children'> & {
  completed: boolean
}

export function TaskCompletionButton({ completed, disabled, ...props }: TaskCompletionButtonProps) {
  return <ButtonBase {...props} disabled={disabled} aria-pressed={completed} style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    flexShrink: 0, alignSelf: 'flex-start', minHeight: 32, padding: `${spacing.xs} ${spacing.sm}`,
    borderRadius: radius.sm, border: `1px solid ${colors.green}`, background: completed ? 'rgba(61, 139, 95, 0.12)' : 'transparent',
    color: colors.greenDark, fontFamily: typography.fontSans, fontSize: typography.sizeBase,
    fontWeight: typography.weightSemibold, whiteSpace: 'nowrap', opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }}><Check size={15} aria-hidden="true" />{completed ? 'Done' : 'Mark done'}</ButtonBase>
}