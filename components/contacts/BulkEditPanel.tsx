'use client'
import { useState } from 'react'
import { SlidePanel, SlidePanelHeader, Button } from '@/components/ui'
import { colors, typography, radius, spacing } from '@/lib/tokens'

interface TenantField {
  field_key: string
  field_label: string
  field_type: string
  field_options: string[] | null
}

interface BulkEditPanelProps {
  selectedCount: number
  selectedIds: string[]
  tenantFields: TenantField[]
  onClose: () => void
  onSaved: () => void
}

const inputStyle: React.CSSProperties = {
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  padding: `${spacing.xs} ${spacing.sm}`,
  fontSize: typography.sizeBase,
  fontFamily: typography.fontSans,
  color: colors.text,
  background: colors.surface,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'auto',
}

const labelStyle: React.CSSProperties = {
  fontSize: typography.sizeXs,
  color: colors.textMuted,
  marginBottom: '2px',
  fontFamily: typography.fontSans,
}

export default function BulkEditPanel({ selectedCount, selectedIds, tenantFields, onClose, onSaved }: BulkEditPanelProps) {
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const fields: { key: string; label: string; options?: string[] }[] = [
    { key: 'instructor', label: 'Instructor' },
    { key: 'client_status', label: 'Status', options: ['active', 'inactive', 'member', 'lead'] },
    ...tenantFields
      .filter(f => !['band_name', 'instructor'].includes(f.field_key) && f.field_options?.length)
      .map(f => ({ key: f.field_key, label: f.field_label, options: f.field_options! })),
  ]

  const hasEdits = Object.values(edits).some(v => v !== '')

  const handleSave = async () => {
    const patchBody = Object.fromEntries(
      Object.entries(edits).filter(([, v]) => v !== '')
    )
    if (Object.keys(patchBody).length === 0) return

    setSaving(true)
    let successCount = 0
    for (const id of selectedIds) {
      try {
        await fetch(`/api/contacts/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody),
        })
        successCount++
      } catch {}
    }
    setSaving(false)
    onSaved()
  }

  return (
    <SlidePanel isOpen={true} onClose={onClose}>
      <SlidePanelHeader
        title="Bulk edit"
        subtitle={`${selectedCount} ${selectedCount === 1 ? 'contact' : 'contacts'} selected`}
        onClose={onClose}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: `${spacing.lg} ${spacing['2xl']}` }}>
        <p style={{ fontSize: typography.sizeSm, color: colors.textMuted, marginTop: 0, marginBottom: spacing.lg, fontFamily: typography.fontSans, lineHeight: 1.5 }}>
          Only fields you fill in will be updated. Leave a field blank to keep current values.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {fields.map(f => (
            <div key={f.key}>
              <div style={labelStyle}>{f.label}</div>
              {f.options ? (
                <select
                  value={edits[f.key] || ''}
                  onChange={e => setEdits(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={selectStyle}
                >
                  <option value="">— Keep current —</option>
                  {f.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={edits[f.key] || ''}
                  onChange={e => setEdits(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder="Enter value..."
                  style={inputStyle}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: `${spacing.lg} ${spacing['2xl']}`, borderTop: `1px solid ${colors.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: colors.surface }}>
        <span style={{ fontSize: typography.sizeSm, color: colors.textMuted, fontFamily: typography.fontSans }}>
          {saving ? `Saving ${selectedIds.length} contacts...` : ''}
        </span>
        <div style={{ display: 'flex', gap: spacing.sm }}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !hasEdits}>
            {saving ? 'Saving...' : `Save ${selectedIds.length} ${selectedIds.length === 1 ? 'contact' : 'contacts'}`}
          </Button>
        </div>
      </div>
    </SlidePanel>
  )
}