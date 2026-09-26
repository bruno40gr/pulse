'use client'

import type { CSSProperties, ReactNode } from 'react'
import { spacing } from '@/lib/tokens'
import { SurfacePanel } from './SurfacePanel'
import { SectionTitle } from './SectionTitle'

interface DenseSectionPanelProps {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  style?: CSSProperties
  contentStyle?: CSSProperties
  tone?: 'default' | 'muted' | 'warm'
}

export function DenseSectionPanel({ title, actions, children, style, contentStyle, tone = 'default' }: DenseSectionPanelProps) {
  return (
    <SurfacePanel tone={tone} padding={spacing.lg} style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, ...style }}>
      {(title || actions) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap', minWidth: 0 }}>
          {typeof title === 'string' ? <SectionTitle style={{ marginBottom: 0 }}>{title}</SectionTitle> : title}
          {actions}
        </div>
      )}
      <div style={{ minWidth: 0, ...contentStyle }}>{children}</div>
    </SurfacePanel>
  )
}