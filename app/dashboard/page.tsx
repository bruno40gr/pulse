'use client'
import { useState, useEffect } from 'react'
import { getActiveTenantId } from '@/lib/tenant'
import { Button, Badge } from '@/components/ui'
import { colors, typography, radius, spacing } from '@/lib/tokens'

interface Insight {
  type: 'risk' | 'milestone' | 'opportunity' | 'nudge'
  title: string
  description: string
  contact_ids: string[]
  action_label: string
  urgency: 'high' | 'medium' | 'low'
}

const typeConfig: Record<string, 'error' | 'success' | 'info' | 'warning'> = {
  risk: 'error',
  milestone: 'success',
  opportunity: 'info',
  nudge: 'warning',
}

const urgencyColor: Record<string, string> = {
  high: colors.error,
  medium: colors.yellow,
  low: colors.textSecondary,
}

const loadingMessages = [
  'Reviewing attendance patterns...',
  'Checking in on recent activity...',
  'Looking for moments worth your attention...',
  'Almost there...',
]

export default function DashboardPage() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    const tenant = getActiveTenantId()
    const cacheKey = `pulse_insights_${tenant}`
    const cacheTimeKey = `pulse_insights_time_${tenant}`
    const cached = localStorage.getItem(cacheKey)
    const cachedTime = localStorage.getItem(cacheTimeKey)

    // Show cached data instantly
    if (cached && cachedTime) {
      try {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed)) {
          setInsights(parsed)
          setLastUpdated(cachedTime)
          setLoading(false)
        }
      } catch {}
    }

    // Fetch fresh data
    fetch(`/api/insights?tenant=${tenant}`)
      .then(r => r.json())
      .then(data => {
        if (data.insights) {
          setInsights(data.insights)
          const now = new Date().toISOString()
          localStorage.setItem(cacheKey, JSON.stringify(data.insights))
          localStorage.setItem(cacheTimeKey, now)
          setLastUpdated(now)
        } else if (!cached) {
          setError('Could not load insights.')
        }
        setLoading(false)
      })
      .catch(() => {
        if (!cached) setError('Could not load insights.')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!loading) return
    let i = 0
    const interval = setInterval(() => {
      i = (i + 1) % loadingMessages.length
      setLoadingMessage(loadingMessages[i])
    }, 4000)
    return () => clearInterval(interval)
  }, [loading])

  return (
    <div style={{ padding: spacing['3xl'] }}>
      <div style={{ marginBottom: spacing['3xl'] }}>
        <h1 style={{ fontSize: typography.size2xl, fontWeight: typography.weightSemibold, color: colors.text, margin: 0 }}>Good morning.</h1>
        <p style={{ color: colors.textSecondary, fontSize: typography.sizeMd, marginTop: spacing.xs }}>Here is what is worth your attention today.</p>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: spacing.lg }}>
          <div style={{
            width: '32px', height: '32px', border: `2px solid ${colors.borderLight}`,
            borderTop: `2px solid ${colors.crimson}`, borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ fontSize: typography.sizeMd, color: colors.textSecondary, margin: 0, transition: 'opacity 0.3s' }}>
            {loadingMessage}
          </p>
        </div>
      )}

      {error && (
        <p style={{ color: colors.error, fontSize: typography.sizeMd }}>{error}</p>
      )}

      {!loading && !error && (
        <>
          {lastUpdated && (
            <p style={{ color: colors.textMuted, fontSize: typography.sizeXs, marginBottom: spacing.md, fontFamily: typography.fontSans }}>
              Last updated {Math.round((Date.now() - new Date(lastUpdated).getTime()) / 60000)} min ago
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing.md }}>
            {insights.map((insight, i) => {
              const variant = typeConfig[insight.type] || 'warning'
              return (
                <div key={i} style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.lg,
                  padding: spacing.xl,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: spacing.sm,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Badge variant={variant}>{insight.type}</Badge>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: urgencyColor[insight.urgency] || colors.textSecondary,
                    }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: typography.sizeLg, fontWeight: typography.weightSemibold, color: colors.text, margin: `0 0 ${spacing.xs}` }}>{insight.title}</h3>
                    <p style={{ fontSize: typography.sizeBase, color: colors.textSecondary, margin: 0, lineHeight: 1.6 }}>{insight.description}</p>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: typography.sizeSm, color: colors.textMuted }}>
                      {insight.contact_ids.length} {insight.contact_ids.length === 1 ? 'person' : 'people'}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => {
                        const params = new URLSearchParams({ ids: insight.contact_ids.join(',') })
                        window.location.href = `/dashboard/campaigns?${params}`
                      }}
                    >
                      {insight.action_label}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setLoading(true)
              setInsights([])
              fetch(`/api/insights?tenant=${getActiveTenantId()}&refresh=true`)
                .then(r => r.json())
                .then(data => {
                  if (data.insights) setInsights(data.insights)
                  setLoading(false)
                })
            }}
            style={{ marginTop: spacing.xl }}
          >
            Refresh insights
          </Button>
        </>
      )}
    </div>
  )
}