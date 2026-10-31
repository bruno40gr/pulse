'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button, Select } from '@/components/ui'
import { colors, radius, spacing, typography } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'
import { defaultLeadTablePreferences, leadTablePreferenceKey, normalizeLeadTablePreferences, type LeadTablePreferences } from '@/lib/lead-table-preferences'

export function useLeadTablePreferences() {
  const [preferences, setPreferences] = useState(defaultLeadTablePreferences)
  const [storageKey, setStorageKey] = useState<string | null>(null)
  const changed = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    const tenant = getActiveTenantId()
    const timeout = window.setTimeout(() => controller.abort(), 10000)
    void fetch(`/api/account/me?tenant=${encodeURIComponent(tenant)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) return
        const data = await response.json()
        if (controller.signal.aborted || typeof data.membershipId !== 'string' || data.tenantId !== tenant) return
        const key = leadTablePreferenceKey(tenant, data.membershipId)
        try {
          const stored = window.localStorage.getItem(key)
          if (stored && !changed.current) setPreferences(normalizeLeadTablePreferences(JSON.parse(stored)))
        } catch { /* Keep defaults if storage is unavailable or malformed. */ }
        setStorageKey(key)
      }).catch(() => { /* Preferences still work for this visit without verified identity. */ })
      .finally(() => window.clearTimeout(timeout))
    return () => { controller.abort(); window.clearTimeout(timeout) }
  }, [])

  function updatePreferences(next: LeadTablePreferences) {
    changed.current = true
    setPreferences(next)
    if (storageKey) {
      try { window.localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* Session-only fallback. */ }
    }
  }
  return { preferences, updatePreferences }
}

export function LeadTableControls({ columns, preferences, onChange }: {
  columns: { id: string; label: string }[]
  preferences: LeadTablePreferences
  onChange: (next: LeadTablePreferences) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  return (
    <div ref={root} style={{ marginLeft: 'auto', position: 'relative' }} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }} onKeyDown={event => {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }}>
      <Button ref={trigger} type="button" variant="secondary" size="toolbar" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>Columns & spacing <ChevronDown size={16} aria-hidden="true" /></Button>
      {open && <div id={panelId} role="group" aria-label="Table display options" style={{ position: 'absolute', right: 0, top: '100%', marginTop: spacing.xs, zIndex: 10, width: 'min(300px, calc(100vw - 48px))', maxHeight: '65vh', overflowY: 'auto', padding: spacing.md, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.sm, fontFamily: typography.fontSans, fontSize: typography.sizeBase }}>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>Visible columns</legend>
          {columns.map(column => <label key={column.id} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minHeight: 36 }}>
            <input type="checkbox" checked={preferences.columns.includes(column.id as LeadTablePreferences['columns'][number])} disabled={column.id === 'name'} onChange={event => onChange(normalizeLeadTablePreferences({ ...preferences, columns: event.target.checked ? [...preferences.columns, column.id] : preferences.columns.filter(id => id !== column.id) }))} />
            {column.label}{column.id === 'name' ? ' (required)' : ''}
          </label>)}
        </fieldset>
        <label htmlFor={`${panelId}-spacing`} style={typography.label}>Row spacing</label>
        <Select id={`${panelId}-spacing`} value={preferences.density} onChange={event => onChange({ ...preferences, density: event.target.value === 'compact' ? 'compact' : 'comfortable' })}>
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </Select>
      </div>}
    </div>
  )
}