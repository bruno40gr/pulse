'use client'
import { useState, useEffect, useRef } from 'react'
import { CheckSquare, Image as ImageIcon, Paperclip, Sparkles, Square, X } from 'lucide-react'
import { LoadingButton, Avatar, Textarea, Input, Badge, SurfacePanel, Tabs } from '@/components/ui'
import { colors, typography, radius, spacing, shadows } from '@/lib/tokens'
import { DEFAULT_TENANT, getActiveTenantId, shouldUseDemoPhotos, getContactDemoAvatarUrl, getStaffDemoAvatarUrl, getTenantBrand } from '@/lib/tenant'
import type { MediaAsset, MediaSuggestionResponse, MessageIntent } from '@/lib/media-catalog'
import { useIsMobile } from '@/lib/useMediaQuery'

const SACRAMENTO_MARTIAL_ARTS = '00000000-0000-0000-0000-000000000002'
const KUMON = '00000000-0000-0000-0000-000000000003'

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
    avatar_src?: string
  }>
  footerLeadingAction?: React.ReactNode
}

interface ResolvedPreviewRecipient {
  id: string
  first_name: string
  last_name: string
  avatar_src?: string
}

export default function ComposePanel({
  recipientCount, filterExplanation, recipientIds, initialMessage = '', channel = 'sms', onClose, onSent,
  mode = 'bulk', contactContext, composeSource = 'scratch', composeIntent = 'neutral', internalComms = false, internalCommsLabel = 'Internal comms', internalCommsDescription = 'Use for coordination, coaching, and team follow-up.', recipientPreview = [], footerLeadingAction
}: ComposePanelProps) {
  const isInsightCompose = composeSource === 'insight'
  const isMobile = useIsMobile()
  const [brandVoice, setBrandVoice] = useState('')
  const [brandVoiceLoaded, setBrandVoiceLoaded] = useState(false)
  const [message, setMessage] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [showMediaInput, setShowMediaInput] = useState(false)
  const [activeMediaTab, setActiveMediaTab] = useState<'approved' | 'gifs'>('approved')
  const [aiLoading, setAiLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendProgress, setSendProgress] = useState(0)
  const sendProgressTimer = useRef<number | null>(null)
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
  const [sentResult, setSentResult] = useState<{ sent: number, failed: number, missing_phone?: number } | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [resolvedRecipientPreview, setResolvedRecipientPreview] = useState<ResolvedPreviewRecipient[]>(recipientPreview)
  const prePolishMessage = useRef<string>('')

  const isMMS = !!mediaUrl
  const firstNamePreview = contactContext?.first_name || 'Alex'
  const previewMessage = message.replace(/\{first_name\}/gi, firstNamePreview) || 'Your message will appear here...'
  const effectiveRecipientIds = recipientIds.filter(id => !removedIds.has(id))
  const effectiveCount = effectiveRecipientIds.length
  const effectiveSendCount = effectiveCount
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT)
  const tenantBrand = getTenantBrand(tenantId)
  const recipientSummary = resolvedRecipientPreview.slice(0, 3)
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
    setTenantId(getActiveTenantId())
  }, [])

  useEffect(() => {
    setResolvedRecipientPreview(recipientPreview)
  }, [recipientPreview])

  useEffect(() => {
    const seededPreview = recipientPreview.slice(0, 3)
    const previewNeedsHydration = seededPreview.length === 0 || seededPreview.some(recipient => !recipient.avatar_src)
    if (!previewNeedsHydration || recipientIds.length === 0) return

    let cancelled = false

    const hydrateRecipientPreview = async () => {
      try {
        const [contactsRes, staffRes] = await Promise.all([
          fetch(`/api/contacts?tenant=${tenantId}`).then(r => r.json()).catch(() => []),
          fetch(`/api/staff?tenant=${tenantId}`).then(r => r.json()).catch(() => []),
        ])

        const contacts = Array.isArray(contactsRes) ? contactsRes : []
        const staff = Array.isArray(staffRes) ? staffRes : []

        const contactsById = new Map(contacts.map(contact => [contact.id, contact]))
        const staffByPersonId = new Map(staff.map(member => [member.person_id, member]))

        const hydrated = recipientIds.slice(0, 3).map(id => {
          const seeded = seededPreview.find(recipient => recipient.id === id)
          const contact = contactsById.get(id)
          if (contact) {
            return {
              id,
              first_name: contact.first_name,
              last_name: contact.last_name,
              avatar_src: shouldUseDemoPhotos(tenantId)
                ? getContactDemoAvatarUrl(tenantId, contact)
                : seeded?.avatar_src,
            }
          }

          const staffMember = staffByPersonId.get(id)
          if (staffMember) {
            return {
              id,
              first_name: staffMember.first_name || seeded?.first_name || '',
              last_name: staffMember.last_name || seeded?.last_name || '',
              avatar_src: shouldUseDemoPhotos(tenantId)
                ? getStaffDemoAvatarUrl(tenantId, {
                    first_name: staffMember.first_name || '',
                    last_name: staffMember.last_name || '',
                  })
                : seeded?.avatar_src,
            }
          }

          return seeded
        }).filter(Boolean) as ResolvedPreviewRecipient[]

        if (!cancelled && hydrated.length > 0) {
          setResolvedRecipientPreview(hydrated)
        }
      } catch {
        // Keep seeded preview if hydration fails
      }
    }

    hydrateRecipientPreview()

    return () => {
      cancelled = true
    }
  }, [recipientIds, recipientPreview, tenantId])

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

  const startSendProgress = () => {
    setSendProgress(6)
    if (sendProgressTimer.current) clearInterval(sendProgressTimer.current)
    const start = Date.now()
    sendProgressTimer.current = window.setInterval(() => {
      const elapsed = Date.now() - start
      // Decelerating creep toward 92% so the bar fills in lockstep with real send time.
      const pct = 6 + 86 * (1 - Math.exp(-elapsed / 1100))
      setSendProgress(Math.min(pct, 92))
    }, 80)
  }

  const finishSendProgress = () => {
    if (sendProgressTimer.current) {
      clearInterval(sendProgressTimer.current)
      sendProgressTimer.current = null
    }
    setSendProgress(100)
    setTimeout(() => {
      setSendProgress(0)
      setIsSending(false)
    }, 240)
  }

  const handleSend = async () => {
    if (!message.trim() || effectiveCount === 0) return
    setIsSending(true)
    setSendError(null)
    startSendProgress()
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

      if (!result.ok || result.error) {
        setSendError(result.error || 'The message could not be sent. Please try again.')
        return
      }

      if (result.sent === 0) {
        setSendError('Nothing was sent. The selected recipients are missing a phone number.')
        return
      }

      setSentResult(result)
      setSent(true)
      setMessage('')
      setMediaUrl('')
      setSensitiveCheck(null)
      setRemovedIds(new Set())
      onSent?.()
    } catch (e) {
      console.error(e)
      setSendError('The message could not be sent. Please try again.')
    } finally {
      finishSendProgress()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: colors.background, overflow: 'hidden' }}>
      <div style={{
        display: isMobile ? 'flex' : 'grid',
        flexDirection: isMobile ? 'column' : undefined,
        gridTemplateColumns: isMobile ? undefined : 'minmax(0, 1.2fr) 360px',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        background: colors.background,
      }}>
      {/* Left column / main form */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.lg,
        padding: isMobile ? '16px' : spacing['3xl'],
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        flex: 1,
        minHeight: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}>
        {sent && sentResult && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: `${spacing.sm} ${spacing.md}`, background: colors.surfaceMuted, border: `1px solid ${colors.success}`, borderRadius: radius.md, color: colors.success, fontSize: typography.sizeSm, fontFamily: typography.fontSans }}>
            ✓ Message sent — delivered to {sentResult.sent} {sentResult.sent === 1 ? 'contact' : 'contacts'}.{sentResult.failed > 0 ? ` ${sentResult.failed} failed.` : ''}
          </div>
        )}
        {sendError && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, padding: `${spacing.sm} ${spacing.md}`, background: colors.surfaceMuted, border: `1px solid ${colors.crimson}`, borderRadius: radius.md, color: colors.crimson, fontSize: typography.sizeSm, fontFamily: typography.fontSans }}>
            <span>! {sendError}</span>
            <button onClick={() => setSendError(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: colors.crimson, padding: 0 }}>✕</button>
          </div>
        )}
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
                        <Avatar firstName={recipient.first_name} lastName={recipient.last_name} size={26} src={recipient.avatar_src} />
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: typography.weightSemibold, color: colors.text, fontFamily: typography.fontSans }}>
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

        <SurfacePanel style={{ borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` }}>
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setShowMediaInput(!showMediaInput)
                if (!showMediaInput && mediaSuggestions.approvedImages.length === 0 && mediaSuggestions.suggestedGifs.length === 0) {
                  loadMediaSuggestions(message)
                }
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                background: showMediaInput || isMMS ? colors.surfaceMuted : colors.surface,
                color: showMediaInput || isMMS ? colors.text : colors.textSecondary,
                border: `1px solid ${colors.border}`, borderRadius: radius.md,
                padding: `${spacing.xs} ${spacing.sm}`, fontSize: typography.sizeBase, minHeight: '36px', cursor: 'pointer',
                fontFamily: typography.fontSans,
              }}
            >
              <Paperclip size={13} />
              {isMMS ? 'Media attached' : 'Attach image'}
            </button>
            <button
              onClick={handleAiDraft}
              disabled={aiLoading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                background: aiLoading ? colors.borderLight : colors.surface,
                color: aiLoading ? colors.textMuted : colors.textSecondary,
                border: `1px solid ${colors.border}`, borderRadius: radius.sm, padding: `${spacing.xs} ${spacing.sm}`,
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

          {/* Char count */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: spacing.xs, fontSize: typography.sizeSm, color: colors.textMuted }}>
            <span>{isMMS ? 'MMS' : `${message.length} / 160`}</span>
          </div>
        </SurfacePanel>

        {/* Brand-first media picker */}
        {showMediaInput && (
          <SurfacePanel tone="default" style={{ borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` }}>
            <Tabs
              items={[
                { key: 'approved', label: 'Images', count: mediaSuggestions.approvedImages.length },
                { key: 'gifs', label: 'GIFs', count: mediaSuggestions.suggestedGifs.length },
              ]}
              activeKey={activeMediaTab}
              onChange={(key) => setActiveMediaTab(key as 'approved' | 'gifs')}
              style={{ marginBottom: spacing.md }}
            />

            <div>
              {loadingSuggestions && (
                <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginBottom: spacing.sm }}>
                  Refreshing…
                </div>
              )}
              {((activeMediaTab === 'approved' ? mediaSuggestions.approvedImages : mediaSuggestions.suggestedGifs).length > 0) ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: spacing.sm }}>
                  {(activeMediaTab === 'approved' ? mediaSuggestions.approvedImages : mediaSuggestions.suggestedGifs).map(asset => (
                    <AssetCard key={asset.id} asset={asset} selected={mediaUrl === asset.url} onClick={() => selectMedia(asset)} />
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: `${spacing.md} ${spacing.sm}`,
                  borderRadius: radius.lg,
                  background: colors.surface,
                  fontSize: typography.sizeSm,
                  color: colors.textSecondary,
                  fontFamily: typography.fontSans,
                }}>
                  No media is available for this tab yet. Try the other tab or paste a URL manually.
                </div>
              )}
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
          </SurfacePanel>
        )}

        {/* Cost line */}
        {message.trim().length > 0 && (
          <div style={{ fontSize: typography.sizeSm, color: colors.textMuted, textAlign: 'center' }}>
            SMS · {effectiveSendCount} messages · ~${(effectiveSendCount * (isMMS ? 0.02 : 0.0083)).toFixed(2)}
          </div>
        )}

          </>
        )}
      </div>

      {/* Right column — phone preview (hidden on mobile) */}
      {!isMobile && (
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
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#1A1A1A' }}>{tenantBrand.name}</div>
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
      )}
      </div>
      <div style={{
        padding: isMobile ? '12px 16px' : `${spacing.lg} ${spacing['3xl']}`,
        borderTop: `1px solid ${colors.borderLight}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        gap: '10px',
        flexShrink: 0,
        background: colors.surface,
      }}>
        {footerLeadingAction ? <div style={{ marginRight: 'auto', minWidth: 0 }}>{footerLeadingAction}</div> : null}
        <LoadingButton
          loading={isSending}
          fill={2}
          progress={sendProgress}
          onClick={handleSend}
          disabled={!message.trim() || effectiveCount === 0}
          style={{
            padding: `${spacing.md} ${spacing['3xl']}`,
            fontSize: typography.sizeMd,
            background: !message.trim() || effectiveCount === 0 ? colors.border : colors.crimson,
            maxWidth: '100%',
          }}
        >
          {isSending ? 'Sending…' : 'Send message'}
        </LoadingButton>
      </div>
    </div>
  )
}