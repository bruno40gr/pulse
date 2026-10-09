'use client'
import { TaskCompletionButton } from './TaskCompletionButton'

import { useEffect, useRef, useState } from 'react'
import { Shield } from 'lucide-react'
import { Button, Textarea } from '@/components/ui'
import MentionTextarea from '@/components/notes/MentionTextarea'
import { colors, typography, radius, spacing } from '@/lib/tokens'
import { getNoteAuthorInitials } from '@/lib/note-author'
import { Avatar } from './Avatar'
import { getStaffAvatarUrl } from '@/lib/staff-avatars'
import { getActiveTenantId } from '@/lib/tenant'

interface NoteEntry {
  id?: string
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
  mentionsEnabled?: boolean
  onSave: (text: string, mentionMembershipIds: string[]) => boolean | void | Promise<boolean | void>
  onToggleComplete?: (index: number) => void | Promise<void>
}

function formatNoteTimestamp(ts: string) {
  const d = new Date(ts)
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
}

export function NotesSection({
  title,
  notes,
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
  mentionsEnabled = false,
  onSave,
  onToggleComplete,
}: NotesSectionProps) {
  const [showInput, setShowInput] = useState(false)
  const [input, setInput] = useState(draft || '')
  const [mentionMembershipIds, setMentionMembershipIds] = useState<string[]>([])
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
      const saved = await onSave(note, mentionMembershipIds)
      if (saved !== false) {
        updateInput('')
        setMentionMembershipIds([])
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
              <Button variant="secondary" size="sm"
                type="button"
                onClick={() => setShowInput(true)}
                style={{ whiteSpace: 'nowrap' }}
              >
                <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span>
                {addLabel}
              </Button>
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
            <div key={entry.id || `${entry.timestamp}-${i}`} style={{
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
              }} title={entry.actor_name || 'Author not recorded'}>
                {getStaffAvatarUrl(getActiveTenantId(), entry.actor_name)
                  ? <Avatar firstName={entry.actor_name?.split(' ')[0] || ''} lastName={entry.actor_name?.split(' ').slice(1).join(' ') || ''} size={28} src={getStaffAvatarUrl(getActiveTenantId(), entry.actor_name)} style={{ background: avatarBg }} />
                  : getNoteAuthorInitials(entry.actor_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: '4px' }}>
                  {entry.actor_name ? `${entry.actor_name} · ${formatNoteTimestamp(entry.timestamp)}` : formatNoteTimestamp(entry.timestamp)}
                </div>
                <div style={{ fontSize: '13px', color: entry.completed_at ? colors.textSecondary : colors.text, lineHeight: 1.5, textDecoration: entry.completed_at ? 'line-through' : 'none', whiteSpace: 'pre-wrap' }}>{entry.text.replace(/\u00A0/g, ' ')}</div>
              </div>
              {onToggleComplete && (
                <TaskCompletionButton completed={Boolean(entry.completed_at)}
                  type="button"
                  onClick={() => onToggleComplete(i)}
                  title={entry.completed_at ? 'Mark note as open' : 'Mark note as done'}
                  aria-label={entry.completed_at ? 'Mark note as open' : 'Mark note as done'}
                >
                </TaskCompletionButton>
              )}
            </div>
          ))}
        </div>
      )}

      {!showInput && !showHeader ? (
        <Button variant="secondary" size="sm"
          onClick={() => setShowInput(true)}
          style={{ width: '100%' }}
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
        </Button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          {mentionsEnabled ? (
            <MentionTextarea
              value={input}
              onChange={updateInput}
              mentionMembershipIds={mentionMembershipIds}
              onMentionMembershipIdsChange={setMentionMembershipIds}
              placeholder="Write a note..."
              style={{ minHeight: '100px', border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: spacing.md, fontSize: typography.sizeBase, fontFamily: typography.fontSans, resize: 'vertical' }}
            />
          ) : (
            <Textarea
              value={input}
              onChange={e => updateInput(e.target.value)}
              onBlur={() => {
                if (autoSaveOnBlur) void handleSave()
              }}
              placeholder="Write a note..."
              style={{ minHeight: '100px', border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: spacing.md, fontSize: typography.sizeBase, fontFamily: typography.fontSans, resize: 'vertical' }}
            />
          )}
          <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onMouseDown={(event) => event.preventDefault()} onClick={() => { setShowInput(false); updateInput(''); setMentionMembershipIds([]) }}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={saving}>{saving ? 'Saving...' : 'Save note'}</Button>
          </div>
        </div>
      )}
    </div>
  )
}