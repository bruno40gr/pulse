'use client'
import { ButtonHTMLAttributes } from 'react'
import { colors, typography, radius, spacing } from '@/lib/tokens'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'teal'
  size?: 'sm' | 'md' | 'lg'
}

const variantStyles: Record<string, React.CSSProperties> = {
  primary: { background: colors.crimson, color: 'white', border: 'none' },
  secondary: { background: 'transparent', color: colors.text, border: `1px solid ${colors.border}` },
  ghost: { background: 'transparent', color: colors.textSecondary, border: 'none' },
  destructive: { background: colors.error, color: 'white', border: 'none' },
  teal: { background: colors.teal, color: 'white', border: 'none' },
}

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { padding: `${spacing.xs} ${spacing.sm}`, fontSize: typography.sizeSm },
  md: { padding: `${spacing.sm} ${spacing.lg}`, fontSize: typography.sizeBase },
  lg: { padding: `${spacing.md} ${spacing['2xl']}`, fontSize: typography.sizeMd },
}

export function Button({ variant = 'primary', size = 'md', style, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled}
      style={{
        ...variantStyles[variant],
        ...sizeStyles[size],
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