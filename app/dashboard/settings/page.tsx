'use client'
import { useState, useEffect } from 'react'
import { getActiveTenantId } from '@/lib/tenant'

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

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #E8E8E4',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'sans-serif',
    boxSizing: 'border-box' as const,
    outline: 'none',
    marginBottom: '4px',
  }

  const labelStyle = {
    fontSize: '13px',
    fontWeight: 500,
    color: '#1A1A1A',
    display: 'block',
    marginBottom: '4px',
    marginTop: '16px',
  }

  const hintStyle = {
    fontSize: '12px',
    color: '#A0A0A0',
    marginBottom: '8px',
    display: 'block',
  }

  const cardStyle = {
    background: 'white',
    border: '1px solid #E8E8E4',
    borderRadius: '12px',
    padding: '28px',
    marginBottom: '20px',
  }

  const stepNumberStyle = {
    width: '24px',
    height: '24px',
    background: '#C8392B',
    color: 'white',
    borderRadius: '50%',
    fontSize: '12px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }

  return (
    <div style={{ padding: '32px', maxWidth: '600px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '4px' }}>Settings</h1>
      <p style={{ color: '#6B6B6B', fontSize: '14px', marginBottom: '32px' }}>
        Complete these steps to start sending messages to your contacts.
      </p>

      {/* Step 1 — Twilio credentials */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={stepNumberStyle}>1</div>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px' }}>Connect your Twilio account</h2>
            <p style={{ fontSize: '13px', color: '#6B6B6B', margin: 0, lineHeight: 1.6 }}>
              Pulse uses Twilio to send text messages on your behalf. You'll need a free Twilio account to get started.{' '}
              <a href="https://www.twilio.com/try-twilio" target="_blank" style={{ color: '#C8392B' }}>Create one here</a> if you don't have one yet.
            </p>
          </div>
        </div>

        {existing && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#16A34A', fontWeight: 500 }}>
            ✓ Twilio connected
          </div>
        )}

        <label style={labelStyle}>Account SID</label>
        <span style={hintStyle}>
          Log into <a href="https://console.twilio.com" target="_blank" style={{ color: '#C8392B' }}>console.twilio.com</a> → your Account SID is on the homepage, labeled "Account SID". It starts with "AC".
        </span>
        <input
          type="text"
          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          value={accountSid}
          onChange={e => setAccountSid(e.target.value)}
          style={inputStyle}
        />

        <label style={labelStyle}>Auth Token</label>
        <span style={hintStyle}>
          On the same Twilio homepage, click the eye icon next to "Auth Token" to reveal it, then copy it here.
        </span>
        <input
          type="password"
          placeholder="Your auth token"
          value={authToken}
          onChange={e => setAuthToken(e.target.value)}
          style={inputStyle}
        />

        {error && <p style={{ color: '#DC2626', fontSize: '13px', margin: '12px 0 0' }}>{error}</p>}
        {saved && <p style={{ color: '#16A34A', fontSize: '13px', margin: '12px 0 0' }}>✓ Saved</p>}

        <button
          onClick={handleSave}
          disabled={saving || !accountSid || !authToken}
          style={{
            background: saving || !accountSid || !authToken ? '#E8E8E4' : '#C8392B',
            color: saving || !accountSid || !authToken ? '#A0A0A0' : 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: saving || !accountSid || !authToken ? 'not-allowed' : 'pointer',
            fontFamily: 'sans-serif',
            marginTop: '20px',
          }}
        >
          {saving ? 'Saving...' : existing ? 'Update credentials' : 'Connect Twilio'}
        </button>
      </div>

      {/* Step 2 — Phone number */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={stepNumberStyle}>2</div>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px' }}>Your sending number</h2>
            <p style={{ fontSize: '13px', color: '#6B6B6B', margin: 0, lineHeight: 1.6 }}>
              This is the number your contacts will see messages from. It's separate from your business landline or personal cell — it's a dedicated number just for Pulse. When contacts reply, their messages appear in your Pulse inbox so you can track conversations in one place.
            </p>
          </div>
        </div>

        {existing?.phone_number && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#16A34A', fontWeight: 500 }}>
            ✓ Sending from {existing.phone_number}
          </div>
        )}

        <label style={labelStyle}>Phone Number</label>
        <span style={hintStyle}>
          In your Twilio console, go to Phone Numbers → Manage → Active Numbers. Copy the number in E.164 format (e.g. +19168911212).
        </span>
        <input
          type="text"
          placeholder="+19168911212"
          value={phoneNumber}
          onChange={e => setPhoneNumber(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Step 3 — 10DLC */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={stepNumberStyle}>3</div>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px' }}>Make sure your messages get delivered</h2>
            <p style={{ fontSize: '13px', color: '#6B6B6B', margin: 0, lineHeight: 1.6 }}>
              US mobile carriers require businesses to register before sending texts at scale. Without registration, your messages may be filtered or blocked — even if everything else is set up correctly. This is a one-time process in your Twilio account and takes a few business days to get approved.
            </p>
          </div>
        </div>

        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#92400E', marginBottom: '16px' }}>
          {existing?.registration_status === 'approved'
            ? '✓ Registration approved — your messages will be delivered.'
            : 'Registration pending or not started. Complete this in your Twilio console to avoid message filtering.'}
        </div>

        <a
          href="https://console.twilio.com/us1/develop/sms/regulatory-compliance/a2p-10dlc-overview"
          target="_blank"
          style={{ display: 'inline-block', background: '#1A1A1A', color: 'white', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, textDecoration: 'none', fontFamily: 'sans-serif' }}
        >
          Complete registration in Twilio →
        </a>
      </div>
    </div>
  )
}