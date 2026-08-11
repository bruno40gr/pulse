'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getActiveTenantId } from '@/lib/tenant'
import { colors, typography, spacing, radius } from '@/lib/tokens'
import { Badge } from '@/components/ui'
import { EmptyState } from '@/components/ui'
import { Button } from '@/components/ui'

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
  const [selected, setSelected] = useState<Campaign | null>(null)
  const router = useRouter()
  const tenantId = getActiveTenantId()

  useEffect(() => {
    fetch(`/api/history?tenant=${tenantId}`)
      .then(r => r.json())
      .then(data => {
        setCampaigns(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
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
    <div style={{ padding: spacing['3xl'], maxWidth: '900px' }}>

      {/* Header */}
      <div style={{ marginBottom: spacing['2xl'] }}>
        <h1 style={{ fontSize: typography.size2xl, fontWeight: typography.weightSemibold, color: colors.text, margin: 0, fontFamily: typography.fontSans }}>
          Campaigns
        </h1>
        <p style={{ fontSize: typography.sizeMd, color: colors.textMuted, marginTop: spacing.xs, fontFamily: typography.fontSans }}>
          {loading ? 'Loading...' : `${campaigns.length} ${campaigns.length === 1 ? 'campaign' : 'campaigns'} sent`}
        </p>
      </div>

      {/* Empty state */}
      {!loading && campaigns.length === 0 && (
        <EmptyState
          title="No campaigns yet"
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/dashboard/inbox?campaign=${campaign.id}`)
                          }}
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                            fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', color: colors.teal,
                            textDecoration: 'underline', textUnderlineOffset: '2px',
                          }}
                        >
                          {campaign.stats.replies} →
                        </button>
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
                  {campaign.stats.failed > 0 && (
                    <div style={{ marginTop: spacing.sm }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push('/dashboard/contacts')
                        }}
                      >
                        Retry failed recipients
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}