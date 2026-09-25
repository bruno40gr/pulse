'use client'
import { useEffect, useRef, useState } from 'react'
import { Check, Shield } from 'lucide-react'
import { Button, Textarea } from '@/components/ui'
import { colors, typography, radius, spacing } from '@/lib/tokens'

interface NoteEntry {
  text: string
  timestamp: string
  actor_name?: string | null
  completed_at?: string | null
}

interface NotesSectionProps {
  title: string
  notes: NoteEntry[]
  avatarInitial: string
  avatarBg: string
  cardBg: string
  addLabel?: string
  saving?: boolean
  signifierLabel?: string
  helperText?: string
  showHeader?: boolean
  autoSaveOnBlur?: boolean
  draft?: string
  onDraftChange?: (draft: string) => void
  onSave: (text: string) => boolean | void | Promise<boolean | void>
  onToggleComplete?: (index: number) => void
}

function formatNoteTimestamp(ts: string) {
  const d = new Date(ts)
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
}

export function NotesSection({
  title,
  notes,
  avatarInitial,
  avatarBg,
  cardBg,
  addLabel = 'Add a note',
  saving = false,
  signifierLabel,
  helperText,
  showHeader = true,
  autoSaveOnBlur = false,
  draft,
  onDraftChange,
  onSave,
  onToggleComplete,
}: NotesSectionProps) {
  const [showInput, setShowInput] = useState(false)
  const [input, setInput] = useState(draft || '')
  const savingRef = useRef(false)

  useEffect(() => {
    if (typeof draft === 'string') {
      setInput(draft)
      if (draft) setShowInput(true)
    }
  }, [draft])

  const updateInput = (value: string) => {
    setInput(value)
    onDraftChange?.(value)
  }

  const handleSave = async () => {
    if (savingRef.current) return
    if (!input.trim()) return
    savingRef.current = true
    const note = input.trim()
    try {
      const saved = await onSave(note)
      if (saved !== false) {
        updateInput('')
        setShowInput(false)
      }
    } finally {
      savingRef.current = false
    }
  }

  return (
    <div>
      {showHeader && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
              <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: colors.text,
              margin: 0,
              fontFamily: typography.fontSans,
              }}>
                {title}
              </h2>
              {signifierLabel && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                borderRadius: radius.full,
                background: '#E5EEF8',
                border: '1px solid #B9D0EA',
                color: '#1E3A5F',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.03em',
                fontFamily: typography.fontSans,
              }}>
                <Shield size={12} strokeWidth={2} />
                {signifierLabel}
              </span>
              )}
            </div>
            {!showInput && (
              <button
                type="button"
                onClick={() => setShowInput(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs} ${spacing.sm}`, border: `1px solid ${colors.border}`, borderRadius: radius.sm, background: colors.surface, color: colors.textSecondary, fontSize: typography.sizeSm, fontWeight: typography.weightMedium, fontFamily: typography.fontSans, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span>
                {addLabel}
              </button>
            )}
          </div>
          {helperText && (
            <div style={{ marginTop: '4px', fontSize: '12px', color: colors.textMuted, fontFamily: typography.fontSans }}>
              {helperText}
            </div>
          )}
        </div>
      )}

      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
          {notes.map((entry, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: radius.lg,
              background: cardBg,
              border: `1px solid ${colors.borderLight}`,
            }}>
              <div style={{
                width: '28px', height: '28px',
                borderRadius: '50%',
                background: avatarBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 600,
                color: 'white',
                flexShrink: 0,
                marginTop: '1px',
              }}>{avatarInitial}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: '4px' }}>
                  {entry.actor_name ? `${entry.actor_name} · ${formatNoteTimestamp(entry.timestamp)}` : formatNoteTimestamp(entry.timestamp)}
                </div>
                <div style={{ fontSize: '13px', color: entry.completed_at ? colors.textSecondary : colors.text, lineHeight: 1.5, textDecoration: entry.completed_at ? 'line-through' : 'none' }}>{entry.text}</div>
              </div>
              {onToggleComplete && (
                <button
                  type="button"
                  onClick={() => onToggleComplete(i)}
                  title={entry.completed_at ? 'Mark note as open' : 'Mark note as done'}
                  aria-label={entry.completed_at ? 'Mark note as open' : 'Mark note as done'}
                  style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 7px', borderRadius: radius.sm, border: `1px solid ${entry.completed_at ? '#86C99C' : colors.border}`, background: entry.completed_at ? '#F0FDF4' : colors.surface, color: entry.completed_at ? colors.greenDark : colors.textSecondary, fontSize: '10px', fontWeight: typography.weightBold, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: typography.fontSans, cursor: 'pointer', flexShrink: 0 }}
                >
                  <Check size={12} strokeWidth={2.4} />
                  {entry.completed_at ? 'Done' : 'Mark done'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!showInput && !showHeader ? (
        <button
          onClick={() => setShowInput(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '12px 16px',
            border: 'none',
            borderRadius: radius.lg,
            background: '#f6f8f8',
            color: colors.textMuted,
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: typography.fontSans,
            cursor: 'pointer',
          textAlign: 'right',
          justifyContent: 'flex-end',
          }}
        >
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px', height: '18px',
            borderRadius: '50%',
            background: '#E5E7EB',
            color: colors.textMuted,
            fontSize: '14px',
            lineHeight: 1,
          }}>+</span>
          {addLabel}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          <Textarea
            value={input}
            onChange={e => updateInput(e.target.value)}
            onBlur={() => {
              if (autoSaveOnBlur) void handleSave()
            }}
            placeholder="Write a note..."
            style={{ minHeight: '100px', border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: spacing.md, fontSize: typography.sizeBase, fontFamily: typography.fontSans, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onMouseDown={(event) => event.preventDefault()} onClick={() => { setShowInput(false); updateInput('') }}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={saving}>{saving ? 'Saving...' : 'Save note'}</Button>
          </div>
        </div>
      )}
    </div>
  )
}