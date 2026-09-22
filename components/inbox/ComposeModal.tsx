'use client'
import { useEffect, useState } from 'react'
import { Search, X, Check } from 'lucide-react'
import { SlidePanel, SlidePanelHeader, Button, Avatar } from '@/components/ui'
import ComposePanel from '@/components/campaigns/ComposePanel'
import { colors, typography, spacing, radius, shadows } from '@/lib/tokens'

interface Recipient {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  fontSize: typography.sizeBase,
  fontFamily: typography.fontSans,
  background: 'transparent',
  color: colors.text,
}

function displayName(r: Recipient) {
  return `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Unnamed'
}

export default function ComposeModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Recipient[]>([])
  const [selected, setSelected] = useState<Recipient[]>([])
  const [searching, setSearching] = useState(false)
  const [composing, setComposing] = useState(false)
  const [staffOnly, setStaffOnly] = useState(false)

  const loadContacts = async (q: string, staff: boolean) => {
    setSearching(true)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (staff) params.set('staff', '1')
      const qs = params.toString()
      const data = await fetch(`/api/recipient-search${qs ? `?${qs}` : ''}`).then(r => r.json())
      setResults(Array.isArray(data) ? data : [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  // Load everyone on open so the full database is browsable.
  useEffect(() => {
    loadContacts('', false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = (value: string) => {
    setQuery(value)
    loadContacts(value, staffOnly)
  }

  const toggleStaff = (staff: boolean) => {
    setStaffOnly(staff)
    loadContacts(query, staff)
  }

  const toggleRecipient = (r: Recipient) => {
    setSelected(prev =>
      prev.some(p => p.id === r.id)
        ? prev.filter(p => p.id !== r.id)
        : [...prev, r]
    )
  }

  // Stage 2 — compose message to the selected recipients
  if (composing) {
    return (
      <SlidePanel isOpen={true} onClose={onClose}>
        <SlidePanelHeader
          title="New message"
          onClose={onClose}
          onBack={() => setComposing(false)}
          backLabel="Recipients"
        />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <ComposePanel
            recipientCount={selected.length}
            filterExplanation={`To ${selected.map(displayName).join(', ')}`}
            recipientIds={selected.map(s => s.id)}
            channel="sms"
            mode={selected.length === 1 ? 'single' : 'bulk'}
            composeSource="scratch"
            composeIntent="neutral"
            recipientPreview={selected.map(s => ({
              id: s.id,
              first_name: s.first_name || '',
              last_name: s.last_name || '',
            }))}
            onClose={onClose}
            onSent={() => setTimeout(onClose, 3000)}
          />
        </div>
      </SlidePanel>
    )
  }

  // Stage 1 — pick recipients (narrow, tall modal)
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: spacing['2xl'],
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 400,
          maxWidth: '100%',
          height: 'min(78vh, 680px)',
          display: 'flex',
          flexDirection: 'column',
          background: colors.surface,
          borderRadius: radius.xl,
          boxShadow: shadows.xl,
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${spacing.lg} ${spacing['2xl']}`,
          borderBottom: `1px solid ${colors.borderLight}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: typography.sizeLg, fontWeight: typography.weightSemibold, color: colors.text, fontFamily: typography.fontSans }}>
            New message
          </span>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: colors.textMuted, padding: 0, display: 'flex' }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

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
              autoFocus
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search everyone…"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Staff filter */}
        <div style={{ padding: `0 ${spacing['2xl']} ${spacing.md}`, flexShrink: 0 }}>
          <div style={{
            display: 'flex',
            background: colors.surfaceMuted,
            borderRadius: radius.md,
            padding: 3,
            gap: 2,
          }}>
            {[{ key: false, label: 'Everyone' }, { key: true, label: 'Staff only' }].map(opt => {
              const active = staffOnly === opt.key
              return (
                <button
                  key={String(opt.key)}
                  onClick={() => toggleStaff(opt.key)}
                  style={{
                    flex: 1,
                    border: 'none',
                    borderRadius: radius.sm,
                    padding: `${spacing.xs} ${spacing.sm}`,
                    fontSize: typography.sizeSm,
                    fontFamily: typography.fontSans,
                    fontWeight: active ? typography.weightSemibold : typography.weightNormal,
                    background: active ? colors.surface : 'transparent',
                    color: active ? colors.text : colors.textMuted,
                    cursor: 'pointer',
                    boxShadow: active ? shadows.sm : 'none',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

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
                  <button
                    onClick={() => toggleRecipient(s)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: 0, display: 'flex' }}
                    aria-label={`Remove ${displayName(s)}`}
                  >
                    <X size={13} />
                  </button>
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
              <div
                key={r.id}
                onClick={() => toggleRecipient(r)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: `${spacing.sm} ${spacing.md}`,
                  margin: `0 ${spacing.sm}`,
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
              </div>
            )
          })}
        </div>

        {/* Footer CTA */}
        <div style={{
          padding: `${spacing.lg} ${spacing['2xl']}`,
          borderTop: `1px solid ${colors.borderLight}`,
          display: 'flex',
          flexShrink: 0,
          background: colors.surface,
        }}>
          <Button variant="primary" disabled={selected.length === 0} onClick={() => setComposing(true)} style={{ width: '100%' }}>
            Compose messages{selected.length > 0 ? ` (${selected.length})` : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}
