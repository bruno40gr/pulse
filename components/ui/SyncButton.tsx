'use client'

import { RefreshCw } from 'lucide-react'
import { Button } from './Button'

interface SyncButtonProps {
  syncing: boolean
  onClick: () => void
  label?: string
  syncingLabel?: string
  disabled?: boolean
  title?: string
}

/** Shared source-agnostic refresh action for page headers. */
export function SyncButton({ syncing, onClick, label = 'Sync', syncingLabel = 'Syncing…', disabled, title }: SyncButtonProps) {
  return (
    <Button type="button" variant="secondary" onClick={onClick} disabled={syncing || disabled} aria-busy={syncing} title={title}>
      <RefreshCw size={14} aria-hidden="true" style={{ animation: syncing ? 'spin 0.8s linear infinite' : 'none' }} />
      {syncing ? syncingLabel : label}
    </Button>
  )
}