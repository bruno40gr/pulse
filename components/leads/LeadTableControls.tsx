'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Select } from '@/components/ui'
import { colors, radius, spacing } from '@/lib/tokens'
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
  return { preferences, updatePreferences, persistent: storageKey !== null }
}

export function LeadTableControls({ columns, preferences, onChange, persistent }: {
  columns: { id: string; label: string }[]
  preferences: LeadTablePreferences
  onChange: (next: LeadTablePreferences) => void
  persistent: boolean
}) {
  const details = useRef<HTMLDetailsElement>(null)
  return (
    <details ref={details} style={{ marginLeft: 'auto', position: 'relative' }} onKeyDown={event => {
      if (event.key === 'Escape' && details.current) {
        details.current.open = false
        details.current.querySelector('summary')?.focus()
      }
    }}>
      <summary style={{ cursor: 'pointer', padding: `${spacing.sm} ${spacing.md}`, border: `1px solid ${colors.border}`, borderRadius: radius.sm }}>Columns & spacing</summary>
      <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: spacing.xs, zIndex: 10, width: 'min(300px, calc(100vw - 48px))', maxHeight: '65vh', overflowY: 'auto', padding: spacing.md, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.sm }}>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>Visible columns</legend>
          {columns.map(column => <label key={column.id} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minHeight: 36 }}>
            <input type="checkbox" checked={preferences.columns.includes(column.id as LeadTablePreferences['columns'][number])} disabled={column.id === 'name'} onChange={event => onChange(normalizeLeadTablePreferences({ ...preferences, columns: event.target.checked ? [...preferences.columns, column.id] : preferences.columns.filter(id => id !== column.id) }))} />
            {column.label}{column.id === 'name' ? ' (required)' : ''}
          </label>)}
        </fieldset>
        <Select label="Row spacing" aria-label="Row spacing" value={preferences.density} onChange={event => onChange({ ...preferences, density: event.target.value === 'compact' ? 'compact' : 'comfortable' })}>
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </Select>
        <p style={{ color: colors.textSecondary }}> {persistent ? 'Saved for your account in this browser.' : 'Preferences apply to this visit until your account is verified.'}</p>
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange(defaultLeadTablePreferences())}>Reset to defaults</Button>
      </div>
    </details>
  )
}