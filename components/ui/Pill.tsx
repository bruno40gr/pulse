'use client'
import { colors, typography, radius, spacing } from '@/lib/tokens'

interface PillProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  disabled?: string[]
  style?: React.CSSProperties
}

export function Pill({ options, value, onChange, disabled = [], style }: PillProps) {
  return (
    <div style={{ display: 'flex', gap: spacing.sm, ...style }}>
      {options.map((option) => {
        const isDisabled = disabled.includes(option.value)
        const isSelected = value === option.value
        return (
          <button
            key={option.value}
            onClick={() => !isDisabled && onChange(option.value)}
            disabled={isDisabled}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: radius.md,
              border: `1px solid ${isSelected ? colors.espresso : colors.border}`,
              background: isSelected ? colors.espresso : colors.surface,
              color: isSelected ? 'white' : isDisabled ? colors.textMuted : colors.text,
              fontSize: typography.sizeBase,
              fontWeight: typography.weightMedium,
              fontFamily: typography.fontSans,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.5 : 1,
              outline: 'none',
              transition: 'all 0.15s',
              lineHeight: 1.2,
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}