'use client'

import { ControlButton } from '@/components/ui/ControlButton'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getActiveTenantId } from '@/lib/tenant'
import { colors, typography, spacing, radius } from '@/lib/tokens'
import { Badge } from '@/components/ui'
import { EmptyState } from '@/components/ui'
import { Button } from '@/components/ui'
import { PageHeader } from '@/components/ui'
import { PageContainer } from '@/components/ui/PageContainer'
import { EmailCampaignHistory } from '@/components/campaigns/EmailCampaignHistory'
import { Notice } from '@/components/ui/Notice'

interface CampaignStats {
  total: number
  delivered: number
  failed: number
  pending: number
  replies: number
  delivery_rate: number
}

interface Campaign {
  id: string
  message: string
  channel: string
  status: string
  sent_at: string | null
  created_at: string
  filter_query: string | null
  recipient_count: number
  stats: CampaignStats
}

export default function HistoryPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selected, setSelected] = useState<Campaign | null>(null)
  const router = useRouter()
  const tenantId = getActiveTenantId()

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/history?tenant=${encodeURIComponent(tenantId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('SMS history unavailable'); return r.json() })
      .then(data => {
        if (controller.signal.aborted) return
        setCampaigns(Array.isArray(data) ? data : [])
        setLoadError(false)
        setLoading(false)
      })
      .catch(() => { if (!controller.signal.aborted) { setLoading(false); setLoadError(true) } })
    return () => controller.abort()
  }, [tenantId])

  const formatDate = (ts: string) =>
    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const statusVariant = (status: string) => {
    if (status === 'sent') return 'success'
    if (status === 'sending') return 'info'
    if (status === 'failed') return 'error'
    return 'neutral'
  }

  return (
    <PageContainer>

      {/* Header */}
      <PageHeader
        title="Campaigns"
        subtitle="Review bulk email and SMS send activity"
      />

      <EmailCampaignHistory key={tenantId} tenant={tenantId} />
      <h2>SMS campaigns</h2>
      {loadError && <Notice variant="error">SMS campaign history could not be loaded.</Notice>}
      {loading && <p role="status">Loading SMS campaigns…</p>}

      {/* Empty state */}
      {!loading && !loadError && campaigns.length === 0 && (
        <EmptyState
          title="No SMS campaigns yet"
          description="Once you send your first message, it will appear here with delivery stats."
          action={<Button variant="primary" onClick={() => router.push('/dashboard/contacts')}>Send a message</Button>}
        />
      )}

      {/* Campaign list */}
      {!loading && campaigns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {campaigns.map(campaign => (
            <div
              key={campaign.id}
              onClick={() => setSelected(selected?.id === campaign.id ? null : campaign)}
              style={{
                background: colors.surface,
                border: `1px solid ${selected?.id === campaign.id ? colors.espresso : colors.border}`,
                borderRadius: radius.xl,
                padding: spacing['2xl'],
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Campaign header row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.md }}>
                <div style={{ flex: 1, minWidth: 0, marginRight: spacing.lg }}>
                  <div style={{ fontSize: typography.sizeBase, color: colors.text, fontFamily: typography.fontSans, lineHeight: 1.5, marginBottom: spacing.xs }}>
                    {campaign.message.length > 120
                      ? campaign.message.slice(0, 120) + '...'
                      : campaign.message}
                  </div>
                  {campaign.filter_query && (
                    <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, fontFamily: typography.fontSans }}>
                      {campaign.filter_query}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexShrink: 0 }}>
                  <Badge variant={statusVariant(campaign.status)}>
                    {campaign.status}
                  </Badge>
                  <span style={{ fontSize: typography.sizeXs, color: colors.textMuted, fontFamily: typography.fontSans }}>
                    {campaign.sent_at ? formatDate(campaign.sent_at) : formatDate(campaign.created_at)}
                  </span>
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: spacing['2xl'], borderTop: `1px solid ${colors.borderLight}`, paddingTop: spacing.md }}>
                {[
                  { label: 'Sent to', value: campaign.stats.total },
                  { label: 'Delivered', value: campaign.stats.delivered, color: colors.success },
                  { label: 'Failed', value: campaign.stats.failed, color: campaign.stats.failed > 0 ? colors.error : colors.textMuted },
                  { label: 'Replies', value: (
                    <span>
                      {campaign.stats.replies > 0 ? (
                        <ControlButton kind="link"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/dashboard/inbox?campaign=${campaign.id}`)
                          }}

                        >
                          {campaign.stats.replies} →
                        </ControlButton>
                      ) : (
                        campaign.stats.replies
                      )}
                    </span>
                  ), color: campaign.stats.replies > 0 ? colors.teal : colors.textMuted },
                  { label: 'Delivery rate', value: `${campaign.stats.delivery_rate}%`, color: campaign.stats.delivery_rate > 90 ? colors.success : campaign.stats.delivery_rate > 70 ? colors.yellow : colors.error },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, fontFamily: typography.fontSans, marginBottom: '2px' }}>
                      {label}
                    </div>
                    <div style={{ fontSize: typography.sizeLg, fontWeight: typography.weightSemibold, color: color || colors.text, fontFamily: typography.fontSans }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Expanded detail */}
              {selected?.id === campaign.id && (
                <div style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTop: `1px solid ${colors.borderLight}` }}>
                  <div style={{ fontSize: typography.sizeSm, color: colors.textMuted, fontFamily: typography.fontSans }}>
                    {campaign.sent_at
                      ? `Sent ${formatDate(campaign.sent_at)} at ${formatTime(campaign.sent_at)}`
                      : `Created ${formatDate(campaign.created_at)}`}
                    {campaign.channel && ` · ${campaign.channel.toUpperCase()}`}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  )
}