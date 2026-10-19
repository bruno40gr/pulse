'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button, Textarea } from '@/components/ui'
import { colors, spacing, typography } from '@/lib/tokens'
import { fillMockTemplate, type MockRecipient } from '@/lib/prototype-messaging'
import type { PrototypeThread } from '@/lib/conversations-prototype'

import PrototypeSmsPreview from '@/components/inbox/PrototypeSmsPreview'
import { useMediaQuery } from '@/lib/useMediaQuery'

/** Mirrors the live SMS inbox's bubble/reply-bar presentation; never calls its handlers. */
export default function PrototypeSmsConversation({ thread, mobile, draft, onChange, onSend, recipients, disabled = false, live = false, onDraft, compact = false }: {
  thread: PrototypeThread; mobile: boolean; draft: string; onChange: (value: string) => void; onSend: () => void; recipients?: MockRecipient[]
  disabled?: boolean; live?: boolean; onDraft?: () => Promise<string>; compact?: boolean
}) {
  const wide = useMediaQuery('(min-width: 1000px)')
  const desktop = wide && !compact
  const [drafting, setDrafting] = useState(false)
  const [draftError, setDraftError] = useState('')
  async function draftWithAI() {
    if (drafting || disabled) return
    setDrafting(true); setDraftError('')
    try {
      const body = await onDraft?.()
      if (!body) throw new Error('Could not draft a reply.')
      onChange(body)
    } catch (error) { setDraftError(error instanceof Error ? error.message : 'Could not draft a reply.') }
    finally { setDrafting(false) }
  }
  const previewRecipient = recipients?.[0]
  const previewName = recipients ? previewRecipient?.name || 'Message preview' : thread.name
  const previewBody = recipients ? fillMockTemplate(draft, previewRecipient) : draft
  const showHistory = !recipients || recipients.length === 1
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [thread.id, thread.messages.length])
  return <div aria-label="SMS workspace" style={{ display: 'grid', gridTemplateColumns: desktop ? 'minmax(0, 3fr) minmax(0, 7fr)' : 'minmax(0, 1fr)', flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflowY: 'auto' }}>
    {showHistory && <div role="region" aria-label="SMS history" style={{ flex: 1, minHeight: 180, maxHeight: recipients ? 320 : undefined, overflowY: 'auto', padding: mobile ? `${spacing.lg} ${spacing.md}` : `${spacing['2xl']} ${spacing['3xl']}`, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      {recipients && <strong style={{ ...typography.bodySmall, color: colors.textSecondary }}>SMS history with {thread.name}</strong>}
      {!thread.messages.length && <p style={{ color: colors.textMuted }}>No text messages yet. Write one below.</p>}
      {thread.messages.map(message => <div key={message.id} style={{ display: 'flex', justifyContent: message.direction === 'outbound' ? 'flex-end' : 'flex-start' }}>
        <div style={{ maxWidth: mobile ? '85%' : undefined }}>
          <div style={{ maxWidth: mobile ? '100%' : '360px', padding: `${spacing.sm} ${spacing.md}`, borderRadius: message.direction === 'outbound' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: message.direction === 'outbound' ? '#007AFF' : colors.surface, color: message.direction === 'outbound' ? 'white' : colors.text, fontSize: typography.sizeBase, fontFamily: typography.fontSans, lineHeight: 1.5, border: message.direction === 'inbound' ? `1px solid ${colors.border}` : 'none', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{message.body}</div>
          <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginTop: 4, textAlign: message.direction === 'outbound' ? 'right' : 'left' }}>{message.time}{message.simulated ? ' · Mock only — not sent' : ''}</div>
        </div>
      </div>)}
      <div ref={end} />
    </div>}
    <div style={{ padding: mobile ? spacing.md : spacing['2xl'], borderTop: `1px solid ${colors.border}`, background: colors.surface, display: 'flex', flexDirection: 'column', gap: spacing.sm, flexShrink: 0 }}>
      <Textarea disabled={disabled} aria-label="SMS message" value={draft} onChange={event => onChange(event.target.value)} onKeyDown={event => { if (!disabled && event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); onSend() } }} placeholder={recipients ? 'Write a text message…' : `Reply to ${thread.name}...`} style={{ width: '100%', minHeight: 60, maxHeight: 120, resize: 'none' }} />
      {draftError && <p role="alert" style={{ ...typography.bodySmall, color: colors.error }}>{draftError}</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
        {!live && <Button variant="secondary" size="sm" onClick={() => onChange(draft.trim() ? `Hi ${recipients ? '{{firstName}}' : thread.name.split(' ')[0]}! ${draft.trim()}` : `Hi ${recipients ? '{{firstName}}' : thread.name.split(' ')[0]}! Thanks for reaching out. What days and times work best for you?`)}><Sparkles size={12} />{draft.trim() ? 'Polish with AI' : 'Draft with AI'} (sample)</Button>}
        {live && onDraft && <Button variant="secondary" size="sm" disabled={disabled || drafting} onClick={() => void draftWithAI()}><Sparkles size={12} />{drafting ? 'Drafting…' : draft.trim() ? 'Polish with AI' : 'Draft with AI'}</Button>}
        {!onDraft && live && <span />}
        <Button onClick={onSend} disabled={disabled || !draft.trim() || (recipients && (!recipients.length || recipients.some(person => !person.phone)))}>Send</Button>
      </div>
      {draft.trim() && <span style={{ fontSize: typography.sizeSm, color: colors.textMuted }}>SMS · {Math.ceil(draft.length / 160)} {live ? 'estimated' : 'sample'} segment{draft.length > 160 ? 's' : ''}</span>}
    </div>
    </div>
    {desktop && <aside aria-label="SMS preview pane" style={{ minWidth: 0, minHeight: 0, overflowY: 'auto', borderLeft: `1px solid ${colors.border}`, background: colors.backgroundSecondary, padding: spacing.xl, display: 'flex', flexDirection: 'column', justifyContent: 'safe center' }}><PrototypeSmsPreview name={previewName} body={previewBody} /></aside>}
  </div>
}
