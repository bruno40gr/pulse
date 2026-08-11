'use client'
import { useState, useEffect } from 'react'
import { getActiveTenantId } from '@/lib/tenant'
import { colors, typography, radius, spacing, shadows } from '@/lib/tokens'

interface CampaignCopy {
  useCase: string
  campaignDescription: string
  sampleMessages: string[]
  consentLanguage: string
  messageAttributes: {
    hasLinks: boolean
    hasPhoneNumbers: boolean
    hasLending: boolean
    hasAgeGated: boolean
  }
}

export default function SettingsPage() {
  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [existing, setExisting] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const tenantId = getActiveTenantId()

  const [campaignCopy, setCampaignCopy] = useState<CampaignCopy | null>(null)
  const [copyLoading, setCopyLoading] = useState(false)
  const [copyError, setCopyError] = useState('')
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editedCopy, setEditedCopy] = useState<CampaignCopy | null>(null)

  useEffect(() => {
    fetch(`/api/twilio-config?tenant=${tenantId}`)
      .then(r => r.json())
      .then(data => { setExisting(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [tenantId])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch(`/api/twilio-config?tenant=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_sid: accountSid, auth_token: authToken, phone_number: phoneNumber }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setExisting(data)
      setSaved(true)
      setAccountSid('')
      setAuthToken('')
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const generateCampaignCopy = async () => {
    setCopyLoading(true)
    setCopyError('')
    try {
      const res = await fetch(`/api/twilio/campaign-copy?tenant=${tenantId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCampaignCopy(data)
      setEditedCopy(data)
    } catch (e: any) {
      setCopyError(e.message)
    } finally {
      setCopyLoading(false)
    }
  }

  const updateEditedField = (field: string, value: any) => {
    if (!editedCopy) return
    setEditedCopy({ ...editedCopy, [field]: value })
  }

  const updateSampleMessage = (index: number, value: string) => {
    if (!editedCopy) return
    const newMessages = [...editedCopy.sampleMessages]
    newMessages[index] = value
    setEditedCopy({ ...editedCopy, sampleMessages: newMessages })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // Shared styles using tokens
  const inputS = {
    width: '100%',
    padding: `${spacing.md} ${spacing.lg}`,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    fontSize: typography.sizeMd,
    fontFamily: typography.fontSans,
    boxSizing: 'border-box' as const,
    outline: 'none',
    background: colors.surface,
  }

  const labelS = {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightMedium,
    color: colors.text,
    display: 'block',
    marginBottom: spacing.xs,
    marginTop: spacing.lg,
  }

  const hintS = {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    display: 'block',
  }

  const cardS = {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.xl,
    padding: spacing['3xl'],
  }

  const stepNumberS = {
    width: '24px',
    height: '24px',
    background: colors.crimson,
    color: 'white',
    borderRadius: radius.full,
    fontSize: typography.sizeSm,
    fontWeight: typography.weightBold,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }

  const textareaS = {
    ...inputS,
    minHeight: '80px',
    resize: 'vertical' as const,
    lineHeight: 1.5,
  }

  const copyFieldS = {
    background: colors.background,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: `${spacing.md} ${spacing.lg}`,
    fontSize: typography.sizeBase,
    lineHeight: 1.6,
    color: colors.text,
    fontFamily: typography.fontSans,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  }

  const sectionLabelS = {
    ...typography.label,
    color: colors.textSecondary,
  }

  return (
    <div style={{ padding: spacing['4xl'], maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: spacing['4xl'] }}>
        <h1 style={{
          fontSize: typography.size2xl,
          fontWeight: typography.weightSemibold,
          color: colors.text,
          margin: '0 0 6px',
        }}>
          Your campaign copy, ready to go
        </h1>
        <p style={{
          color: colors.textSecondary,
          fontSize: typography.sizeMd,
          margin: 0,
          lineHeight: 1.6,
          maxWidth: '520px',
        }}>
          We analyzed your contacts, message history, and business type to generate the exact copy Twilio needs. Review it, tweak anything, then paste it in.
        </p>
      </div>

      {/* Cards 1 & 2 — horizontally aligned */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.xl, marginBottom: spacing.xl }}>
        {/* Card 1 — Twilio credentials */}
        <div style={cardS}>
          <div style={{ display: 'flex', gap: spacing.md, alignItems: 'flex-start', marginBottom: spacing.xl }}>
            <div style={stepNumberS}>1</div>
            <div>
              <h2 style={{ fontSize: typography.sizeLg, fontWeight: typography.weightSemibold, color: colors.text, margin: '0 0 4px' }}>
                Connect your Twilio account
              </h2>
              <p style={{ fontSize: typography.sizeBase, color: colors.textSecondary, margin: 0, lineHeight: 1.6 }}>
                Pulse uses Twilio to send text messages on your behalf.{' '}
                <a href="https://www.twilio.com/try-twilio" target="_blank" style={{ color: colors.crimson, fontWeight: typography.weightMedium }}>
                  Create a free Twilio account
                </a>{' '}
                if you do not have one yet.
              </p>
            </div>
          </div>

          {existing && (
            <div style={{
              ...typography.bodySmall,
              color: colors.success,
              fontWeight: typography.weightMedium,
              marginBottom: spacing.xl,
            }}>
              Twilio connected
            </div>
          )}

          <label style={labelS}>Account SID</label>
          <input
            type="text"
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={accountSid}
            onChange={e => setAccountSid(e.target.value)}
            style={inputS}
          />

          <label style={labelS}>Auth Token</label>
          <input
            type="password"
            placeholder="Your auth token"
            value={authToken}
            onChange={e => setAuthToken(e.target.value)}
            style={inputS}
          />

          {error && <p style={{ color: colors.error, fontSize: typography.sizeBase, margin: `${spacing.md} 0 0` }}>{error}</p>}
          {saved && <p style={{ color: colors.success, fontSize: typography.sizeBase, margin: `${spacing.md} 0 0` }}>Saved</p>}

          <button
            onClick={handleSave}
            disabled={saving || !accountSid || !authToken}
            style={{
              background: saving || !accountSid || !authToken ? colors.borderLight : colors.action,
              color: saving || !accountSid || !authToken ? colors.textMuted : 'white',
              border: 'none',
              borderRadius: radius.lg,
              padding: `${spacing.md} ${spacing['2xl']}`,
              fontSize: typography.sizeMd,
              fontWeight: typography.weightMedium,
              cursor: saving || !accountSid || !authToken ? 'not-allowed' : 'pointer',
              fontFamily: typography.fontSans,
              marginTop: spacing.xl,
            }}
          >
            {saving ? 'Saving...' : existing ? 'Update credentials' : 'Connect Twilio'}
          </button>
        </div>

        {/* Card 2 — Phone number */}
        <div style={cardS}>
          <div style={{ display: 'flex', gap: spacing.md, alignItems: 'flex-start', marginBottom: spacing.xl }}>
            <div style={stepNumberS}>2</div>
            <div>
              <h2 style={{ fontSize: typography.sizeLg, fontWeight: typography.weightSemibold, color: colors.text, margin: '0 0 4px' }}>
                Your sending number
              </h2>
              <p style={{ fontSize: typography.sizeBase, color: colors.textSecondary, margin: 0, lineHeight: 1.6 }}>
                This is the number your contacts will see messages from. When contacts reply, their messages appear in your Pulse inbox.
              </p>
            </div>
          </div>

          {existing?.phone_number && (
            <div style={{
              ...typography.bodySmall,
              color: colors.success,
              fontWeight: typography.weightMedium,
              marginBottom: spacing.xl,
            }}>
              Sending from {existing.phone_number}
            </div>
          )}

          <label style={labelS}>Phone Number</label>
          <span style={hintS}>
            Find this in your Twilio console under Phone Numbers. Use E.164 format (e.g. +19168911212).
          </span>
          <input
            type="text"
            placeholder="+19168911212"
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            style={inputS}
          />
        </div>
      </div>

      {/* Card 3 — Campaign Registration (full width) */}
      <div style={cardS}>
        <div style={{ display: 'flex', gap: spacing.md, alignItems: 'flex-start', marginBottom: spacing.xl }}>
          <div style={stepNumberS}>3</div>
          <div>
            <h2 style={{ fontSize: typography.sizeLg, fontWeight: typography.weightSemibold, color: colors.text, margin: '0 0 4px' }}>
              Register your campaign
            </h2>
            <p style={{ fontSize: typography.sizeBase, color: colors.textSecondary, margin: 0, lineHeight: 1.6 }}>
              US carriers require businesses to register their messaging use case before sending texts. Without this, your messages may be filtered or blocked.
            </p>
          </div>
        </div>

        {!campaignCopy && !copyLoading && (
          <div style={{ textAlign: 'center', padding: `${spacing['4xl']} 0` }}>
            <p style={{ fontSize: typography.sizeMd, color: colors.textSecondary, marginBottom: spacing.xl }}>
              We will analyze your contacts and message history to generate the exact copy you need for Twilio registration.
            </p>
            <button
              onClick={generateCampaignCopy}
              style={{
                background: colors.action,
                color: 'white',
                border: 'none',
                borderRadius: radius.lg,
                padding: `${spacing.md} ${spacing['3xl']}`,
                fontSize: typography.size15,
                fontWeight: typography.weightSemibold,
                cursor: 'pointer',
                fontFamily: typography.fontSans,
              }}
            >
              Generate my campaign copy
            </button>
          </div>
        )}

        {copyLoading && (
          <div style={{ textAlign: 'center', padding: `${spacing['4xl']} 0` }}>
            <div style={{
              width: '24px', height: '24px', border: `2px solid ${colors.borderLight}`,
              borderTop: `2px solid ${colors.crimson}`, borderRadius: radius.full,
              animation: 'spin 0.8s linear infinite', margin: `0 auto ${spacing.lg}`
            }} />
            <p style={{ fontSize: typography.sizeMd, color: colors.textSecondary, margin: 0 }}>
              Analyzing your business and writing your campaign...
            </p>
          </div>
        )}

        {copyError && (
          <div style={{
            ...typography.bodySmall,
            color: colors.error,
            marginBottom: spacing.lg,
          }}>
            {copyError}
            <button
              onClick={generateCampaignCopy}
              style={{
                display: 'block',
                marginTop: spacing.sm,
                background: 'none',
                border: 'none',
                color: colors.crimson,
                cursor: 'pointer',
                fontSize: typography.sizeBase,
                fontWeight: typography.weightMedium,
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Try again
            </button>
          </div>
        )}

        {editedCopy && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: `${spacing['2xl']} ${spacing['3xl']}`,
            marginTop: spacing.xl,
          }}>
            {/* Left column */}
            <div>
              {/* Use case */}
              <div style={{ marginBottom: spacing.xl }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                  <label style={sectionLabelS}>Use case</label>
                  <button onClick={() => copyToClipboard('Low Volume Mixed')} style={{ background: 'none', border: 'none', color: colors.crimson, fontSize: typography.sizeXs, cursor: 'pointer', fontWeight: typography.weightMedium }}>
                    Copy
                  </button>
                </div>
                <div style={{ ...copyFieldS, fontWeight: typography.weightMedium }}>
                  Low Volume Mixed
                </div>
                <span style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginTop: spacing.xs, display: 'block' }}>
                  Select this in the Twilio dropdown.
                </span>
              </div>

              {/* Campaign description */}
              <div style={{ marginBottom: spacing.xl }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                  <label style={sectionLabelS}>Campaign description</label>
                  <button onClick={() => copyToClipboard(editedCopy.campaignDescription)} style={{ background: 'none', border: 'none', color: colors.crimson, fontSize: typography.sizeXs, cursor: 'pointer', fontWeight: typography.weightMedium }}>
                    Copy
                  </button>
                </div>
                {editingField === 'campaignDescription' ? (
                  <div>
                    <textarea value={editedCopy.campaignDescription} onChange={e => updateEditedField('campaignDescription', e.target.value)} style={textareaS} />
                    <button onClick={() => setEditingField(null)} style={{ background: colors.text, color: 'white', border: 'none', borderRadius: radius.md, padding: `${spacing.xs} ${spacing.lg}`, fontSize: typography.sizeSm, cursor: 'pointer', marginTop: spacing.sm, fontFamily: typography.fontSans }}>
                      Done
                    </button>
                  </div>
                ) : (
                  <div style={{ ...copyFieldS, cursor: 'pointer' }} onClick={() => setEditingField('campaignDescription')}>
                    {editedCopy.campaignDescription}
                  </div>
                )}
              </div>

              {/* Consent language */}
              <div style={{ marginBottom: spacing.xl }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                  <label style={sectionLabelS}>How users consent</label>
                  <button onClick={() => copyToClipboard(editedCopy.consentLanguage)} style={{ background: 'none', border: 'none', color: colors.crimson, fontSize: typography.sizeXs, cursor: 'pointer', fontWeight: typography.weightMedium }}>
                    Copy
                  </button>
                </div>
                {editingField === 'consentLanguage' ? (
                  <div>
                    <textarea value={editedCopy.consentLanguage} onChange={e => updateEditedField('consentLanguage', e.target.value)} style={{ ...textareaS, minHeight: '100px' }} />
                    <button onClick={() => setEditingField(null)} style={{ background: colors.text, color: 'white', border: 'none', borderRadius: radius.md, padding: `${spacing.xs} ${spacing.lg}`, fontSize: typography.sizeSm, cursor: 'pointer', marginTop: spacing.sm, fontFamily: typography.fontSans }}>
                      Done
                    </button>
                  </div>
                ) : (
                  <div style={{ ...copyFieldS, cursor: 'pointer' }} onClick={() => setEditingField('consentLanguage')}>
                    {editedCopy.consentLanguage}
                  </div>
                )}
              </div>

              {/* Message attributes */}
              <div style={{ marginBottom: spacing.xl }}>
                <label style={{ ...sectionLabelS, display: 'block', marginBottom: spacing.sm }}>Message contents</label>
                <div style={{ ...copyFieldS, display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, fontSize: typography.sizeBase, cursor: 'pointer', color: colors.text }}>
                    <input type="checkbox" checked={editedCopy.messageAttributes.hasLinks} readOnly style={{ accentColor: colors.crimson }} />
                    Messages will include embedded links
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, fontSize: typography.sizeBase, cursor: 'pointer', color: colors.text }}>
                    <input type="checkbox" checked={editedCopy.messageAttributes.hasPhoneNumbers} readOnly style={{ accentColor: colors.crimson }} />
                    Messages will include phone numbers
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, fontSize: typography.sizeBase, cursor: 'pointer', color: colors.text }}>
                    <input type="checkbox" checked={editedCopy.messageAttributes.hasLending} readOnly style={{ accentColor: colors.crimson }} />
                    Messages include content related to direct lending
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, fontSize: typography.sizeBase, cursor: 'pointer', color: colors.text }}>
                    <input type="checkbox" checked={editedCopy.messageAttributes.hasAgeGated} readOnly style={{ accentColor: colors.crimson }} />
                    Messages include age-gated content
                  </label>
                </div>
              </div>
            </div>

            {/* Right column — Sample messages */}
            <div>
              <label style={{ ...sectionLabelS, display: 'block', marginBottom: spacing.sm }}>
                Sample messages (5 required)
              </label>
              {editedCopy.sampleMessages.map((msg, i) => (
                <div key={i} style={{ marginBottom: spacing.md }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                    <span style={{ fontSize: typography.sizeXs, color: colors.textMuted, fontWeight: typography.weightMedium }}>Message {i + 1}</span>
                    <button onClick={() => copyToClipboard(msg)} style={{ background: 'none', border: 'none', color: colors.crimson, fontSize: typography.sizeXs, cursor: 'pointer', fontWeight: typography.weightMedium }}>
                      Copy
                    </button>
                  </div>
                  {editingField === `sample-${i}` ? (
                    <div>
                      <textarea value={msg} onChange={e => updateSampleMessage(i, e.target.value)} style={textareaS} />
                      <button onClick={() => setEditingField(null)} style={{ background: colors.text, color: 'white', border: 'none', borderRadius: radius.md, padding: `${spacing.xs} ${spacing.lg}`, fontSize: typography.sizeSm, cursor: 'pointer', marginTop: spacing.sm, fontFamily: typography.fontSans }}>
                        Done
                      </button>
                    </div>
                  ) : (
                    <div style={{ ...copyFieldS, cursor: 'pointer' }} onClick={() => setEditingField(`sample-${i}`)}>
                      {msg}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions — only show after generation */}
        {editedCopy && (
          <div style={{ display: 'flex', gap: spacing.md, marginTop: spacing['2xl'], paddingTop: spacing.xl, borderTop: `1px solid ${colors.border}` }}>
            <button
              onClick={generateCampaignCopy}
              disabled={copyLoading}
              style={{
                background: colors.surface,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.lg,
                padding: `${spacing.md} ${spacing.xl}`,
                fontSize: typography.sizeBase,
                fontWeight: typography.weightMedium,
                cursor: copyLoading ? 'not-allowed' : 'pointer',
                fontFamily: typography.fontSans,
              }}
            >
              Regenerate
            </button>
            <a
              href="https://console.twilio.com/us1/develop/sms/regulatory-compliance/a2p-10dlc-overview"
              target="_blank"
              style={{
                background: colors.action,
                color: 'white',
                padding: `${spacing.md} ${spacing.xl}`,
                borderRadius: radius.lg,
                fontSize: typography.sizeBase,
                fontWeight: typography.weightMedium,
                textDecoration: 'none',
                fontFamily: typography.fontSans,
                display: 'inline-block',
              }}
            >
              Open Twilio A2P Console
            </a>
          </div>
        )}
      </div>
    </div>
  )
}