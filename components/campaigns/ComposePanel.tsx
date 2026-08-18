'use client'
import { useState, useEffect, useRef } from 'react'
import { CheckSquare, Image as ImageIcon, Paperclip, Sparkles, Square, X } from 'lucide-react'
import { Button, Avatar, Textarea, Input, Badge } from '@/components/ui'
import { colors, typography, radius, spacing } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'
import type { MediaAsset, MediaSuggestionResponse, MessageIntent } from '@/lib/media-catalog'

interface ComposePanelProps {
  recipientCount: number
  filterExplanation: string
  recipientIds: string[]
  initialMessage?: string
  channel?: 'sms' | 'email'
  onClose?: () => void
  onSent?: () => void
  mode?: 'bulk' | 'single'
  contactContext?: {
    id: string
    first_name: string
    last_name: string
    custom_fields?: Record<string, unknown>
    last_attended?: string | null
    notes_history?: {text: string, timestamp: string}[]
  }
  composeSource?: 'insight' | 'scratch'
  composeIntent?: MessageIntent
  internalComms?: boolean
  internalCommsLabel?: string
  internalCommsDescription?: string
  recipientPreview?: Array<{
    id: string
    first_name: string
    last_name: string
  }>
}

export default function ComposePanel({
  recipientCount, filterExplanation, recipientIds, initialMessage = '', channel = 'sms', onClose, onSent,
  mode = 'bulk', contactContext, composeSource = 'scratch', composeIntent = 'neutral', internalComms = false, internalCommsLabel = 'Internal comms', internalCommsDescription = 'Use for coordination, coaching, and team follow-up.', recipientPreview = []
}: ComposePanelProps) {
  const isInsightCompose = composeSource === 'insight'
  const [brandVoice, setBrandVoice] = useState('')
  const [brandVoiceLoaded, setBrandVoiceLoaded] = useState(false)
  const [message, setMessage] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [showMediaInput, setShowMediaInput] = useState(false)
  const [activeMediaTab, setActiveMediaTab] = useState<'approved' | 'gifs'>('approved')
  const [aiLoading, setAiLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [initialDraftReady, setInitialDraftReady] = useState(!initialMessage.trim())
  const [initialMediaReady, setInitialMediaReady] = useState(!isInsightCompose)
  const [mediaSuggestions, setMediaSuggestions] = useState<MediaSuggestionResponse>({ approvedImages: [], suggestedGifs: [], detectedVibes: [], shouldAutoShowMedia: false, shouldShowThumbnails: false })
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
  const tenantId = getActiveTenantId()
  const recipientSummary = recipientPreview.slice(0, 3)
  const remainingRecipientCount = Math.max(effectiveCount - recipientSummary.length, 0)
  const showComposeBootSkeleton = !sent && (
    (initialMessage.trim() && (!brandVoiceLoaded || !initialDraftReady)) ||
    (isInsightCompose && !initialMediaReady)
  )
  const primaryCategory = mediaSuggestions.detectedVibes[0]
  const categoryToBadgeVariant: Record<string, 'risk' | 'opportunity' | 'milestone' | 'nudge'> = {
    celebration: 'milestone',
    birthday: 'milestone',
    reminder: 'nudge',
    encouragement: 'nudge',
    promotional: 'opportunity',
  }
  const composeBadgeVariant = primaryCategory ? categoryToBadgeVariant[primaryCategory] || 'nudge' : null
  const normalizedSensitiveCheck = {
    flagged: Array.isArray(sensitiveCheck?.flagged) ? sensitiveCheck!.flagged : [],
    opted_out: Array.isArray(sensitiveCheck?.opted_out) ? sensitiveCheck!.opted_out : [],
  }

  useEffect(() => {
    fetch(`/api/brand-settings?tenant=${tenantId}`)
      .then(r => r.json())
      .then(data => {
        const combinedVoice = [data?.brand_voice, data?.brand_markdown].filter(Boolean).join('\n\n').trim()
        setBrandVoice(combinedVoice)
        setBrandVoiceLoaded(true)
      })
      .catch(() => setBrandVoiceLoaded(true))
  }, [tenantId])

  useEffect(() => {
    if (!recipientIds.length) return
    fetch('/api/contacts/check-sensitive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_ids: recipientIds })
    })
      .then(r => r.json())
      .then(data => setSensitiveCheck({
        flagged: Array.isArray(data?.flagged) ? data.flagged : [],
        opted_out: Array.isArray(data?.opted_out) ? data.opted_out : [],
      }))
      .catch(() => {})
  }, [recipientIds.join(',')])

  const fallbackDraftFromIntent = () => {
    const firstNameToken = mode === 'single' ? '{first_name}' : ''

    switch (composeIntent) {
      case 'risk':
        return `Hey ${firstNameToken ? `${firstNameToken}, ` : 'there, '}just checking in — we’d love to help you get back into a steady routine. Reply if you’d like help finding the best next step.`
      case 'milestone':
        return `Hey ${firstNameToken ? `${firstNameToken}, ` : 'there, '}we’re so excited to celebrate this milestone with you. Keep it up — we’re proud of the progress so far!`
      case 'opportunity':
        return `Hey ${firstNameToken ? `${firstNameToken}, ` : 'there, '}we’d love to help you take the next step when you’re ready. Reply if you’d like us to help you get started.`
      case 'nudge':
        return `Hey ${firstNameToken ? `${firstNameToken}, ` : 'there, '}just a friendly reminder from us. Let us know if you’d like help getting back into the routine.`
      default:
        return `Hey ${firstNameToken ? `${firstNameToken}, ` : 'there, '}just wanted to check in and say hello. Let us know if there’s anything we can help with.`
    }
  }

  const loadMediaSuggestions = async (draftMessage?: string, reason: 'initial' | 'manual' = 'manual') => {
    setLoadingSuggestions(true)
    try {
      const res = await fetch('/api/media-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          message: draftMessage ?? message,
          context: filterExplanation,
          source: composeSource,
          intent: composeIntent,
        })
      })
      const data = await res.json()
      setMediaSuggestions({
        approvedImages: Array.isArray(data.approvedImages) ? data.approvedImages : [],
        suggestedGifs: Array.isArray(data.suggestedGifs) ? data.suggestedGifs : [],
        detectedVibes: Array.isArray(data.detectedVibes) ? data.detectedVibes : [],
        shouldAutoShowMedia: Boolean(data.shouldAutoShowMedia),
        shouldShowThumbnails: Boolean(data.shouldShowThumbnails),
      })
      if (data.shouldAutoShowMedia) setShowMediaInput(true)
    } catch (e) {
      console.error(e)
    } finally {
      if (reason === 'initial') setInitialMediaReady(true)
      setLoadingSuggestions(false)
    }
  }

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
          brand_voice: brandVoice || 'Warm, calm, friendly, human, and encouraging. Never alarmist, harsh, or overly urgent.',
        })
      })
      const data = await res.json()
      if (data.draft) {
        setMessage(data.draft)
        loadMediaSuggestions(data.draft)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    if (!isInsightCompose) return
    loadMediaSuggestions(message, 'initial')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInsightCompose, tenantId])

  useEffect(() => {
    if (!brandVoiceLoaded) return
    if (!initialMessage.trim()) {
      setInitialDraftReady(true)
      return
    }

    let cancelled = false

    const generateInitialDraft = async () => {
      setAiLoading(true)
      try {
        const res = await fetch('/api/draft-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: initialMessage,
            recipient_context: filterExplanation,
            brand_voice: brandVoice || 'Warm, calm, friendly, human, and encouraging. Never alarmist, harsh, or overly urgent.',
          })
        })
        const data = await res.json()
        if (!cancelled) {
          if (data?.draft?.trim()) setMessage(data.draft)
          else setMessage(fallbackDraftFromIntent())
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) setMessage(fallbackDraftFromIntent())
      } finally {
        if (!cancelled) {
          setAiLoading(false)
          setInitialDraftReady(true)
        }
      }
    }

    generateInitialDraft()

    return () => {
      cancelled = true
    }
  }, [initialMessage, filterExplanation, brandVoice, brandVoiceLoaded, composeIntent, mode])

  const selectMedia = (asset: MediaAsset) => {
    setMediaUrl(current => current === asset.url ? '' : asset.url)
    setShowMediaInput(true)
  }

  const AssetCard = ({ asset, selected, onClick }: { asset: MediaAsset, selected: boolean, onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${selected ? colors.crimson : colors.border}`,
        borderRadius: radius.lg,
        background: colors.surface,
        padding: spacing.sm,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.sm,
        textAlign: 'left',
        boxShadow: selected ? `0 0 0 1px ${colors.crimson} inset` : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.xs }}>
        <div style={{ fontSize: typography.sizeXs, color: colors.textMuted }}>{asset.kind === 'gif' ? 'GIF' : 'Approved'}</div>
        <span style={{ color: selected ? colors.crimson : colors.textMuted, display: 'inline-flex' }}>
          {selected ? <CheckSquare size={16} /> : <Square size={16} />}
        </span>
      </div>
      <img src={asset.thumbnailUrl || asset.url} alt={asset.title} style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: radius.md, background: colors.surfaceMuted }} />
      <div>
        <div style={{ fontSize: typography.sizeSm, fontWeight: typography.weightSemibold, color: colors.text }}>{asset.title}</div>
        <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginTop: 2 }}>{asset.category}</div>
      </div>
    </button>
  )

  const handleUndoPolish = () => {
    if (prePolishMessage.current) {
      setMessage(prePolishMessage.current)
      prePolishMessage.current = ''
    }
  }

  const handleSend = async () => {
    if (!message.trim() || effectiveCount === 0) return
    setIsSending(true)
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
        <div style={{ width: '48px', height: '48px', background: colors.surfaceMuted, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: colors.success }}>✓</div>
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
        {showComposeBootSkeleton ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              <div style={{ width: '48%', height: '18px', borderRadius: radius.sm, background: colors.borderLight, animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
              <div style={{ width: '100%', height: '72px', borderRadius: radius.lg, background: colors.borderLight, animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
            </div>
            <div style={{ width: '100%', minHeight: '120px', borderRadius: radius.lg, background: colors.borderLight, animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
            <div style={{ display: 'flex', gap: spacing.sm }}>
              <div style={{ width: '138px', height: '36px', borderRadius: radius.md, background: colors.borderLight, animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
              <div style={{ flex: 1, height: '36px', borderRadius: radius.md, background: colors.borderLight, animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
            </div>
            <div style={{ width: '100%', minHeight: '188px', borderRadius: radius.xl, background: colors.borderLight, animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
            <div style={{ width: '164px', height: '44px', borderRadius: radius.md, background: colors.borderLight, animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
          </>
        ) : (
          <>

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, marginBottom: spacing.lg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
              {recipientSummary.length > 0 ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', marginRight: spacing.xs }}>
                    {recipientSummary.map((recipient, index) => (
                      <div key={recipient.id} style={{ marginLeft: index === 0 ? 0 : '-8px' }}>
                        <Avatar firstName={recipient.first_name} lastName={recipient.last_name} size={26} />
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: typography.weightNormal, color: colors.text, fontFamily: typography.fontSans }}>
                    {recipientSummary.map(person => `${person.first_name} ${person.last_name}`).join(', ')}
                    {remainingRecipientCount > 0 ? `, and ${remainingRecipientCount} more` : ''}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '16px', fontWeight: typography.weightNormal, color: colors.text, fontFamily: typography.fontSans }}>
                  {effectiveCount} {effectiveCount === 1 ? 'recipient' : 'recipients'}
                </div>
              )}
              {removedIds.size > 0 && <span style={{ color: colors.textMuted, fontSize: typography.sizeSm }}>({removedIds.size} removed)</span>}
            </div>
            {filterExplanation && <div style={{ fontSize: typography.sizeSm, color: colors.textMuted, fontFamily: typography.fontSans }}>{filterExplanation}</div>}
          </div>
        )}

        {/* Inline warnings */}
        {(normalizedSensitiveCheck.flagged.length > 0 || normalizedSensitiveCheck.opted_out.length > 0) && (
          mode === 'single' ? (
            <div style={{ ...typography.bodySmall, color: colors.warning, marginBottom: spacing.sm }}>
              {normalizedSensitiveCheck.opted_out.length > 0 && `Contact has opted out. `}
              {normalizedSensitiveCheck.flagged.length > 0 && `Contact needs attention: ${normalizedSensitiveCheck.flagged.map(c => c.note).filter(Boolean).join(', ')}`}
              {normalizedSensitiveCheck.opted_out.length > 0 && ' Messages to opted-out contacts will not be delivered.'}
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {normalizedSensitiveCheck.opted_out.filter(c => !removedIds.has(c.id)).length > 0 && (
              <div style={{ marginBottom: spacing.md }}>
                <div style={{ ...typography.bodySmall, fontWeight: typography.weightSemibold, color: colors.warning, marginBottom: spacing.xs }}>
                  {normalizedSensitiveCheck.opted_out.length} opted out
                </div>
                {normalizedSensitiveCheck.opted_out
                  .filter(c => !removedIds.has(c.id))
                  .map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs }}>
                      <span style={{ ...typography.bodySmall, color: colors.warning }}>{c.name}</span>
                      <button
                        onClick={() => setRemovedIds(prev => new Set([...prev, c.id]))}
                        style={{ ...typography.helper, color: colors.warning, background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: radius.sm, padding: '2px 8px', cursor: 'pointer', fontFamily: typography.fontSans }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
              </div>
            )}
            {normalizedSensitiveCheck.flagged.filter(c => !removedIds.has(c.id)).length > 0 && (
              <div style={{ marginBottom: spacing.md }}>
                <div style={{ ...typography.bodySmall, fontWeight: typography.weightSemibold, color: colors.warning, marginBottom: spacing.xs }}>
                  {normalizedSensitiveCheck.flagged.filter(c => !removedIds.has(c.id)).length} needs your attention
                </div>
                {normalizedSensitiveCheck.flagged
                  .filter(c => !removedIds.has(c.id))
                  .map(c => (
                    <div key={c.id} style={{ marginBottom: spacing.sm }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ ...typography.bodySmall, fontWeight: typography.weightMedium, color: colors.warning }}>{c.name}</span>
                        <button
                          onClick={() => setRemovedIds(prev => new Set([...prev, c.id]))}
                          style={{ ...typography.helper, color: colors.warning, background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: radius.sm, padding: '2px 8px', cursor: 'pointer', fontFamily: typography.fontSans }}
                        >
                          Remove
                        </button>
                      </div>
                      {c.note && (
                        <div style={{ ...typography.helper, color: colors.textSecondary, marginTop: '2px', fontStyle: 'italic' }}>
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
          {brandVoiceLoaded && !brandVoice && (
            <div style={{
              marginBottom: spacing.sm,
              padding: `${spacing.sm} ${spacing.md}`,
              borderRadius: radius.md,
              background: '#F8FAFC',
              border: `1px solid ${colors.border}`,
              fontSize: typography.sizeSm,
              color: colors.textSecondary,
              fontFamily: typography.fontSans,
            }}>
              <strong>Tip:</strong> Set up your brand voice so AI can write more like your business.
            </div>
          )}
          {composeBadgeVariant && (
            <div style={{ marginBottom: spacing.xs }}>
              <Badge variant={composeBadgeVariant} size="md">
                {composeBadgeVariant}
              </Badge>
            </div>
          )}
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
                fontSize: typography.sizeBase, minHeight: '36px', cursor: aiLoading ? 'not-allowed' : 'pointer', fontFamily: typography.fontSans,
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
              onClick={() => {
                setShowMediaInput(!showMediaInput)
                if (!showMediaInput && mediaSuggestions.approvedImages.length === 0 && mediaSuggestions.suggestedGifs.length === 0) {
                  loadMediaSuggestions(message)
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing.xs,
                background: showMediaInput || isMMS ? colors.espresso : colors.surface,
                color: showMediaInput || isMMS ? 'white' : colors.textSecondary,
                border: `1px solid ${colors.border}`, borderRadius: radius.md,
                padding: `${spacing.xs} ${spacing.sm}`, fontSize: typography.sizeBase, minHeight: '36px', cursor: 'pointer',
                fontFamily: typography.fontSans,
              }}
            >
              <Paperclip size={13} />
              {isMMS ? 'Media attached' : 'Attach image or GIF'}
            </button>
            <span>{isMMS ? 'MMS' : `${message.length} / 160`}</span>
          </div>
        </div>

        {/* Brand-first media picker */}
        {showMediaInput && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, padding: spacing.lg, border: `1px solid ${colors.border}`, borderRadius: radius.xl, background: colors.surfaceMuted }}>
            <div style={{ display: 'flex', gap: spacing.xs, borderBottom: `1px solid ${colors.border}` }}>
              {[
                { key: 'approved', label: 'Headliner images', count: mediaSuggestions.approvedImages.length },
                { key: 'gifs', label: 'GIFs', count: mediaSuggestions.suggestedGifs.length },
              ].map(tab => {
                const active = activeMediaTab === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveMediaTab(tab.key as 'approved' | 'gifs')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `2px solid ${active ? colors.crimson : 'transparent'}`,
                      marginBottom: '-1px',
                      padding: `${spacing.sm} ${spacing.md}`,
                      fontSize: typography.sizeSm,
                      fontWeight: active ? typography.weightSemibold : typography.weightMedium,
                      color: active ? colors.text : colors.textMuted,
                      cursor: 'pointer',
                      fontFamily: typography.fontSans,
                    }}
                  >
                    {tab.label} <span style={{ color: colors.textMuted }}>({tab.count})</span>
                  </button>
                )
              })}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <div>
                  <div style={{ fontSize: typography.sizeSm, fontWeight: typography.weightSemibold, color: colors.text }}>
                    {activeMediaTab === 'approved' ? 'Headliner images' : 'Suggested GIFs'}
                  </div>
                  <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginTop: 2 }}>
                    {activeMediaTab === 'approved'
                      ? (mediaSuggestions.shouldShowThumbnails
                        ? 'Smart suggestions for celebratory, milestone, and nurturing opportunity messages.'
                        : 'Brand-safe images are always available when you explicitly attach media.')
                      : (mediaSuggestions.shouldShowThumbnails
                        ? 'School-appropriate animated options for upbeat moments only.'
                        : 'GIFs are available on demand when you explicitly choose to attach media.')}
                  </div>
                </div>
                <div style={{ fontSize: typography.sizeXs, color: colors.textMuted }}>{loadingSuggestions ? 'Refreshing…' : mediaUrl ? '1 selected' : 'No image selected'}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: spacing.sm }}>
                {(activeMediaTab === 'approved' ? mediaSuggestions.approvedImages : mediaSuggestions.suggestedGifs).map(asset => (
                  <AssetCard key={asset.id} asset={asset} selected={mediaUrl === asset.url} onClick={() => selectMedia(asset)} />
                ))}
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: spacing.md }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm, fontSize: typography.sizeSm, fontWeight: typography.weightSemibold, color: colors.text }}>
                <ImageIcon size={14} /> Paste URL manually
              </div>
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
            </div>
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
          </>
        )}
      </div>

      {/* Right column — phone preview */}
      <div style={{ background: colors.backgroundSecondary, borderLeft: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: `${spacing['4xl']} ${spacing['3xl']}` }}>
        {showComposeBootSkeleton ? (
          <div style={{ width: '240px', height: '520px', borderRadius: '52px', background: '#E5E7EB', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
        ) : (
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
        )}
      </div>
    </div>
  )
}