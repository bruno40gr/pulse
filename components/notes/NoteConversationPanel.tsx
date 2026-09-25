'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, SlidePanel, SlidePanelHeader } from '@/components/ui'
import MentionTextarea from '@/components/notes/MentionTextarea'
import { colors, radius, spacing, typography } from '@/lib/tokens'

interface NoteConversationNote {
  id: string
  title: string | null
  body: string
  color: string
  created_by: string | null
  updated_at: string
}

interface NoteReply {
  id: string
  body: string
  created_by: string
  created_at: string
}

const NOTE_COLORS: Record<string, string> = {
  yellow: '#FEF08A',
  orange: '#FED7AA',
  pink: '#FBCFE8',
  purple: '#DDD6FE',
  blue: '#BFDBFE',
  green: '#BBF7D0',
  gray: '#E5E7EB',
  white: '#FFFFFF',
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function MentionText({ body }: { body: string }) {
  const parts = body.split(/(@[\u00A0A-Za-z0-9._-]+)/g)
  return (
    <>
      {parts.map((part, index) => part.length > 1 && part.startsWith('@') ? (
        <span key={index} style={{ display: 'inline-block', background: '#1F2937', color: '#FFFFFF', borderRadius: radius.sm, padding: '0 6px', fontWeight: typography.weightSemibold }}>
          {part.replace(/\u00A0/g, ' ')}
        </span>
      ) : <span key={index}>{part}</span>)}
    </>
  )
}

interface NoteConversationPanelProps {
  note: NoteConversationNote | null
  tenantId: string
  onReplyAdded: (noteId: string, replyCount: number) => void
  onClose: () => void
}

export default function NoteConversationPanel({ note, tenantId, onReplyAdded, onClose }: NoteConversationPanelProps) {
  const [replies, setReplies] = useState<NoteReply[]>([])
  const [loading, setLoading] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadReplies = useCallback(async () => {
    if (!note) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/notes/${note.id}/replies?tenant=${tenantId}`)
      if (!response.ok) throw new Error('Could not load replies.')
      const data = await response.json()
      setReplies(Array.isArray(data) ? data : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load replies.')
    } finally {
      setLoading(false)
    }
  }, [note, tenantId])

  useEffect(() => {
    setReplyBody('')
    setReplies([])
    if (note) void loadReplies()
  }, [loadReplies, note])

  const saveReply = async () => {
    if (!note || !replyBody.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/notes/${note.id}/replies?tenant=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyBody.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Could not save reply.')
      setReplies((current) => {
        const nextReplies = [...current, data]
        onReplyAdded(note.id, nextReplies.length)
        return nextReplies
      })
      setReplyBody('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save reply.')
    } finally {
      setSaving(false)
    }
  }

  const panelTitle = note?.title || 'Note conversation'
  return (
    <SlidePanel isOpen={Boolean(note)} onClose={onClose} width="min(92vw, 640px)">
      <SlidePanelHeader title={panelTitle} subtitle={note ? `${note.created_by || 'You'} · ${formatTimestamp(note.updated_at)}` : undefined} onClose={onClose} />
      {note && (
        <>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: spacing['3xl'], display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            <article style={{ background: NOTE_COLORS[note.color] || NOTE_COLORS.white, border: '1px solid rgba(0,0,0,0.06)', borderRadius: radius.md, padding: spacing.lg }}>
              {note.title && <h3 style={{ color: colors.text, fontFamily: typography.fontSans, fontSize: typography.sizeMd, fontWeight: typography.weightSemibold, margin: '0 0 5px' }}>{note.title}</h3>}
              <div style={{ color: colors.text, fontFamily: typography.fontSans, fontSize: typography.sizeBase, lineHeight: 1.55, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                <MentionText body={note.body} />
              </div>
            </article>

            {loading ? (
              <div style={{ color: colors.textMuted, fontFamily: typography.fontSans, fontSize: typography.sizeSm }}>Loading replies…</div>
            ) : replies.length === 0 ? (
              <div style={{ color: colors.textMuted, fontFamily: typography.fontSans, fontSize: typography.sizeSm }}>No replies yet. Start the conversation below.</div>
            ) : replies.map((reply) => (
              <article key={reply.id} style={{ alignSelf: 'flex-start', width: 'min(100%, 500px)', background: colors.surfaceMuted, border: `1px solid ${colors.borderLight}`, borderRadius: radius.md, padding: spacing.lg }}>
                <div style={{ color: colors.textSecondary, fontFamily: typography.fontSans, fontSize: typography.sizeXs, fontWeight: typography.weightSemibold, marginBottom: spacing.xs }}>
                  {reply.created_by} · {formatTimestamp(reply.created_at)}
                </div>
                <div style={{ color: colors.text, fontFamily: typography.fontSans, fontSize: typography.sizeBase, lineHeight: 1.55, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                  <MentionText body={reply.body} />
                </div>
              </article>
            ))}
          </div>

          <div style={{ borderTop: `1px solid ${colors.borderLight}`, flexShrink: 0, padding: spacing['2xl'] }}>
            {error && <div role="alert" style={{ color: colors.error, fontFamily: typography.fontSans, fontSize: typography.sizeSm, marginBottom: spacing.sm }}>{error}</div>}
            <MentionTextarea
              value={replyBody}
              onChange={setReplyBody}
              placeholder="Write a reply…"
              style={{ minHeight: 96, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: spacing.md, fontSize: typography.sizeBase, lineHeight: 1.5, resize: 'vertical' }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void saveReply()
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: spacing.sm }}>
              <Button variant="primary" size="sm" onClick={() => void saveReply()} disabled={saving || !replyBody.trim()}>
                {saving ? 'Saving…' : 'Send reply'}
              </Button>
            </div>
          </div>
        </>
      )}
    </SlidePanel>
  )
}