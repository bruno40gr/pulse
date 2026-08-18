'use client'
import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { getActiveTenantId } from '@/lib/tenant'
import { Button, Badge, SlidePanel, SlidePanelHeader, PageHeader } from '@/components/ui'
import ComposePanel from '@/components/campaigns/ComposePanel'
import ContactSlidePanel from '@/components/contacts/ContactSlidePanel'
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
  helperPrompt?: string
  intent?: Insight['type']
  contactContext?: ContactRecord
  recipientPreview?: Array<{
    id: string
    first_name: string
    last_name: string
  }>
}

interface ContactRecord {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  date_of_birth?: string | null
  client_status: string
  opted_out: boolean
  last_attended: string | null
  notes: string | null
  family_name: string | null
  account_holder_name: string | null
  account_holder_phone: string | null
  account_holder_email: string | null
  account_holders?: Array<{
    name: string | null
    phone: string | null
    email: string | null
    relationship: string | null
    is_primary: boolean
  }>
  custom_fields: Record<string, unknown>
  notes_history?: { text: string, timestamp: string }[]
  student_notes_history?: { text: string, timestamp: string }[]
  instructor?: {
    staff_id: string
    person_id: string | null
    name: string | null
    phone: string | null
    email: string | null
  } | null
  message_routing?: string
  is_minor?: boolean
}

interface TenantField {
  field_key: string
  field_label: string
  field_type: string
  field_options: string[] | null
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

function getGreetingForTime(date = new Date()) {
  const hour = date.getHours()
  const morningGreetings = ['Good morning.', 'Morning.', 'Hope your morning is off to a smooth start.']
  const afternoonGreetings = ['Good afternoon.', 'Hope your day is going well.', 'Afternoon — here’s what stands out right now.']
  const eveningGreetings = ['Good evening.', 'Hope your evening is going smoothly.', 'Evening — here’s what still deserves attention today.']

  if (hour < 12) return morningGreetings[Math.floor(hour % morningGreetings.length)]
  if (hour < 17) return afternoonGreetings[Math.floor(hour % afternoonGreetings.length)]
  return eveningGreetings[Math.floor(hour % eveningGreetings.length)]
}

export default function DashboardPage() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [instructorMap, setInstructorMap] = useState<Record<string, string | null>>({})
  const [contactPreviewMap, setContactPreviewMap] = useState<Record<string, { id: string, first_name: string, last_name: string }>>({})
  const [contactDetailsMap, setContactDetailsMap] = useState<Record<string, ContactRecord>>({})
  const [staffPreviewMap, setStaffPreviewMap] = useState<Record<string, { id: string, first_name: string, last_name: string }>>({})
  const [tenantFields, setTenantFields] = useState<TenantField[]>([])
  const [composeTarget, setComposeTarget] = useState<ComposeTarget | null>(null)
  const [selectedContact, setSelectedContact] = useState<ContactRecord | null>(null)
  const [greeting, setGreeting] = useState(() => getGreetingForTime())

  useEffect(() => {
    setGreeting(getGreetingForTime())
  }, [])

  useEffect(() => {
    fetch(`/api/tenant-fields?tenant=${getActiveTenantId()}`)
      .then(r => r.json())
      .then(data => setTenantFields(Array.isArray(data) ? data : []))
      .catch(() => setTenantFields([]))
  }, [])

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
        const previewMap: Record<string, { id: string, first_name: string, last_name: string }> = {}
        if (Array.isArray(staffData)) {
          for (const s of staffData) {
            const key = `${s.first_name || ''} ${s.last_name || ''}`.trim().toLowerCase()
            if (s.person_id && key) nameMap[key] = s.person_id
            if (s.person_id) {
              previewMap[s.person_id] = {
                id: s.person_id,
                first_name: s.first_name || '',
                last_name: s.last_name || '',
              }
            }
          }
        }
        setStaffPreviewMap(previewMap)
        return nameMap
      })
      .catch(() => ({} as Record<string, string>))
      .then(nameMap => {
        return fetch(`/api/contacts?tenant=${tenant}`)
          .then(r => r.json())
          .then(contacts => {
            const map: Record<string, string | null> = {}
            if (Array.isArray(contacts)) {
              const previewMap: Record<string, { id: string, first_name: string, last_name: string }> = {}
              const detailsMap: Record<string, ContactRecord> = {}
              for (const c of contacts) {
                previewMap[c.id] = {
                  id: c.id,
                  first_name: c.first_name,
                  last_name: c.last_name,
                }
                detailsMap[c.id] = c
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
              setContactPreviewMap(previewMap)
              setContactDetailsMap(detailsMap)
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

  const getRecipientPreview = (ids: string[]) => ids
    .map(id => contactPreviewMap[id])
    .filter(Boolean)
    .slice(0, 3)

  const getContactContext = (ids: string[]) => ids.length === 1 ? contactDetailsMap[ids[0]] : undefined

  const buildHelperPrompt = (insight: Insight, mode: 'student' | 'instructor') => {
    if (mode === 'instructor') {
      return `Draft a concise internal note to instructors about ${insight.title.toLowerCase()}, with clear next steps and a calm, supportive tone.`
    }

    const intentPrompts: Record<Insight['type'], string> = {
      risk: `Draft a warm check-in message for families who may need help getting back into a steady routine around ${insight.title.toLowerCase()}.`,
      milestone: `Draft a warm celebratory message that recognizes ${insight.title.toLowerCase()} and reinforces progress.`,
      opportunity: `Draft an encouraging message that helps families take the next step around ${insight.title.toLowerCase()}.`,
      nudge: `Draft a friendly, low-pressure reminder related to ${insight.title.toLowerCase()}.`,
    }

    return intentPrompts[insight.type]
  }

  return (
    <div style={{ padding: spacing['3xl'], maxWidth: '1480px' }}>
      <PageHeader
        title={greeting}
        subtitle="Here is what is worth your attention today."
        right={
          <Button
            variant="secondary"
            onClick={() => {
              setRefreshing(true)
              fetch(`/api/insights?tenant=${getActiveTenantId()}&refresh=true`)
                .then(r => r.json())
                .then(data => {
                  if (data.insights) {
                    setInsights(data.insights)
                    const now = new Date().toISOString()
                    const tenant = getActiveTenantId()
                    localStorage.setItem(`pulse_insights_${tenant}`, JSON.stringify(data.insights))
                    localStorage.setItem(`pulse_insights_time_${tenant}`, now)
                    setLastUpdated(now)
                  }
                })
                .catch(() => {})
                .finally(() => setRefreshing(false))
            }}
            disabled={refreshing}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing insights' : 'Refresh insights'}
          </Button>
        }
      />

      {loading && (
        <>
          <p style={{ color: colors.textMuted, fontSize: typography.sizeXs, marginBottom: spacing.md, fontFamily: typography.fontSans }}>
            {loadingMessage}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.md, maxWidth: '1480px' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.md, maxWidth: '1480px' }}>
            {insights.map((insight, i) => {
              const variant = typeConfig[insight.type] || 'warning'
              const instructorIds = getInstructorIds(insight)
              const singleStudentContext = insight.contact_ids.length === 1 ? getContactContext(insight.contact_ids) : undefined
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
                          helperPrompt: buildHelperPrompt(insight, 'instructor'),
                          intent: insight.type,
                          recipientPreview: instructorIds.map(id => staffPreviewMap[id]).filter(Boolean).slice(0, 3),
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
                          helperPrompt: buildHelperPrompt(insight, 'student'),
                          intent: insight.type,
                          contactContext: singleStudentContext,
                          recipientPreview: getRecipientPreview(insight.contact_ids),
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
        </>
      )}

      {/* Compose slide panel */}
      <SlidePanel isOpen={!!composeTarget} onClose={() => setComposeTarget(null)}>
        <SlidePanelHeader
          title={composeTarget?.mode === 'instructor' ? 'Message instructor(s)' : 'Message students'}
          titleBadge={composeTarget?.mode === 'instructor' ? (
            <Badge variant="neutral" size="sm">Internal comms</Badge>
          ) : undefined}
          onClose={() => setComposeTarget(null)}
        />
        <div style={{ flex: 1, overflow: 'auto' }}>
          {composeTarget && (
            <ComposePanel
              recipientCount={composeTarget.ids.length}
              filterExplanation={composeTarget.context}
              recipientIds={composeTarget.ids}
              channel="sms"
              mode={composeTarget.ids.length === 1 && composeTarget.contactContext ? 'single' : 'bulk'}
              contactContext={composeTarget.contactContext}
              composeSource="insight"
              initialMessage={composeTarget.helperPrompt || ''}
              composeIntent={composeTarget.intent || 'neutral'}
              internalComms={composeTarget.mode === 'instructor'}
              internalCommsLabel="Internal comms"
              internalCommsDescription={composeTarget.mode === 'instructor' ? 'Use for coordination, coaching, and team follow-up.' : 'Use for coordination and operational follow-up.'}
              recipientPreview={composeTarget.recipientPreview}
              onClose={() => setComposeTarget(null)}
              onSent={() => {
                setTimeout(() => setComposeTarget(null), 3000)
              }}
            />
          )}
        </div>
        {composeTarget?.ids.length === 1 && composeTarget?.contactContext && (
          <div style={{ padding: `${spacing.lg} ${spacing['2xl']}`, borderTop: `1px solid ${colors.borderLight}`, display: 'flex', alignItems: 'center', flexShrink: 0, background: colors.surface }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedContact(composeTarget.contactContext || null)
                setComposeTarget(null)
              }}
            >
              ← View student details
            </Button>
          </div>
        )}
      </SlidePanel>

      {selectedContact && (
        <ContactSlidePanel
          contact={selectedContact}
          tenantFields={tenantFields}
          onClose={() => setSelectedContact(null)}
          onUpdated={(updated) => {
            setSelectedContact(updated)
            setContactDetailsMap(prev => ({ ...prev, [updated.id]: updated }))
            setContactPreviewMap(prev => ({
              ...prev,
              [updated.id]: {
                id: updated.id,
                first_name: updated.first_name,
                last_name: updated.last_name,
              }
            }))
          }}
        />
      )}
    </div>
  )
}