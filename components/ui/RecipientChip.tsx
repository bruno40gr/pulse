'use client'

import { X } from 'lucide-react'
import { Badge } from './Badge'
import { ControlButton } from './ControlButton'
import { colors } from '@/lib/tokens'

/** Compact removable recipient badge, shared by email and text recipient pickers. */
export function RecipientChip({ name, removeLabel, onRemove }: { name: string; removeLabel: string; onRemove: () => void }) {
  return <Badge size="sm" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, minWidth: 0, gap: 4, maxWidth: '100%', padding: '0 4px 0 10px', background: colors.backgroundSecondary, color: colors.text }}>
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    <ControlButton kind="icon" aria-label={removeLabel} onClick={onRemove} style={{ flexShrink: 0, width: 28, height: 28, padding: 4, color: colors.textSecondary }}><X size={13} aria-hidden="true" /></ControlButton>
  </Badge>
}