'use client'

import { useIsMobile } from '@/lib/useMediaQuery'
import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'

import { ControlButton } from '@/components/ui/ControlButton'
import { useEffect, useState } from 'react'
import { SlidePanel, SlidePanelHeader, Button } from '@/components/ui'
import ComposePanel from '@/components/campaigns/ComposePanel'
import SmsRecipientPicker, { type SmsRecipient as Recipient } from '@/components/inbox/SmsRecipientPicker'
import { colors, typography, spacing, radius, shadows } from '@/lib/tokens'

function displayName(r: Recipient) {
  return `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Unnamed'
}

export default function ComposeModal({ onClose }: { onClose: () => void }) {
  const isMobile = useIsMobile()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Recipient[]>([])
  const [selected, setSelected] = useState<Recipient[]>([])
  const [searching, setSearching] = useState(false)
  const [composing, setComposing] = useState(false)
  const [staffOnly, setStaffOnly] = useState(false)

  const loadContacts = async (q: string, staff: boolean) => {
    setSearching(true)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (staff) params.set('staff', '1')
      const qs = params.toString()
      const data = await fetch(`/api/recipient-search${qs ? `?${qs}` : ''}`).then(r => r.json())
      setResults(Array.isArray(data) ? data : [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  // Load everyone on open so the full database is browsable.
  useEffect(() => {
    loadContacts('', false)
  }, [])

  const handleSearch = (value: string) => {
    setQuery(value)
    loadContacts(value, staffOnly)
  }

  const toggleStaff = (staff: boolean) => {
    setStaffOnly(staff)
    loadContacts(query, staff)
  }

  const toggleRecipient = (r: Recipient) => {
    setSelected(prev =>
      prev.some(p => p.id === r.id)
        ? prev.filter(p => p.id !== r.id)
        : [...prev, r]
    )
  }

  // Stage 2 — compose message to the selected recipients
  if (composing) {
    return (
      <SlidePanel isOpen={true} onClose={onClose} fullScreen={isMobile} width={PROFILE_PANEL_WIDTH}>
        <SlidePanelHeader
          title="New message"
          onClose={onClose}
          onBack={() => setComposing(false)}
          backLabel="Recipients"
        />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ComposePanel
            recipientCount={selected.length}
            filterExplanation={`To ${selected.map(displayName).join(', ')}`}
            recipientIds={selected.map(s => s.id)}
            channel="sms"
            mode={selected.length === 1 ? 'single' : 'bulk'}
            composeSource="scratch"
            composeIntent="neutral"
            recipientPreview={selected.map(s => ({
              id: s.id,
              first_name: s.first_name || '',
              last_name: s.last_name || '',
            }))}
            onClose={onClose}
            onSent={() => setTimeout(onClose, 3000)}
          />
        </div>
      </SlidePanel>
    )
  }

  // Stage 1 — pick recipients (narrow, tall modal)
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: spacing['2xl'],
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 400,
          maxWidth: '100%',
          height: 'min(78vh, 680px)',
          display: 'flex',
          flexDirection: 'column',
          background: colors.surface,
          borderRadius: radius.xl,
          boxShadow: shadows.xl,
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${spacing.lg} ${spacing['2xl']}`,
          borderBottom: `1px solid ${colors.borderLight}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: typography.sizeLg, fontWeight: typography.weightSemibold, color: colors.text, fontFamily: typography.fontSans }}>
            New message
          </span>
          <ControlButton kind="close"
            onClick={onClose}

            aria-label="Close"
           />
        </div>

        <SmsRecipientPicker query={query} results={results} selected={selected} searching={searching} staffOnly={staffOnly} handleSearch={handleSearch} toggleStaff={toggleStaff} toggleRecipient={toggleRecipient} />

        {/* Footer CTA */}
        <div style={{
          padding: `${spacing.lg} ${spacing['2xl']}`,
          borderTop: `1px solid ${colors.borderLight}`,
          display: 'flex',
          flexShrink: 0,
          background: colors.surface,
        }}>
          <Button variant="primary" disabled={selected.length === 0} onClick={() => setComposing(true)} style={{ width: '100%' }}>
            Compose messages{selected.length > 0 ? ` (${selected.length})` : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}
