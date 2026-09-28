'use client'
import { ButtonHTMLAttributes, CSSProperties } from 'react'
import { colors, typography, radius, spacing } from '@/lib/tokens'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'teal'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const buttonVariantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: { background: colors.espresso, color: 'white', border: 'none' },
  secondary: { background: 'transparent', color: colors.text, border: `1px solid ${colors.border}` },
  ghost: { background: 'transparent', color: colors.textSecondary, border: 'none' },
  destructive: { background: colors.error, color: 'white', border: 'none' },
  teal: { background: colors.teal, color: 'white', border: 'none' },
}

export const buttonSizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: { padding: `${spacing.xs} ${spacing.sm}`, fontSize: typography.sizeSm },
  md: { padding: `${spacing.sm} ${spacing.lg}`, fontSize: typography.sizeBase },
  lg: { padding: `${spacing.md} ${spacing['2xl']}`, fontSize: typography.sizeMd },
}

export function Button({ variant = 'primary', size = 'md', style, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled}
      style={{
        ...buttonVariantStyles[variant],
        ...buttonSizeStyles[size],
        borderRadius: radius.sm,
        fontFamily: typography.fontSans,
        fontWeight: typography.weightMedium,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        outline: 'none',
        transition: 'opacity 0.15s',
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
}