'use client'
import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { SlidePanel, SlidePanelHeader, Button, Avatar } from '@/components/ui'
import ComposePanel from '@/components/campaigns/ComposePanel'
import { colors, typography, spacing, radius } from '@/lib/tokens'

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

export default function ComposeModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Recipient[]>([])
  const [selected, setSelected] = useState<Recipient[]>([])
  const [searching, setSearching] = useState(false)
  const [composing, setComposing] = useState(false)

  const handleSearch = async (value: string) => {
    setQuery(value)
    if (!value.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const data = await fetch(`/api/recipient-search?q=${encodeURIComponent(value)}`).then(r => r.json())
      setResults(Array.isArray(data) ? data : [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
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
            filterExplanation={`To ${selected.map(s => `${s.first_name || ''} ${s.last_name || ''}`.trim()).join(', ')}`}
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

  // Stage 1 — pick recipients
  return (
    <SlidePanel isOpen={true} onClose={onClose}>
      <SlidePanelHeader title="New message" onClose={onClose} />
      <div style={{ flex: 1, overflow: 'auto', padding: spacing['2xl'] }}>
        {/* Selected recipients */}
        {selected.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
            {selected.map(s => (
              <span
                key={s.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: colors.surfaceMuted,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.lg,
                  padding: '4px 10px',
                  fontSize: typography.sizeSm,
                  fontFamily: typography.fontSans,
                  color: colors.text,
                }}
              >
                {s.first_name} {s.last_name}
                <button
                  onClick={() => toggleRecipient(s)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: colors.textMuted, padding: 0, display: 'flex' }}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search */}
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
            placeholder="Search contacts by name or phone…"
            style={inputStyle}
          />
        </div>

        {/* Results */}
        <div style={{ marginTop: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
          {searching && <p style={{ color: colors.textMuted, fontSize: typography.sizeSm, fontFamily: typography.fontSans }}>Searching…</p>}
          {!searching && query.trim() && results.length === 0 && (
            <p style={{ color: colors.textMuted, fontSize: typography.sizeSm, fontFamily: typography.fontSans }}>No contacts found.</p>
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
                  borderRadius: radius.md,
                  cursor: 'pointer',
                  background: isSelected ? colors.surfaceMuted : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <Avatar firstName={r.first_name || ''} lastName={r.last_name || ''} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: typography.sizeMd, fontWeight: 600, color: colors.text, fontFamily: typography.fontSans }}>
                    {r.first_name} {r.last_name}
                  </div>
                  <div style={{ fontSize: typography.sizeSm, color: colors.textMuted, fontFamily: typography.fontSans }}>
                    {r.phone || r.email || '—'}
                  </div>
                </div>
                <span style={{ fontSize: typography.sizeMd, color: isSelected ? colors.crimson : colors.textMuted, fontWeight: 600 }}>
                  {isSelected ? '✓' : '+'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{
        padding: `${spacing.lg} ${spacing['2xl']}`,
        borderTop: `1px solid ${colors.borderLight}`,
        display: 'flex',
        justifyContent: 'flex-end',
        flexShrink: 0,
        background: colors.surface,
      }}>
        <Button variant="primary" disabled={selected.length === 0} onClick={() => setComposing(true)}>
          Compose ({selected.length})
        </Button>
      </div>
    </SlidePanel>
  )
}
