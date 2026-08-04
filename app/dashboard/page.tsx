'use client'
import { useState, useEffect } from 'react'
import { getActiveTenantId } from '@/lib/tenant'

interface Insight {
  type: 'risk' | 'milestone' | 'opportunity' | 'nudge'
  title: string
  description: string
  contact_ids: string[]
  action_label: string
  urgency: 'high' | 'medium' | 'low'
}

const typeConfig = {
  risk: { color: '#DC2626', bg: '#FEF2F2', label: 'At risk' },
  milestone: { color: '#16A34A', bg: '#F0FDF4', label: 'Milestone' },
  opportunity: { color: '#2563EB', bg: '#EFF6FF', label: 'Opportunity' },
  nudge: { color: '#D97706', bg: '#FFFBEB', label: 'Heads up' },
}

const urgencyDot = {
  high: '#DC2626',
  medium: '#D97706',
  low: '#6B6B6B',
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

  useEffect(() => {
    fetch(`/api/insights?tenant=${getActiveTenantId()}`)
      .then(r => r.json())
      .then(data => {
        if (data.insights) setInsights(data.insights)
        else setError('Could not load insights.')
        setLoading(false)
      })
      .catch(() => { setError('Could not load insights.'); setLoading(false) })
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
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#1A1A1A', margin: 0 }}>Good morning.</h1>
        <p style={{ color: '#6B6B6B', fontSize: '14px', marginTop: '4px' }}>Here is what is worth your attention today.</p>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
          <div style={{
            width: '32px', height: '32px', border: '2px solid #E8E8E4',
            borderTop: '2px solid #C8392B', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ fontSize: '14px', color: '#6B6B6B', margin: 0, transition: 'opacity 0.3s' }}>
            {loadingMessage}
          </p>
        </div>
      )}

      {error && (
        <p style={{ color: '#DC2626', fontSize: '14px' }}>{error}</p>
      )}

      {!loading && !error && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {insights.map((insight, i) => {
              const config = typeConfig[insight.type] || typeConfig.nudge
              return (
                <div key={i} style={{
                  background: 'white',
                  border: '1px solid #E8E8E4',
                  borderRadius: '12px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: config.color,
                      background: config.bg,
                      padding: '3px 10px',
                      borderRadius: '20px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}>
                      {config.label}
                    </span>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: urgencyDot[insight.urgency] || '#6B6B6B',
                    }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1A1A1A', margin: '0 0 6px' }}>{insight.title}</h3>
                    <p style={{ fontSize: '13px', color: '#6B6B6B', margin: 0, lineHeight: 1.6 }}>{insight.description}</p>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#A0A0A0' }}>
                      {insight.contact_ids.length} {insight.contact_ids.length === 1 ? 'person' : 'people'}
                    </span>
                    <button
                      onClick={() => {
                        const params = new URLSearchParams({ ids: insight.contact_ids.join(',') })
                        window.location.href = `/dashboard/campaigns?${params}`
                      }}
                      style={{
                        background: '#1A1A1A',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '7px 14px',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: 'sans-serif',
                      }}
                    >
                      {insight.action_label}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <button
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
            style={{
              marginTop: '20px',
              background: 'transparent',
              border: '1px solid #E8E8E4',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              color: '#6B6B6B',
              cursor: 'pointer',
              fontFamily: 'sans-serif',
            }}
          >
            Refresh insights
          </button>
        </>
      )}
    </div>
  )
}