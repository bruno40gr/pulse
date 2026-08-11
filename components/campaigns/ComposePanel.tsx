'use client'
import { useState, useEffect, useRef } from 'react'
import { Paperclip, X, Sparkles } from 'lucide-react'
import { Button, Avatar, Textarea, Input } from '@/components/ui'
import { colors, typography, radius, spacing } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'

interface ComposePanelProps {
  recipientCount: number
  filterExplanation: string
  recipientIds: string[]
  channel?: 'sms' | 'email'
  onClose?: () => void
  onSent?: () => void
  mode?: 'bulk' | 'single'
  contactContext?: {
    id: string
    first_name: string
    last_name: string
    custom_fields?: Record<string, any>
    last_attended?: string | null
    notes_history?: {text: string, timestamp: string}[]
  }
}

export default function ComposePanel({
  recipientCount, filterExplanation, recipientIds, channel = 'sms', onClose, onSent,
  mode = 'bulk', contactContext
}: ComposePanelProps) {
  const [message, setMessage] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [showMediaInput, setShowMediaInput] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sensitiveCheck, setSensitiveCheck] = useState<{
    flagged: { id: string, name: string, note: string }[],
    opted_out: { id: string, name: string }[]
  } | null>(null)
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const [sent, setSent] = useState(false)
  const [sentResult, setSentResult] = useState<{ sent: number, failed: number } | null>(null)
  const prePolishMessage = useRef<string>('')

  const isMMS = !!mediaUrl
  const firstNamePreview = contactContext?.first_name || 'Alex'
  const previewMessage = message.replace(/\{first_name\}/gi, firstNamePreview) || 'Your message will appear here...'
  const effectiveRecipientIds = recipientIds.filter(id => !removedIds.has(id))
  const effectiveCount = effectiveRecipientIds.length
  const effectiveSendCount = effectiveCount

  useEffect(() => {
    if (!recipientIds.length) return
    fetch('/api/contacts/check-sensitive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_ids: recipientIds })
    })
      .then(r => r.json())
      .then(data => setSensitiveCheck(data))
      .catch(() => {})
  }, [recipientIds.join(',')])

  const handleAiDraft = async () => {
    setAiLoading(true)
    if (message.trim()) prePolishMessage.current = message
    try {
      const contextNote = mode === 'single' && contactContext?.notes_history?.length
        ? `Contact notes: ${contactContext.notes_history[0].text}`
        : ''

      const res = await fetch('/api/draft-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: message.trim() || 'Write a warm friendly message',
          recipient_context: mode === 'single' && contactContext
            ? `Writing to ${contactContext.first_name} ${contactContext.last_name}. ${Object.entries(contactContext.custom_fields || {}).map(([k,v]) => `${k}: ${v}`).join(', ')}. ${contextNote}`
            : filterExplanation,
        })
      })
      const data = await res.json()
      if (data.draft) setMessage(data.draft)
    } catch (e) {
      console.error(e)
    } finally {
      setAiLoading(false)
    }
  }

  const handleUndoPolish = () => {
    if (prePolishMessage.current) {
      setMessage(prePolishMessage.current)
      prePolishMessage.current = ''
    }
  }

  const handleSend = async () => {
    if (!message.trim() || effectiveCount === 0) return
    setIsSending(true)
    const tenantId = getActiveTenantId()
    try {
      const campaignRes = await fetch(`/api/campaigns?tenant=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          message,
          media_url: mediaUrl || null,
          filter_query: filterExplanation,
          recipient_count: effectiveSendCount,
          status: 'sending',
        })
      })
      const campaign = await campaignRes.json()

      const sendRes = await fetch(`/api/campaigns/${campaign.id}/send?tenant=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientIds: effectiveRecipientIds })
      })
      const result = await sendRes.json()
      setSentResult(result)
      setSent(true)
      onSent?.()
    } catch (e) {
      console.error(e)
    } finally {
      setIsSending(false)
    }
  }

  if (sent && sentResult) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: spacing.lg, padding: spacing['4xl'] }}>
        <div style={{ width: '48px', height: '48px', background: colors.successLight, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>✓</div>
        <h3 style={{ fontSize: typography.sizeXl, fontWeight: typography.weightSemibold, color: colors.text, margin: 0 }}>Message sent</h3>
        <p style={{ fontSize: typography.sizeMd, color: colors.textSecondary, margin: 0, textAlign: 'center' }}>
          Delivered to {sentResult.sent} contacts.
          {sentResult.failed > 0 && ` ${sentResult.failed} failed.`}
        </p>
        <Button
          variant="secondary"
          onClick={() => { setSent(false); setSentResult(null); setMessage(''); setMediaUrl(''); setSensitiveCheck(null); setRemovedIds(new Set()) }}
          style={{ marginTop: spacing.sm }}
        >
          Send another
        </Button>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', height: '100%', overflow: 'hidden' }}>
      {/* Left column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg, padding: spacing['2xl'], overflowY: 'auto' }}>

        {/* Context header */}
        {mode === 'single' && contactContext ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: '0 0 4px' }}>
            <Avatar firstName={contactContext.first_name} lastName={contactContext.last_name} size={36} />
            <div>
              <div style={{ fontSize: typography.sizeLg, fontWeight: typography.weightSemibold, color: colors.text, fontFamily: typography.fontSans }}>
                {contactContext.first_name} {contactContext.last_name}
              </div>
              <div style={{ fontSize: typography.sizeSm, color: colors.textSecondary, marginTop: '2px', fontFamily: typography.fontSans }}>
                {[
                  contactContext.custom_fields?.instrument || contactContext.custom_fields?.subject,
                  contactContext.custom_fields?.instructor || contactContext.custom_fields?.session_day,
                  contactContext.last_attended ? `Last attended ${new Date(contactContext.last_attended).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : null
                ].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: typography.sizeBase, color: colors.textSecondary, fontFamily: typography.fontSans, marginBottom: spacing.lg }}>
            {effectiveCount} {effectiveCount === 1 ? 'recipient' : 'recipients'}
            {removedIds.size > 0 && <span style={{ color: colors.textMuted }}> ({removedIds.size} removed)</span>}
            {filterExplanation && ` · ${filterExplanation}`}
          </div>
        )}

        {/* Inline warnings */}
        {sensitiveCheck && (sensitiveCheck.flagged.length > 0 || sensitiveCheck.opted_out.length > 0) && (
          mode === 'single' ? (
            <div style={{ background: colors.warningLight, border: `1px solid ${colors.warningBorder}`, borderRadius: radius.md, padding: `${spacing.sm} ${spacing.md}` }}>
              <div style={{ fontSize: typography.sizeSm, fontWeight: typography.weightSemibold, color: colors.warning }}>
                {sensitiveCheck.opted_out.length > 0 && `Contact has opted out. `}
                {sensitiveCheck.flagged.length > 0 && `Contact needs attention: ${sensitiveCheck.flagged.map(c => c.note).filter(Boolean).join(', ')}`}
              </div>
              <div style={{ fontSize: typography.sizeSm, color: colors.warning, marginTop: spacing.xs }}>
                Messages to opted-out contacts will not be delivered.
              </div>
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {sensitiveCheck.opted_out.filter(c => !removedIds.has(c.id)).length > 0 && (
              <div style={{ background: colors.warningLight, border: `1px solid ${colors.warningBorder}`, borderRadius: radius.md, padding: `${spacing.sm} ${spacing.md}` }}>
                <div style={{ fontSize: typography.sizeSm, fontWeight: typography.weightSemibold, color: colors.warning, marginBottom: spacing.xs }}>
                  {sensitiveCheck.opted_out.length} opted out
                </div>
                {sensitiveCheck.opted_out
                  .filter(c => !removedIds.has(c.id))
                  .map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs }}>
                      <span style={{ fontSize: typography.sizeSm, color: colors.warning }}>{c.name}</span>
                      <button
                        onClick={() => setRemovedIds(prev => new Set([...prev, c.id]))}
                        style={{ fontSize: typography.sizeXs, color: colors.warning, background: 'transparent', border: `1px solid ${colors.warningBorder}`, borderRadius: radius.sm, padding: '2px 8px', cursor: 'pointer', fontFamily: typography.fontSans }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
              </div>
            )}
            {sensitiveCheck.flagged.filter(c => !removedIds.has(c.id)).length > 0 && (
              <div style={{ background: colors.warningLight, border: `1px solid ${colors.warningBorder}`, borderRadius: radius.md, padding: `${spacing.sm} ${spacing.md}` }}>
                <div style={{ fontSize: typography.sizeSm, fontWeight: typography.weightSemibold, color: colors.warning, marginBottom: spacing.xs }}>
                  {sensitiveCheck.flagged.filter(c => !removedIds.has(c.id)).length} needs your attention
                </div>
                {sensitiveCheck.flagged
                  .filter(c => !removedIds.has(c.id))
                  .map(c => (
                    <div key={c.id} style={{ marginBottom: spacing.sm }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: typography.sizeSm, fontWeight: typography.weightMedium, color: colors.warning }}>{c.name}</span>
                        <button
                          onClick={() => setRemovedIds(prev => new Set([...prev, c.id]))}
                          style={{ fontSize: typography.sizeXs, color: colors.warning, background: 'transparent', border: `1px solid ${colors.warningBorder}`, borderRadius: radius.sm, padding: '2px 8px', cursor: 'pointer', fontFamily: typography.fontSans }}
                        >
                          Remove
                        </button>
                      </div>
                      {c.note && (
                        <div style={{ fontSize: typography.sizeXs, color: colors.textSecondary, marginTop: '2px', fontStyle: 'italic' }}>
                          &ldquo;{c.note.slice(0, 80)}{c.note.length > 80 ? '...' : ''}&rdquo;
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
          )
        )}

        {/* Message textarea with AI assist */}
        <div>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Write your message... Use {first_name} to personalize."
            style={{
              height: '120px',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
            <button
              onClick={handleAiDraft}
              disabled={aiLoading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                background: aiLoading ? colors.borderLight : message.trim() ? colors.espresso : colors.borderLight,
                color: aiLoading ? colors.textMuted : message.trim() ? 'white' : colors.textSecondary,
                border: 'none', borderRadius: radius.sm, padding: `${spacing.xs} ${spacing.sm}`,
                fontSize: typography.sizeSm, cursor: aiLoading ? 'not-allowed' : 'pointer', fontFamily: typography.fontSans,
              }}
            >
              {prePolishMessage.current && !aiLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUndoPolish() }}
                    style={{
                      background: 'transparent', border: 'none', color: 'inherit',
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit',
                      fontWeight: typography.weightSemibold, textDecoration: 'underline'
                    }}
                  >
                    Undo
                  </button>
                  <span style={{ color: colors.border }}>|</span>
                  <Sparkles size={12} /> {aiLoading ? 'Writing...' : message.trim() ? 'Polish with AI' : 'Draft with AI'}
                </span>
              ) : (
                <><Sparkles size={12} /> {aiLoading ? 'Writing...' : message.trim() ? 'Polish with AI' : 'Draft with AI'}</>
              )}
            </button>
          </div>

          {/* Char count + media */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing.xs, fontSize: typography.sizeSm, color: colors.textMuted }}>
            <button
              onClick={() => setShowMediaInput(!showMediaInput)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing.xs,
                background: showMediaInput || isMMS ? colors.espresso : colors.surface,
                color: showMediaInput || isMMS ? 'white' : colors.textSecondary,
                border: `1px solid ${colors.border}`, borderRadius: radius.md,
                padding: `${spacing.xs} ${spacing.md}`, fontSize: typography.sizeBase, cursor: 'pointer',
                fontFamily: typography.fontSans,
              }}
            >
              <Paperclip size={13} />
              {isMMS ? 'Media attached' : 'Attach image or GIF'}
            </button>
            <span>{isMMS ? 'MMS' : `${message.length} / 160`}</span>
          </div>
        </div>

        {/* Media URL input */}
        {showMediaInput && (
          <div style={{ display: 'flex', gap: spacing.sm }}>
            <Input
              type="text"
              value={mediaUrl}
              onChange={e => setMediaUrl(e.target.value)}
              placeholder="Paste Cloudinary or image URL..."
            />
            {mediaUrl && (
              <button onClick={() => setMediaUrl('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textSecondary }}>
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Cost line */}
        {message.trim().length > 0 && (
          <div style={{ fontSize: typography.sizeSm, color: colors.textMuted, textAlign: 'center' }}>
            SMS · {effectiveSendCount} messages · ~${(effectiveSendCount * (isMMS ? 0.02 : 0.0083)).toFixed(2)}
          </div>
        )}

        {/* Send button */}
        <Button
          variant="primary"
          onClick={handleSend}
          disabled={!message.trim() || effectiveCount === 0 || isSending}
          size="lg"
          style={{ background: !message.trim() || effectiveCount === 0 || isSending ? undefined : colors.crimson }}
        >
          {isSending ? 'Sending...' : 'Send message'}
        </Button>
      </div>

      {/* Right column — phone preview */}
      <div style={{ background: colors.backgroundSecondary, borderLeft: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: `${spacing['4xl']} ${spacing['3xl']}` }}>
        <div>
          <div style={{ fontSize: typography.sizeSm, fontWeight: typography.weightSemibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: spacing.sm, textAlign: 'center' }}>Preview</div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: '240px',
              height: '520px',
              background: '#1A1A1A',
              borderRadius: '52px',
              border: '8px solid #1A1A1A',
              boxShadow: '0 0 0 1px #3A3A3A, 0 20px 60px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}>
              <div style={{ background: '#1A1A1A', height: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: '80px', height: '22px', background: '#000', borderRadius: '20px' }} />
              </div>
              <div style={{ flex: 1, background: '#F2F2F7', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '4px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#1A1A1A' }}>
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <div style={{ width: '12px', height: '7px', border: '1px solid #1A1A1A', borderRadius: '2px', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '1px', top: '1px', right: '1px', bottom: '1px', background: '#1A1A1A', borderRadius: '1px' }} />
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                  <div style={{ width: '36px', height: '36px', background: colors.crimson, borderRadius: '50%', margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'white', fontWeight: 600 }}>H</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#1A1A1A' }}>Headliner</div>
                  <div style={{ fontSize: '10px', color: '#8E8E93' }}>text message</div>
                </div>
                <div style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '4px', overflow: 'hidden' }}>
                  <div style={{ fontSize: '10px', color: '#8E8E93', textAlign: 'center', marginBottom: '4px' }}>Today</div>
                  {mediaUrl && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <img src={mediaUrl} alt="MMS" style={{ maxWidth: '120px', borderRadius: '12px 12px 4px 12px' }} onError={e => (e.currentTarget.style.display = 'none')} />
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{
                      background: '#007AFF', color: 'white',
                      borderRadius: '16px 16px 4px 16px',
                      padding: '7px 10px', fontSize: '13px', lineHeight: 1.5,
                      maxWidth: '75%', wordBreak: 'break-word',
                    }}>
                      {previewMessage}
                    </div>
                  </div>
                  {sent && <div style={{ textAlign: 'right', fontSize: '9px', color: '#8E8E93' }}>Delivered</div>}
                </div>
                <div style={{ padding: '6px 8px', borderTop: '1px solid #E8E8E4', display: 'flex', alignItems: 'center', gap: '6px', background: '#F2F2F7', flexShrink: 0 }}>
                  <div style={{ flex: 1, background: 'white', borderRadius: '16px', border: '1px solid #E8E8E4', padding: '5px 10px', fontSize: '11px', color: '#C8C8CC' }}>iMessage</div>
                  <div style={{ width: '22px', height: '22px', background: '#007AFF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'white', fontSize: '12px', lineHeight: 1 }}>↑</span>
                  </div>
                </div>
              </div>
              <div style={{ background: '#1A1A1A', height: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: '60px', height: '4px', background: '#3A3A3A', borderRadius: '4px' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}