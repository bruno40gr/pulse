'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button, Select } from '@/components/ui'
import { colors, radius, spacing, typography } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'
import { normalizeTablePreferences, tablePreferenceKey, type TablePreferences, type TablePreferenceSchema } from '@/lib/table-preferences'

export function useTablePreferences(schema: TablePreferenceSchema) {
  const [preferences, setPreferences] = useState(() => normalizeTablePreferences(null, schema))
  const [storageKey, setStorageKey] = useState<string | null>(null)
  const changed = useRef(false)
  const latestPreferences = useRef(preferences)
  useEffect(() => {
    const controller = new AbortController()
    const tenant = getActiveTenantId()
    const timeout = window.setTimeout(() => controller.abort(), 10000)
    void fetch(`/api/account/me?tenant=${encodeURIComponent(tenant)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) return
        const data = await response.json()
        if (controller.signal.aborted || typeof data.membershipId !== 'string' || data.tenantId !== tenant) return
        const key = tablePreferenceKey(schema, tenant, data.membershipId)
        try {
          const stored = window.localStorage.getItem(key)
          if (changed.current) window.localStorage.setItem(key, JSON.stringify(latestPreferences.current))
          else if (stored) {
            const restored = normalizeTablePreferences(JSON.parse(stored), schema)
            latestPreferences.current = restored
            setPreferences(restored)
          }
        } catch { /* Keep defaults if storage is unavailable or malformed. */ }
        setStorageKey(key)
      }).catch(() => { /* Preferences still work for this visit without verified identity. */ })
      .finally(() => window.clearTimeout(timeout))
    return () => { controller.abort(); window.clearTimeout(timeout) }
  }, [schema])

  function updatePreferences(next: TablePreferences) {
    next = normalizeTablePreferences(next, schema)
    changed.current = true
    latestPreferences.current = next
    setPreferences(next)
    if (storageKey) {
      try { window.localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* Session-only fallback. */ }
    }
  }
  return { preferences, updatePreferences }
}

export function TableDisplayControls({ columns, schema, preferences, onChange, label = 'Columns & spacing' }: {
  label?: string
  columns: { id: string; label: string }[]
  schema: TablePreferenceSchema
  preferences: TablePreferences
  onChange: (next: TablePreferences) => void
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
      <Button ref={trigger} type="button" variant="secondary" size="toolbar" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>{label} <ChevronDown size={16} aria-hidden="true" /></Button>
      {open && <div id={panelId} role="group" aria-label="Table display options" style={{ position: 'absolute', right: 0, top: '100%', marginTop: spacing.xs, zIndex: 10, width: 'min(300px, calc(100vw - 48px))', maxHeight: '65vh', overflowY: 'auto', padding: spacing.md, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.sm, fontFamily: typography.fontSans, fontSize: typography.sizeBase }}>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>Visible columns</legend>
          {columns.map(column => <label key={column.id} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minHeight: 36 }}>
            <input type="checkbox" checked={preferences.columns.includes(column.id)} disabled={schema.requiredColumns.includes(column.id)} onChange={event => onChange(normalizeTablePreferences({ ...preferences, columns: event.target.checked ? [...preferences.columns, column.id] : preferences.columns.filter(id => id !== column.id) }, schema))} />
            {column.label}{schema.requiredColumns.includes(column.id) ? ' (required)' : ''}
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