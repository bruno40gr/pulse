'use client'
import { useState } from 'react'
import { Button, Textarea } from '@/components/ui'
import { colors, typography, radius, spacing } from '@/lib/tokens'

interface NoteEntry {
  text: string
  timestamp: string
}

interface NotesSectionProps {
  title: string
  notes: NoteEntry[]
  avatarInitial: string
  avatarBg: string
  cardBg: string
  addLabel?: string
  saving?: boolean
  onSave: (text: string) => void
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
  onSave,
}: NotesSectionProps) {
  const [showInput, setShowInput] = useState(false)
  const [input, setInput] = useState('')

  const handleSave = () => {
    if (!input.trim()) return
    onSave(input.trim())
    setInput('')
    setShowInput(false)
  }

  return (
    <div>
      <h2 style={{
        fontSize: '18px',
        fontWeight: 600,
        color: colors.text,
        margin: 0,
        marginBottom: '4px',
        fontFamily: typography.fontSans,
      }}>
        {title}
      </h2>

      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
          {notes.map((entry, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: '10px',
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
                  {formatNoteTimestamp(entry.timestamp)}
                </div>
                <div style={{ fontSize: '13px', color: colors.text, lineHeight: 1.5 }}>{entry.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showInput ? (
        <button
          onClick={() => setShowInput(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '12px 16px',
            border: 'none',
            borderRadius: '8px',
            background: '#f6f8f8',
            color: colors.textMuted,
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: typography.fontSans,
            cursor: 'pointer',
            textAlign: 'left',
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
            onChange={e => setInput(e.target.value)}
            placeholder="Write a note..."
            style={{ minHeight: '100px', border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: spacing.md, fontSize: typography.sizeBase, fontFamily: typography.fontSans, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={() => { setShowInput(false); setInput('') }}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save note'}</Button>
          </div>
        </div>
      )}
    </div>
  )
}