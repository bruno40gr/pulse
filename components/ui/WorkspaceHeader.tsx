'use client'

import { useContext, type ReactNode } from 'react'
import { DialogTitleContext } from '@/lib/useDialogLayer'
import { ControlButton } from '@/components/ui/ControlButton'
import { colors, spacing, typography } from '@/lib/tokens'

export interface WorkspaceCrumb { label: string; onClick?: () => void }

export function WorkspaceBreadcrumbs({ items }: { items: WorkspaceCrumb[] }) {
  return <nav aria-label="Workspace breadcrumbs"><ol style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', padding: 0, margin: 0, listStyle: 'none' }}>
    {items.map((item, index) => <li key={index} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 }}>
      {index > 0 && <span aria-hidden="true" style={{ color: colors.textMuted }}>/</span>}
      {item.onClick ? <ControlButton kind="link" onClick={item.onClick}>{item.label}</ControlButton> : <span aria-current="page" style={{ overflowWrap: 'anywhere' }}>{item.label}</span>}
    </li>)}
  </ol></nav>
}

export function WorkspaceHeader({ title, breadcrumbs, expanded, onTogglePresentation, onClose, children }: {
  title: string
  breadcrumbs: WorkspaceCrumb[]
  expanded: boolean
  onTogglePresentation: () => void
  onClose: () => void
  children?: ReactNode
}) {
  const titleId = useContext(DialogTitleContext)
  return <header style={{ padding: spacing.lg, background: colors.surface, borderBottom: `1px solid ${colors.borderLight}`, flexShrink: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.lg, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: '1 1 200px' }}><WorkspaceBreadcrumbs items={breadcrumbs} /><h1 id={titleId} style={{ ...typography.h2, margin: `${spacing.md} 0 0` }}>{title}</h1></div>
      <div style={{ display: 'flex', gap: spacing.lg, alignItems: 'center' }}>
        <ControlButton kind="link" onClick={onTogglePresentation}>{expanded ? 'Quick view' : 'Expand workspace'}</ControlButton>
        <ControlButton kind="close" aria-label="Close workspace" onClick={onClose} />
      </div>
    </div>
    {children}
  </header>
}