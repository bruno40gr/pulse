'use client'
import { useState, useEffect } from 'react'
import { getActiveTenantId } from '@/lib/tenant'
import { Button, Badge, SlidePanel, SlidePanelHeader, PageHeader } from '@/components/ui'
import ComposePanel from '@/components/campaigns/ComposePanel'
import { colors, typography, radius, spacing } from '@/lib/tokens'

interface Insight {
  type: 'risk' | 'milestone' | 'opportunity' | 'nudge'
  title: string
  description: string
  contact_ids: string[]
  action_label: string
  urgency: 'high' | 'medium' | 'low'
}

interface ComposeTarget {
  ids: string[]
  mode: 'student' | 'instructor'
  context: string
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
  const [instructorMap, setInstructorMap] = useState<Record<string, string | null>>({})
  const [composeTarget, setComposeTarget] = useState<ComposeTarget | null>(null)

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

  // Load contacts + staff to resolve each student's instructor (for "Check in with instructor")
  useEffect(() => {
    const tenant = getActiveTenantId()

    // Staff name → person_id map for fallback resolution
    fetch(`/api/staff?tenant=${tenant}`)
      .then(r => r.json())
      .then(staffData => {
        const nameMap: Record<string, string> = {}
        if (Array.isArray(staffData)) {
          for (const s of staffData) {
            const key = `${s.first_name || ''} ${s.last_name || ''}`.trim().toLowerCase()
            if (s.person_id && key) nameMap[key] = s.person_id
          }
        }
        return nameMap
      })
      .catch(() => ({} as Record<string, string>))
      .then(nameMap => {
        return fetch(`/api/contacts?tenant=${tenant}`)
          .then(r => r.json())
          .then(contacts => {
            const map: Record<string, string | null> = {}
            if (Array.isArray(contacts)) {
              for (const c of contacts) {
                // Prefer explicit person_id from enrollment staff join
                const personId = c.instructor?.person_id ?? null
                if (personId) {
                  map[c.id] = personId
                  continue
                }
                // Fall back to matching instructor name against staff roster
                const instrName = (c.instructor?.name || c.custom_fields?.instructor || '')
                  .toString().trim().toLowerCase()
                map[c.id] = instrName ? (nameMap[instrName] || null) : null
              }
            }
            setInstructorMap(map)
          })
      })
      .catch(() => {})
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

  const getInstructorIds = (insight: Insight): string[] => {
    const ids = new Set<string>()
    for (const cid of insight.contact_ids) {
      const pid = instructorMap[cid]
      if (pid) ids.add(pid)
    }
    return [...ids]
  }

  return (
    <div style={{ padding: spacing['3xl'] }}>
      <PageHeader title="Good morning." subtitle="Here is what is worth your attention today." />

      {loading && (
        <>
          <p style={{ color: colors.textMuted, fontSize: typography.sizeXs, marginBottom: spacing.md, fontFamily: typography.fontSans }}>
            {loadingMessage}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing.md, maxWidth: '1100px' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.lg,
                padding: spacing['3xl'],
                display: 'flex',
                flexDirection: 'column',
                gap: spacing.lg,
                animation: 'skeletonPulse 1.4s ease-in-out infinite',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ width: '64px', height: '20px', borderRadius: radius.full, background: colors.borderLight }} />
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors.borderLight }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  <div style={{ width: '60%', height: '20px', borderRadius: radius.sm, background: colors.borderLight }} />
                  <div style={{ width: '100%', height: '14px', borderRadius: radius.sm, background: colors.borderLight }} />
                  <div style={{ width: '85%', height: '14px', borderRadius: radius.sm, background: colors.borderLight }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm, marginTop: 'auto' }}>
                  <div style={{ width: '140px', height: '32px', borderRadius: radius.sm, background: colors.borderLight }} />
                  <div style={{ width: '120px', height: '32px', borderRadius: radius.sm, background: colors.borderLight }} />
                </div>
              </div>
            ))}
          </div>
        </>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing.md, maxWidth: '1100px' }}>
            {insights.map((insight, i) => {
              const variant = typeConfig[insight.type] || 'warning'
              const instructorIds = getInstructorIds(insight)
              return (
                <div key={i} style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.lg,
                  padding: spacing['3xl'],
                  display: 'flex',
                  flexDirection: 'column',
                  gap: spacing.md,
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
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: typography.sizeLg, fontWeight: typography.weightSemibold, color: colors.text, margin: `0 0 ${spacing.xs}` }}>{insight.title}</h3>
                    <p style={{ fontSize: typography.sizeBase, color: colors.textSecondary, margin: 0, lineHeight: 1.6 }}>{insight.description}</p>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                    <span style={{ fontSize: typography.sizeSm, color: colors.textMuted }}>
                      {insight.contact_ids.length} {insight.contact_ids.length === 1 ? 'person' : 'people'}
                    </span>
                    <div style={{ display: 'flex', gap: spacing.xs, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <Button
                        size="md"
                        variant="secondary"
                        disabled={instructorIds.length === 0}
                        onClick={() => setComposeTarget({
                          ids: instructorIds,
                          mode: 'instructor',
                          context: `Instructors of the students flagged in: ${insight.title}`,
                        })}
                      >
                        Check in with instructor
                      </Button>
                      <Button
                        size="md"
                        onClick={() => setComposeTarget({
                          ids: insight.contact_ids,
                          mode: 'student',
                          context: insight.description,
                        })}
                      >
                        {insight.action_label}
                      </Button>
                    </div>
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

      {/* Compose slide panel */}
      <SlidePanel isOpen={!!composeTarget} onClose={() => setComposeTarget(null)}>
        <SlidePanelHeader
          title={composeTarget?.mode === 'instructor' ? 'Message instructor(s)' : 'Message students'}
          onClose={() => setComposeTarget(null)}
        />
        <div style={{ flex: 1, overflow: 'auto' }}>
          {composeTarget && (
            <ComposePanel
              recipientCount={composeTarget.ids.length}
              filterExplanation={composeTarget.context}
              recipientIds={composeTarget.ids}
              channel="sms"
              mode="bulk"
              onClose={() => setComposeTarget(null)}
              onSent={() => {
                setTimeout(() => setComposeTarget(null), 3000)
              }}
            />
          )}
        </div>
      </SlidePanel>
    </div>
  )
}