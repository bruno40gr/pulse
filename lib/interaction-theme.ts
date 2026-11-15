import type { CSSProperties } from 'react'
import { calendarStudentPalette, colors, interaction } from './tokens'

/** CSS and native controls use the same role values as React components. */
export const interactionVariables = Object.fromEntries(
  [...Object.entries(interaction).map(([role, value]) => [`--interaction-${role}`, value]),
    ['--calendar-student-surface', calendarStudentPalette[0].surface],
    ['--calendar-student-border', calendarStudentPalette[0].border],
    ['--calendar-student-text', calendarStudentPalette[0].text],
    ['--calendar-neutral-surface', colors.surfaceMuted],
    ['--calendar-neutral-border', colors.textMuted],
    ['--calendar-neutral-text', colors.text],
    ['--calendar-neutral-strong', colors.textSecondary]],
) as CSSProperties