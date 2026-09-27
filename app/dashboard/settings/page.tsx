'use client'
import { useState, useEffect } from 'react'
import { getActiveTenantId } from '@/lib/tenant'
import { Button, PageContainer, PageHeader } from '@/components/ui'
import AccessManagementClient from '@/components/access/AccessManagementClient'
import { colors, typography, radius, spacing } from '@/lib/tokens'
import type { MediaAsset } from '@/lib/media-catalog'
import { createClient } from '@/lib/supabase/client'
import { applyDisplayFontSize, readDisplayFontSize } from '@/lib/display-preferences'

type Tab = 'roles' | 'integrations' | 'brand' | 'account'

type AccountContext = {
  canManageRoles: boolean
  canManageIntegrations: boolean
  canManageBrand: boolean
  canUpdateCredentials: boolean
  email: string | null
}

const FOCUS_OPTIONS = [
  { value: 'retention', label: 'Retention' },
  { value: 'billing', label: 'Billing' },
  { value: 'growth', label: 'Growth' },
]

export default function SettingsPage() {
  const tenantId = getActiveTenantId()
  const [tab, setTab] = useState<Tab>('account')
  const [accountContext, setAccountContext] = useState<AccountContext | null>(null)
  const [contextLoading, setContextLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/account/me?tenant=${tenantId}`)
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load settings access.')
        return data as AccountContext
      })
      .then(data => {
        setAccountContext(data)
        if (data.canManageRoles) setTab('roles')
      })
      .catch(() => setAccountContext({
        canManageRoles: false,
        canManageIntegrations: false,
        canManageBrand: false,
        canUpdateCredentials: false,
        email: null,
      }))
      .finally(() => setContextLoading(false))
  }, [tenantId])

  // ── Shared styles ──
  const inputS: React.CSSProperties = {
    width: '100%',
    padding: `${spacing.md} ${spacing.lg}`,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    fontSize: typography.sizeMd,
    fontFamily: typography.fontSans,
    boxSizing: 'border-box',
    outline: 'none',
    background: colors.surface,
  }
  const labelS: React.CSSProperties = {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightMedium,
    color: colors.text,
    display: 'block',
    marginTop: spacing.xl,
  }
  const hintS: React.CSSProperties = {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    display: 'block',
  }
  const cardS: React.CSSProperties = {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.xl,
    padding: spacing['3xl'],
    marginBottom: spacing.xl,
  }
  const sectionTitleS: React.CSSProperties = {
    fontSize: typography.sizeLg,
    fontWeight: typography.weightSemibold,
    color: colors.text,
    margin: '0 0 4px',
  }
  const sectionSubS: React.CSSProperties = {
    fontSize: typography.sizeBase,
    color: colors.textSecondary,
    margin: 0,
    lineHeight: 1.6,
    maxWidth: '560px',
  }

  const tabs: { key: Tab; label: string }[] = [
    ...(accountContext?.canManageRoles ? [{ key: 'roles' as const, label: 'Roles & permissions' }] : []),
    ...(accountContext?.canManageIntegrations ? [{ key: 'integrations' as const, label: 'Integrations' }] : []),
    ...(accountContext?.canManageBrand ? [{ key: 'brand' as const, label: 'Brand' }] : []),
    { key: 'account', label: 'Account settings' },
  ]

  return (
    <PageContainer maxWidth="1100px">
      {/* Header */}
      <PageHeader
        title="Settings"
        subtitle="Manage access, integrations, brand preferences, and your personal account."
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: spacing.xs, borderBottom: `1px solid ${colors.border}`, marginBottom: spacing['3xl'], overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: `${spacing.md} ${spacing.xl}`,
              fontSize: typography.sizeMd,
              fontWeight: tab === t.key ? typography.weightSemibold : typography.weightNormal,
              color: tab === t.key ? colors.text : colors.textMuted,
              cursor: 'pointer',
              fontFamily: typography.fontSans,
              borderBottom: `2px solid ${tab === t.key ? colors.crimson : 'transparent'}`,
              marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {contextLoading ? (
        <p style={{ color: colors.textMuted, fontSize: typography.sizeBase }}>Loading settings…</p>
      ) : (
        <>
          {tab === 'roles' && accountContext?.canManageRoles && <AccessManagementClient tenantId={tenantId} embedded />}
          {tab === 'integrations' && accountContext?.canManageIntegrations && <IntegrationsTab tenantId={tenantId} inputS={inputS} labelS={labelS} hintS={hintS} cardS={cardS} sectionTitleS={sectionTitleS} sectionSubS={sectionSubS} />}
          {tab === 'brand' && accountContext?.canManageBrand && <BrandTab tenantId={tenantId} inputS={inputS} labelS={labelS} hintS={hintS} cardS={cardS} sectionTitleS={sectionTitleS} sectionSubS={sectionSubS} />}
          {tab === 'account' && accountContext && <AccountSettingsTab context={accountContext} inputS={inputS} labelS={labelS} hintS={hintS} cardS={cardS} sectionTitleS={sectionTitleS} sectionSubS={sectionSubS} />}
        </>
      )}
    </PageContainer>
  )
}

/* ───────────────────────── Account ───────────────────────── */

interface SettingsStyles {
  inputS: React.CSSProperties
  labelS: React.CSSProperties
  hintS: React.CSSProperties
  cardS: React.CSSProperties
  sectionTitleS: React.CSSProperties
  sectionSubS: React.CSSProperties
}

type TwilioConfig = {
  account_sid: string
  phone_number?: string | null
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

function IntegrationsTab({ tenantId, inputS, labelS, hintS, cardS, sectionTitleS, sectionSubS }: { tenantId: string } & SettingsStyles) {
  const [existing, setExisting] = useState<TwilioConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetch(`/api/twilio-config?tenant=${tenantId}`)
      .then(r => r.json())
      .then(data => { setExisting(data); setLoading(false); setShowForm(!data) })
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
      // Re-fetch to get masked SID
      const refreshed = await fetch(`/api/twilio-config?tenant=${tenantId}`).then(r => r.json())
      setExisting(refreshed)
      setShowForm(false)
      setSaved(true)
      setAccountSid('')
      setAuthToken('')
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Twilio? You will need to reconnect before sending messages.')) return
    setSaving(true)
    try {
      await fetch(`/api/twilio-config?tenant=${tenantId}`, { method: 'DELETE' })
      setExisting(null)
      setShowForm(true)
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Twilio */}
      <div style={cardS}>
        <h2 style={sectionTitleS}>Twilio</h2>
        <p style={sectionSubS}>Connect your Twilio account to send SMS. When connected, your sending number is shown and messages appear in the Pulse inbox.</p>

        {loading ? (
          <p style={{ color: colors.textMuted, fontSize: typography.sizeBase, marginTop: spacing.lg }}>Loading…</p>
        ) : existing && !showForm ? (
          <div style={{ marginTop: spacing.xl }}>
            <div style={{ background: colors.surfaceMuted, borderRadius: radius.lg, padding: spacing['2xl'], display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              <div style={{ fontSize: typography.sizeMd, color: colors.success, fontWeight: typography.weightSemibold }}>✓ Twilio connected</div>
              <div style={{ fontSize: typography.sizeBase, color: colors.text }}>
                Account SID: <span style={{ fontFamily: 'monospace', fontWeight: typography.weightMedium }}>{existing.account_sid}</span>
              </div>
              {existing.phone_number && (
                <div style={{ fontSize: typography.sizeBase, color: colors.text }}>
                  Sending from: <span style={{ fontFamily: 'monospace', fontWeight: typography.weightMedium }}>{existing.phone_number}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: spacing.md, marginTop: spacing.xl }}>
              <Button variant="secondary" onClick={() => setShowForm(true)}>Update credentials</Button>
              <Button variant="destructive" onClick={handleDisconnect} disabled={saving}>Disconnect</Button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: spacing.xl }}>
            {existing && (
              <p style={{ fontSize: typography.sizeBase, color: colors.textSecondary, margin: 0 }}>
                Updating credentials replaces your existing connection.
              </p>
            )}
            <label style={labelS}>Account SID</label>
            <input type="text" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" value={accountSid} onChange={e => setAccountSid(e.target.value)} style={inputS} />
            <label style={labelS}>Auth Token</label>
            <input type="password" placeholder="Your auth token" value={authToken} onChange={e => setAuthToken(e.target.value)} style={inputS} />
            <label style={labelS}>Phone Number</label>
            <input type="text" placeholder="+19168911212" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} style={inputS} />
            <span style={hintS}>Use E.164 format (e.g. +19168911212).</span>

            {error && <p style={{ color: colors.error, fontSize: typography.sizeBase, marginTop: spacing.md }}>{error}</p>}
            {saved && <p style={{ color: colors.success, fontSize: typography.sizeBase, marginTop: spacing.md }}>Saved</p>}

            <div style={{ display: 'flex', gap: spacing.md, marginTop: spacing.xl }}>
              <Button variant="primary" onClick={handleSave} disabled={saving || !accountSid || !authToken}>
                {saving ? 'Saving...' : 'Connect Twilio'}
              </Button>
              {existing && <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>}
            </div>
          </div>
        )}
      </div>

      {/* EmailJS */}
      <div style={cardS}>
        <h2 style={sectionTitleS}>EmailJS</h2>
        <p style={sectionSubS}>Send transactional email from Pulse.</p>
        <div style={{ marginTop: spacing.xl, padding: spacing['2xl'], border: `1px dashed ${colors.border}`, borderRadius: radius.lg, textAlign: 'center', color: colors.textMuted, fontSize: typography.sizeBase }}>
          Coming soon
        </div>
      </div>

      <DangerZone tenantId={tenantId} cardS={cardS} sectionTitleS={sectionTitleS} sectionSubS={sectionSubS} />
    </>
  )
}

/* ───────────────────────── Brand ───────────────────────── */

function BrandTab({ tenantId, inputS, labelS, hintS, cardS, sectionTitleS, sectionSubS }: { tenantId: string } & SettingsStyles) {
  const [logoUrl, setLogoUrl] = useState('')
  const [brandVoice, setBrandVoice] = useState('')
  const [brandMarkdown, setBrandMarkdown] = useState('')
  const [approvedImages, setApprovedImages] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/brand-settings?tenant=${tenantId}`)
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
          setLogoUrl(data.logo_url || '')
          setBrandVoice(data.brand_voice || '')
          setBrandMarkdown(data.brand_markdown || '')
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetch(`/api/media-suggestions?tenant=${tenantId}&source=manual`)
      .then(r => r.json())
      .then(data => setApprovedImages(Array.isArray(data.approvedImages) ? data.approvedImages : []))
      .catch(() => {})
  }, [tenantId])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch(`/api/brand-settings?tenant=${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo_url: logoUrl, brand_voice: brandVoice, brand_markdown: brandMarkdown }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handleMarkdownUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setBrandMarkdown(String(reader.result || ''))
    reader.readAsText(file)
  }

  return (
    <>
      {/* Brand voice */}
      <div style={cardS}>
        <h2 style={sectionTitleS}>Brand voice</h2>
        <p style={sectionSubS}>Describe how your business sounds and what you care about. This shapes every AI-generated message across Pulse.</p>

        {loading ? (
          <p style={{ color: colors.textMuted, fontSize: typography.sizeBase, marginTop: spacing.lg }}>Loading…</p>
        ) : (
          <div style={{ marginTop: spacing.xl }}>
            <label style={labelS}>Descriptive text</label>
            <textarea
              value={brandVoice}
              onChange={e => setBrandVoice(e.target.value)}
              placeholder="e.g. We are a friendly neighborhood music school. Warm, encouraging, never pushy. We celebrate progress and use first names."
              style={{ ...inputS, minHeight: '140px', resize: 'vertical', lineHeight: 1.6 }}
            />

            <label style={labelS}>Upload a file (.md or text)</label>
            <input type="file" accept=".md,.markdown,.txt" onChange={handleMarkdownUpload} style={{ ...inputS, padding: spacing.sm }} />
            <span style={hintS}>Paste or upload brand guidelines. Uploaded text is stored and combined with your description.</span>

            {brandMarkdown && (
              <textarea
                value={brandMarkdown}
                onChange={e => setBrandMarkdown(e.target.value)}
                style={{ ...inputS, minHeight: '100px', resize: 'vertical', lineHeight: 1.6, marginTop: spacing.lg }}
              />
            )}

            {error && <p style={{ color: colors.error, fontSize: typography.sizeBase, marginTop: spacing.md }}>{error}</p>}
            {saved && <p style={{ color: colors.success, fontSize: typography.sizeBase, marginTop: spacing.md }}>Saved</p>}

            <div style={{ marginTop: spacing.xl }}>
              <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save brand voice'}</Button>
            </div>
          </div>
        )}
      </div>

      {/* Logo */}
      <div style={cardS}>
        <h2 style={sectionTitleS}>Logo</h2>
        <p style={sectionSubS}>Your logo appears across Pulse. Enter a URL for now — file upload is coming later.</p>
        <div style={{ marginTop: spacing.xl }}>
          <label style={labelS}>Logo URL</label>
          <input type="text" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://yourbrand.com/logo.png" style={inputS} />
          {logoUrl && (
            <img src={logoUrl} alt="Logo preview" style={{ marginTop: spacing.md, maxHeight: '64px', borderRadius: radius.md, background: colors.surfaceMuted, padding: spacing.sm }} onError={e => (e.currentTarget.style.display = 'none')} />
          )}
          <div style={{ marginTop: spacing.xl }}>
            <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save logo'}</Button>
          </div>
        </div>
      </div>

      <div style={cardS}>
        <h2 style={sectionTitleS}>Media library</h2>
        <p style={sectionSubS}>Brand-approved images that appear first in Compose. Use this library to keep media on-brand and easy to reuse across messages.</p>

        <div style={{ marginTop: spacing.xl, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.md }}>
          {approvedImages.map(asset => (
            <div key={asset.id} style={{ border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: spacing.sm, background: colors.surfaceMuted }}>
              <img src={asset.url} alt={asset.title} style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: radius.md, background: colors.surface }} />
              <div style={{ marginTop: spacing.sm }}>
                <div style={{ fontSize: typography.sizeSm, fontWeight: typography.weightSemibold, color: colors.text }}>{asset.title}</div>
                <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, marginTop: 2 }}>{asset.category}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: spacing.xl, padding: spacing.lg, border: `1px dashed ${colors.border}`, borderRadius: radius.lg, background: colors.surface }}>
          <div style={{ fontSize: typography.sizeSm, fontWeight: typography.weightSemibold, color: colors.text }}>Manage your media</div>
          <p style={{ fontSize: typography.sizeSm, color: colors.textSecondary, lineHeight: 1.6, margin: `${spacing.xs} 0 ${spacing.md}` }}>
            Add, review, and retire approved images used across Compose.
          </p>
          <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Button variant="secondary" disabled>Add approved image</Button>
            <Button variant="ghost" disabled>Manage image links</Button>
          </div>
        </div>
      </div>

      <HighlightsSettings tenantId={tenantId} cardS={cardS} sectionTitleS={sectionTitleS} sectionSubS={sectionSubS} />
    </>
  )
}

/* ───────────────────────── AI highlights ───────────────────────── */

function HighlightsSettings({ tenantId, cardS, sectionTitleS, sectionSubS }: { tenantId: string; cardS: React.CSSProperties; sectionTitleS: React.CSSProperties; sectionSubS: React.CSSProperties }) {
  const [threshold, setThreshold] = useState(3)
  const [focusAreas, setFocusAreas] = useState<string[]>(['retention', 'billing', 'growth'])
  const [storedBaseFontSize, setStoredBaseFontSize] = useState(16)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/pulse-settings?tenant=${tenantId}`)
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
          setThreshold(data.highlight_threshold ?? 3)
          setFocusAreas(data.focus_areas?.length ? data.focus_areas : ['retention', 'billing', 'growth'])
          setStoredBaseFontSize(data.base_font_size ?? 16)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [tenantId])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch(`/api/pulse-settings?tenant=${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ highlight_threshold: threshold, focus_areas: focusAreas, base_font_size: storedBaseFontSize }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const toggleFocus = (value: string) => {
    setFocusAreas(prev => prev.includes(value) ? prev.filter(f => f !== value) : [...prev, value])
  }

  return (
    <div style={cardS}>
      <h2 style={sectionTitleS}>AI Highlights</h2>
      <p style={sectionSubS}>Calibrate how many highlights Pulse surfaces on your dashboard and which areas to prioritize. These settings apply across the organization.</p>

      {loading ? (
        <p style={{ color: colors.textMuted, fontSize: typography.sizeBase, marginTop: spacing.lg }}>Loading…</p>
      ) : (
        <div style={{ marginTop: spacing.xl }}>
            {/* Threshold */}
            <div style={{ marginBottom: spacing.xl }}>
              <div style={{ fontSize: typography.sizeSm, fontWeight: typography.weightMedium, color: colors.text }}>
                Highlight threshold: {threshold}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, maxWidth: '480px' }}>
                <span style={{ fontSize: typography.sizeXs, color: colors.textMuted, whiteSpace: 'nowrap' }}>Catch more</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={threshold}
                  onChange={e => setThreshold(Number(e.target.value))}
                  style={{ flex: 1, accentColor: colors.crimson, cursor: 'pointer' }}
                />
                <span style={{ fontSize: typography.sizeXs, color: colors.textMuted, whiteSpace: 'nowrap' }}>Only clear signals</span>
              </div>
            </div>

            {/* Focus areas */}
            <div style={{ marginBottom: spacing.xl }}>
              <div style={{ fontSize: typography.sizeSm, fontWeight: typography.weightMedium, color: colors.text, marginBottom: spacing.sm }}>
                Focus areas
              </div>
              <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
                {FOCUS_OPTIONS.map(f => {
                  const active = focusAreas.includes(f.value)
                  return (
                    <button
                      key={f.value}
                      onClick={() => toggleFocus(f.value)}
                      style={{
                        padding: `${spacing.sm} ${spacing.lg}`,
                        borderRadius: radius.full,
                        border: `1px solid ${active ? colors.crimson : colors.border}`,
                        background: active ? colors.crimson : colors.surface,
                        color: active ? 'white' : colors.textSecondary,
                        fontSize: typography.sizeSm,
                        fontWeight: typography.weightMedium,
                        cursor: 'pointer',
                        fontFamily: typography.fontSans,
                      }}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {error && <p style={{ color: colors.error, fontSize: typography.sizeBase }}>{error}</p>}
            {saved && <p style={{ color: colors.success, fontSize: typography.sizeBase }}>Saved</p>}

          <Button variant="primary" onClick={handleSave} disabled={saving || focusAreas.length === 0}>
            {saving ? 'Saving...' : 'Save highlights'}
          </Button>
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── Personal account ───────────────────────── */

function AccountSettingsTab({ context, inputS, labelS, hintS, cardS, sectionTitleS, sectionSubS }: { context: AccountContext } & SettingsStyles) {
  const [email, setEmail] = useState(context.email || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fontSize, setFontSize] = useState(16)
  const [savingCredentials, setSavingCredentials] = useState(false)
  const [credentialMessage, setCredentialMessage] = useState('')
  const [credentialError, setCredentialError] = useState('')

  useEffect(() => {
    setFontSize(readDisplayFontSize())
  }, [])

  const handleFontSizeChange = (value: number) => {
    setFontSize(applyDisplayFontSize(value))
  }

  const handleCredentialsSave = async () => {
    setSavingCredentials(true)
    setCredentialMessage('')
    setCredentialError('')

    try {
      if (password && password.length < 8) throw new Error('Use at least 8 characters for your password.')
      if (password !== confirmPassword) throw new Error('The password confirmation does not match.')
      if (!email.trim()) throw new Error('Enter an email address.')

      const supabase = createClient()
      const changes: { email?: string; password?: string } = {}
      if (email.trim().toLowerCase() !== (context.email || '').toLowerCase()) changes.email = email.trim().toLowerCase()
      if (password) changes.password = password
      if (!changes.email && !changes.password) throw new Error('Enter a new email address or password.')

      const { error } = await supabase.auth.updateUser(changes)
      if (error) throw error

      setPassword('')
      setConfirmPassword('')
      setCredentialMessage(changes.email
        ? 'Account updated. Check your new email address if confirmation is required.'
        : 'Password updated.')
    } catch (error) {
      setCredentialError((error as Error).message)
    } finally {
      setSavingCredentials(false)
    }
  }

  return (
    <>
      <div style={cardS}>
        <h2 style={sectionTitleS}>Email & password</h2>
        <p style={sectionSubS}>Update the credentials used for your personal Headliner account.</p>

        {context.canUpdateCredentials ? (
          <div style={{ marginTop: spacing.xl }}>
            <label style={labelS}>Email address</label>
            <input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" style={inputS} />

            <label style={labelS}>New password</label>
            <input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" placeholder="Leave blank to keep your current password" style={inputS} />
            <span style={hintS}>Use at least 8 characters.</span>

            <label style={labelS}>Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" style={inputS} />

            {credentialError && <p style={{ color: colors.error, fontSize: typography.sizeBase, marginTop: spacing.md }}>{credentialError}</p>}
            {credentialMessage && <p style={{ color: colors.success, fontSize: typography.sizeBase, marginTop: spacing.md }}>{credentialMessage}</p>}

            <div style={{ marginTop: spacing.xl }}>
              <Button variant="primary" onClick={handleCredentialsSave} disabled={savingCredentials}>
                {savingCredentials ? 'Saving…' : 'Save account changes'}
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: spacing.xl, padding: spacing.xl, borderRadius: radius.lg, background: colors.surfaceMuted, color: colors.textSecondary, fontSize: typography.sizeBase, lineHeight: 1.6 }}>
            {context.email && <div style={{ color: colors.text, fontWeight: typography.weightMedium, marginBottom: spacing.xs }}>{context.email}</div>}
            Email and password changes become available after your personal staff account is linked. You are currently signed in through the shared staff access flow.
          </div>
        )}
      </div>

      <div style={cardS}>
        <h2 style={sectionTitleS}>Accessibility & display</h2>
        <p style={sectionSubS}>Adjust text sizing for this browser. Changes apply immediately and are saved on this device.</p>

        <div style={{ marginTop: spacing.xl }}>
          <div style={{ fontSize: typography.sizeSm, fontWeight: typography.weightMedium, color: colors.text }}>
            Base font size: {fontSize}px
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, maxWidth: '480px' }}>
            <span style={{ fontSize: typography.sizeXs, color: colors.textMuted }}>14px</span>
            <input
              type="range"
              min={14}
              max={20}
              value={fontSize}
              onChange={event => handleFontSizeChange(Number(event.target.value))}
              aria-label="Base font size"
              style={{ flex: 1, accentColor: colors.crimson, cursor: 'pointer' }}
            />
            <span style={{ fontSize: typography.sizeXs, color: colors.textMuted }}>20px</span>
          </div>
          <div style={{ marginTop: spacing.lg }}>
            <Button variant="secondary" onClick={() => handleFontSizeChange(16)}>Reset to default</Button>
          </div>
        </div>
      </div>
    </>
  )
}
// Danger zone: reset contact data
function DangerZone({ tenantId, cardS, sectionTitleS, sectionSubS }: { tenantId: string; cardS: React.CSSProperties; sectionTitleS: React.CSSProperties; sectionSubS: React.CSSProperties }) {
  const [confirmText, setConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const handleReset = async () => {
    if (confirmText !== 'RESET') return
    setResetting(true)
    setError('')
    setDone('')
    try {
      const res = await fetch(`/api/contacts/reset?tenant=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESET' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Reset failed')
      setDone('Contact data has been reset. You can now re-import fresh data.')
      setConfirmText('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setResetting(false)
    }
  }

  return (
    <div style={{ ...cardS, border: '1px solid #FECACA', background: '#FEF2F2' }}>
      <h2 style={{ ...sectionTitleS, color: '#991B1B' }}>Danger zone</h2>
      <p style={sectionSubS}>
        Reset all contact data for this workspace. This permanently deletes all contacts, students, enrollments, instructors, custom fields, and message/campaign history. This cannot be undone.
      </p>
      <div style={{ marginTop: spacing.xl }}>
        <label style={{ fontSize: typography.sizeSm, fontWeight: typography.weightMedium, color: '#991B1B', display: 'block' }}>Type RESET to confirm</label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="RESET"
          style={{
            width: '100%',
            maxWidth: '280px',
            padding: `${spacing.md} ${spacing.lg}`,
            border: '1px solid #FECACA',
            borderRadius: radius.lg,
            fontSize: typography.sizeMd,
            fontFamily: typography.fontSans,
            boxSizing: 'border-box',
            outline: 'none',
            background: colors.surface,
            marginTop: spacing.sm,
          }}
        />
        {error && <p style={{ color: colors.error, fontSize: typography.sizeBase, marginTop: spacing.md }}>{error}</p>}
        {done && <p style={{ color: colors.success, fontSize: typography.sizeBase, marginTop: spacing.md }}>{done}</p>}
        <div style={{ marginTop: spacing.lg }}>
          <Button variant="destructive" onClick={handleReset} disabled={resetting || confirmText !== 'RESET'}>
            {resetting ? 'Resetting…' : 'Reset contact data'}
          </Button>
        </div>
      </div>
    </div>
  )
}
