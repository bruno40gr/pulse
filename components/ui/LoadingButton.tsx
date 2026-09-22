'use client'
import { ButtonHTMLAttributes } from 'react'
import { colors, typography, radius, spacing } from '@/lib/tokens'

export type LoadingFill = 1 | 2 | 3 | 4 | 5

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  fill?: LoadingFill
}

const fillClasses: Record<LoadingFill, string> = {
  1: 'lb-fill lb-fill-sweep',
  2: 'lb-fill lb-fill-wipe',
  3: 'lb-fill lb-fill-bar',
  4: 'lb-fill lb-fill-gradient',
  5: 'lb-fill lb-fill-stripes',
}

export function LoadingButton({
  loading = false,
  fill = 1,
  children,
  style,
  disabled,
  ...props
}: LoadingButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: colors.crimson,
        color: 'white',
        border: 'none',
        borderRadius: radius.sm,
        fontFamily: typography.fontSans,
        fontWeight: typography.weightMedium,
        padding: `${spacing.md} ${spacing['2xl']}`,
        fontSize: typography.sizeMd,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
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
      {loading && <span className={fillClasses[fill]} aria-hidden />}
      <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
    </button>
  )
}
