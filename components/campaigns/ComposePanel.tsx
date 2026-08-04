'use client'
import { useState, useEffect } from 'react'
import { Paperclip, X, Sparkles } from 'lucide-react'

interface ComposePanelProps {
  recipientCount: number
  filterExplanation: string
  recipientIds: string[]
  channel?: 'sms' | 'email'
  onClose?: () => void
  onSent?: () => void
}

export default function ComposePanel({
  recipientCount, filterExplanation, recipientIds, channel = 'sms', onClose, onSent
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
  const [sendTo, setSendTo] = useState<'account_holders' | 'students' | 'both'>('account_holders')
  const [sent, setSent] = useState(false)
  const [sentResult, setSentResult] = useState<{ sent: number, failed: number } | null>(null)

  const isMMS = !!mediaUrl
  const firstNamePreview = 'Alex'
  const previewMessage = message.replace(/\{first_name\}/gi, firstNamePreview) || 'Your message will appear here...'
  const effectiveRecipientIds = recipientIds.filter(id => !removedIds.has(id))
  const effectiveCount = effectiveRecipientIds.length
  const effectiveSendCount = sendTo === 'both' ? effectiveCount * 2 : effectiveCount

  // Auto-run sensitive check when recipientIds changes
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
    try {
      const res = await fetch('/api/draft-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: message.trim() || 'Write a warm, friendly message',
          recipient_context: filterExplanation,
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

  const handleSend = async () => {
    if (!message.trim() || effectiveCount === 0) return
    setIsSending(true)
    try {
      const campaignRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          message,
          media_url: mediaUrl || null,
          filter_query: filterExplanation,
          recipient_count: effectiveSendCount,
          send_to: sendTo,
          status: 'sending',
        })
      })
      const campaign = await campaignRes.json()

      const sendRes = await fetch(`/api/campaigns/${campaign.id}/send`, {
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', padding: '48px' }}>
        <div style={{ width: '48px', height: '48px', background: '#F0FDF4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>✓</div>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1A1A1A', margin: 0 }}>Message sent</h3>
        <p style={{ fontSize: '14px', color: '#6B6B6B', margin: 0, textAlign: 'center' }}>
          Delivered to {sentResult.sent} contacts.
          {sentResult.failed > 0 && ` ${sentResult.failed} failed.`}
        </p>
        <button
          onClick={() => { setSent(false); setSentResult(null); setMessage(''); setMediaUrl(''); setSensitiveCheck(null); setRemovedIds(new Set()) }}
          style={{ background: 'transparent', border: '1px solid #E8E8E4', borderRadius: '8px', padding: '8px 20px', fontSize: '14px', cursor: 'pointer', fontFamily: 'sans-serif', marginTop: '8px' }}
        >
          Send another
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', height: '100%', overflow: 'hidden' }}>

      {/* Left column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px', overflowY: 'auto' }}>

        {/* Recipient subtitle */}
        <div style={{ fontSize: '13px', color: '#6B6B6B', marginBottom: '16px' }}>
          {effectiveCount} {effectiveCount === 1 ? 'recipient' : 'recipients'}
          {removedIds.size > 0 && <span style={{ color: '#A0A0A0' }}> ({removedIds.size} removed)</span>}
          {filterExplanation && ` · ${filterExplanation}`}
        </div>

        {/* Send to toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <span style={{ color: '#6B6B6B' }}>Send to</span>
          {(['account_holders', 'students', 'both'] as const).map(option => (
            <button
              key={option}
              onClick={() => setSendTo(option)}
              style={{
                padding: '3px 10px',
                borderRadius: '20px',
                border: '1px solid',
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'sans-serif',
                background: sendTo === option ? '#1A1A1A' : 'white',
                color: sendTo === option ? 'white' : '#6B6B6B',
                borderColor: sendTo === option ? '#1A1A1A' : '#E8E8E4',
              }}
            >
              {option === 'account_holders' ? 'Account holders' : option === 'students' ? 'Students' : 'Both'}
            </button>
          ))}
        </div>

        {/* Inline warnings */}
        {sensitiveCheck && (sensitiveCheck.flagged.length > 0 || sensitiveCheck.opted_out.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sensitiveCheck.opted_out.length > 0 && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#92400E', marginBottom: '6px' }}>
                  {sensitiveCheck.opted_out.length} opted out
                </div>
                {sensitiveCheck.opted_out
                  .filter(c => !removedIds.has(c.id))
                  .map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#92400E' }}>{c.name}</span>
                      <button
                        onClick={() => setRemovedIds(prev => new Set([...prev, c.id]))}
                        style={{ fontSize: '11px', color: '#92400E', background: 'transparent', border: '1px solid #FDE68A', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontFamily: 'sans-serif' }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
              </div>
            )}
            {sensitiveCheck.flagged.length > 0 && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#991B1B', marginBottom: '6px' }}>
                  {sensitiveCheck.flagged.filter(c => !removedIds.has(c.id)).length} flagged for attention
                </div>
                {sensitiveCheck.flagged
                  .filter(c => !removedIds.has(c.id))
                  .map(c => (
                    <div key={c.id} style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: '#991B1B' }}>{c.name}</span>
                        <button
                          onClick={() => setRemovedIds(prev => new Set([...prev, c.id]))}
                          style={{ fontSize: '11px', color: '#991B1B', background: 'transparent', border: '1px solid #FECACA', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontFamily: 'sans-serif' }}
                        >
                          Remove
                        </button>
                      </div>
                      {c.note && (
                        <div style={{ fontSize: '11px', color: '#6B6B6B', marginTop: '2px', fontStyle: 'italic' }}>
                          "{c.note.slice(0, 80)}{c.note.length > 80 ? '...' : ''}"
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Message textarea with AI assist */}
        <div>
          <div style={{ position: 'relative' }}>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write your message... Use {first_name} to personalize."
              style={{
                width: '100%', height: '120px', border: '1px solid #E8E8E4', borderRadius: '10px',
                padding: '12px 12px 40px', fontSize: '13px', fontFamily: 'sans-serif',
                resize: 'none', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleAiDraft}
              disabled={aiLoading}
              style={{
                position: 'absolute', bottom: '10px', left: '10px',
                display: 'flex', alignItems: 'center', gap: '5px',
                background: aiLoading ? '#E8E8E4' : message.trim() ? '#1A1A1A' : '#F0F0EC',
                color: aiLoading ? '#A0A0A0' : message.trim() ? 'white' : '#6B6B6B',
                border: 'none', borderRadius: '6px', padding: '5px 10px',
                fontSize: '12px', cursor: aiLoading ? 'not-allowed' : 'pointer', fontFamily: 'sans-serif',
              }}
            >
              <Sparkles size={12} /> {aiLoading ? 'Writing...' : message.trim() ? 'Polish with AI' : 'Draft with AI'}
            </button>
          </div>

          {/* Char count + media */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '12px', color: '#A0A0A0' }}>
            <button
              onClick={() => setShowMediaInput(!showMediaInput)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: showMediaInput || isMMS ? '#1A1A1A' : 'white',
                color: showMediaInput || isMMS ? 'white' : '#6B6B6B',
                border: '1px solid #E8E8E4', borderRadius: '8px',
                padding: '7px 12px', fontSize: '13px', cursor: 'pointer',
                fontFamily: 'sans-serif',
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={mediaUrl}
              onChange={e => setMediaUrl(e.target.value)}
              placeholder="Paste Cloudinary or image URL..."
              style={{ flex: 1, border: '1px solid #E8E8E4', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', fontFamily: 'sans-serif', outline: 'none' }}
            />
            {mediaUrl && (
              <button onClick={() => setMediaUrl('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6B6B6B' }}>
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Cost line */}
        <div style={{ fontSize: '12px', color: '#A0A0A0', textAlign: 'center' }}>
          SMS · {effectiveSendCount} messages · ~${(effectiveSendCount * (isMMS ? 0.02 : 0.0083)).toFixed(2)}
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!message.trim() || effectiveCount === 0 || isSending}
          style={{
            background: !message.trim() || effectiveCount === 0 || isSending ? '#E8E8E4' : '#C8392B',
            color: !message.trim() || effectiveCount === 0 || isSending ? '#A0A0A0' : 'white',
            border: 'none', borderRadius: '10px', padding: '12px',
            fontSize: '14px', fontWeight: 600, cursor: !message.trim() || effectiveCount === 0 || isSending ? 'not-allowed' : 'pointer',
            fontFamily: 'sans-serif', width: '100%',
          }}
        >
          {isSending ? 'Sending...' : 'Send message'}
        </button>
      </div>

      {/* Right column — phone preview */}
      <div style={{ background: '#F8F8F7', borderLeft: '1px solid #E8E8E4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#A0A0A0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px', textAlign: 'center' }}>Preview</div>
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
              {/* Dynamic island */}
              <div style={{ background: '#1A1A1A', height: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: '80px', height: '22px', background: '#000', borderRadius: '20px' }} />
              </div>
              {/* Screen */}
              <div style={{ flex: 1, background: '#F2F2F7', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Status bar */}
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
                {/* iMessage header */}
                <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                  <div style={{ width: '36px', height: '36px', background: '#C8392B', borderRadius: '50%', margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'white', fontWeight: 600 }}>H</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#1A1A1A' }}>Headliner</div>
                  <div style={{ fontSize: '10px', color: '#8E8E93' }}>text message</div>
                </div>
                {/* Message area */}
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
                  <div style={{ textAlign: 'right', fontSize: '9px', color: '#8E8E93' }}>Delivered</div>
                </div>
                {/* iMessage input bar */}
                <div style={{ padding: '6px 8px', borderTop: '1px solid #E8E8E4', display: 'flex', alignItems: 'center', gap: '6px', background: '#F2F2F7', flexShrink: 0 }}>
                  <div style={{ flex: 1, background: 'white', borderRadius: '16px', border: '1px solid #E8E8E4', padding: '5px 10px', fontSize: '11px', color: '#C8C8CC' }}>iMessage</div>
                  <div style={{ width: '22px', height: '22px', background: '#007AFF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'white', fontSize: '12px', lineHeight: 1 }}>↑</span>
                  </div>
                </div>
              </div>
              {/* Home bar */}
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