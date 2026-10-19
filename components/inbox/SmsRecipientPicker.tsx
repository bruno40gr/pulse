'use client'

import { Search, X, Check } from 'lucide-react'
import { Avatar, Button } from '@/components/ui'
import { ControlButton } from '@/components/ui/ControlButton'
import { colors, typography, spacing, radius } from '@/lib/tokens'

export interface SmsRecipient {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
}

function displayName(r: SmsRecipient) {
  return `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Unnamed'
}

const inputStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, border: 'none', outline: 'none',
  fontSize: typography.sizeBase, fontFamily: typography.fontSans,
  background: 'transparent', color: colors.text,
}

/** Shared recipient UI; callers supply live or sandbox data. */
export default function SmsRecipientPicker({ query, results, selected, searching = false, handleSearch, toggleStaff, toggleRecipient }: {
  query: string; results: SmsRecipient[]; selected: SmsRecipient[]; searching?: boolean; staffOnly?: boolean
  handleSearch: (query: string) => void; toggleStaff?: (staff: boolean) => void
  toggleRecipient: (recipient: SmsRecipient) => void
}) {
  return <>
        {/* Search */}
        <div style={{ padding: `${spacing.md} ${spacing['2xl']}`, flexShrink: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: `${spacing.sm} ${spacing.md}`,
            background: colors.surface,
          }}>
            <Search size={16} color={colors.textMuted} />
            <input
              aria-label="Search SMS recipients"
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search everyone…"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Staff filter */}
        {toggleStaff && <div style={{ padding: `0 ${spacing['2xl']} ${spacing.md}`, flexShrink: 0 }}>
          <div style={{
            display: 'flex',
            background: colors.surfaceMuted,
            borderRadius: radius.md,
            padding: 3,
            gap: 2,
          }}>
            {[{ key: false, label: 'Everyone' }, { key: true, label: 'Staff only' }].map(opt => {
              return (
                <Button variant="secondary" size="sm"
                  key={String(opt.key)}
                  onClick={() => toggleStaff(opt.key)}
                  style={{ flex: 1 }}
                >
                  {opt.label}
                </Button>
              )
            })}
          </div>
        </div>}

        {/* Selected recipients (append as you select) */}
        {selected.length > 0 && (
          <div style={{ padding: `0 ${spacing['2xl']} ${spacing.md}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
              {selected.map(s => (
                <span
                  key={s.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: colors.crimson,
                    color: colors.surface,
                    borderRadius: radius.full,
                    padding: '3px 8px 3px 10px',
                    fontSize: typography.sizeSm,
                    fontFamily: typography.fontSans,
                    fontWeight: typography.weightMedium,
                  }}
                >
                  {displayName(s)}
                  <ControlButton kind="icon"
                    onClick={() => toggleRecipient(s)}

                    aria-label={`Remove ${displayName(s)} from SMS recipients`}
                  >
                    <X size={13} />
                  </ControlButton>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Contact list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: `0 ${spacing.sm}` }}>
          {searching && results.length === 0 && (
            <p style={{ padding: spacing['2xl'], textAlign: 'center', color: colors.textMuted, fontSize: typography.sizeSm, fontFamily: typography.fontSans }}>
              Loading…
            </p>
          )}
          {!searching && results.length === 0 && (
            <p style={{ padding: spacing['2xl'], textAlign: 'center', color: colors.textMuted, fontSize: typography.sizeSm, fontFamily: typography.fontSans }}>
              No contacts found.
            </p>
          )}
          {results.map(r => {
            const isSelected = selected.some(p => p.id === r.id)
            return (
              <ControlButton kind="row"
                aria-label={`${isSelected ? 'Deselect' : 'Add'} ${displayName(r)} ${isSelected ? 'from' : 'to'} SMS recipients`}
                aria-pressed={isSelected}
                key={r.id}
                onClick={() => toggleRecipient(r)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: `${spacing.sm} ${spacing.md}`,
                  margin: `0 ${spacing.sm}`,
                  width: `calc(100% - ${spacing.sm} - ${spacing.sm})`,
                  boxSizing: 'border-box',
                  borderRadius: radius.md,
                  cursor: 'pointer',
                  background: isSelected ? colors.surfaceMuted : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <Avatar firstName={r.first_name || ''} lastName={r.last_name || ''} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: typography.sizeMd, fontWeight: 600, color: colors.text, fontFamily: typography.fontSans }}>
                    {displayName(r)}
                  </div>
                  <div style={{ fontSize: typography.sizeSm, color: r.phone ? colors.textMuted : colors.warning, fontFamily: typography.fontSans }}>
                    {r.phone || 'No phone'}
                  </div>
                </div>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: radius.full,
                    border: `1.5px solid ${isSelected ? colors.crimson : colors.border}`,
                    background: isSelected ? colors.crimson : 'transparent',
                    color: colors.surface,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isSelected && <Check size={14} />}
                </span>
              </ControlButton>
            )
          })}
        </div>

  </>
}
