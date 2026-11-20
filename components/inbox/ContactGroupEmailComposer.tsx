'use client'

import { useEffect, useRef, useState } from 'react'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { Button, Notice, Select } from '@/components/ui'
import PrototypeEmailComposer, { type PrototypeEmailDraft } from './PrototypeEmailComposer'
import ExcludedRecipientsNotice from './ExcludedRecipientsNotice'
import type { RecipientResolution } from '@/lib/communication-recipients'
import type { OrganisationSender } from '@/lib/organisation-email-policy'
import type { MockTemplate } from '@/lib/prototype-messaging'
import { conversationSignatureHtml, type ConversationSignature } from '@/lib/conversation-signature'
import { spacing } from '@/lib/tokens'

async function json(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Email is unavailable.')
  return result
}

/** The Contacts composer and recipient picker, with an explicitly shared CC/BCC transport. */
export default function ContactGroupEmailComposer({ tenantId, contactIds, onClose }: {
  tenantId: string; contactIds: string[]; onClose: () => void
}) {
  const [audience, setAudience] = useState<(RecipientResolution & { version: string }) | null>(null)
  const [senders, setSenders] = useState<OrganisationSender[]>([])
  const [senderEmail, setSenderEmail] = useState('')
  const [signature, setSignature] = useState<ConversationSignature | null>(null)
  const [templates, setTemplates] = useState<MockTemplate[]>([])
  const [draft, setDraft] = useState<PrototypeEmailDraft>({ subject: '', html: '', recipients: { to: [], cc: [], bcc: [] } })
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [locked, setLocked] = useState(false)
  const [sent, setSent] = useState(false)
  const inFlight = useRef(false)
  const selection = [...contactIds].sort().join(',')
  const query = `?tenant=${encodeURIComponent(tenantId)}`
  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      json(`/api/communications/recipients${query}`, { signal: controller.signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactIds: selection.split(','), channel: 'email' }) }),
      json(`/api/communications/senders${query}`, { signal: controller.signal }),
    ]).then(([resolved, settings]) => {
      if (controller.signal.aborted) return
      setAudience(resolved); setSenders(settings.senders); setSenderEmail(settings.senders[0]?.email || '')
      // Privacy-first: no account-holder address appears in To or CC by default.
      setDraft(current => ({ ...current, recipients: { to: [], cc: [], bcc: resolved.recipients.map((row: { destination: string }) => row.destination) } }))
      if (!settings.senders.length) setError('Set up organisation email in Settings before sending.')
    }).catch(error => { if (!controller.signal.aborted) setError(error.message) })
    void json(`/api/conversations/signature${query}`, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setSignature(result) }).catch(() => {})
    void json(`/api/conversations/templates${query}`, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setTemplates(result.templates || []) }).catch(() => {})
    return () => controller.abort()
  }, [query, selection])
  const sender = senders.find(item => item.email === senderEmail)
  const people = (audience?.recipients || []).map(row => ({ id: row.destination, name: row.name, email: row.destination, phone: '', student: '' }))
  const recipients = draft.recipients || { to: [], cc: [], bcc: [] }
  const count = recipients.to.length + recipients.cc.length + recipients.bcc.length
  const signatureHtml = signature?.personal ? conversationSignatureHtml(signature, '') : sender?.signatureHtml || (signature && sender ? conversationSignatureHtml(signature, sender.name) : '')
  async function send(body: string, html: string) {
    if (!audience || !sender || inFlight.current || locked) return
    inFlight.current = true; setSending(true); setError('')
    try {
      await json(`/api/communications/email-group${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds, version: audience.version, senderEmail, recipients, subject: draft.subject, body, html }) })
      setSent(true); setLocked(true)
    } catch (error) {
      // A transport failure can happen after Gmail accepted the email. Never offer a blind retry.
      setLocked(true)
      setError(`${error instanceof Error ? error.message : 'Delivery could not be confirmed.'} This composer is locked to prevent duplicate sends. Check Sent before starting another email.`)
    } finally { inFlight.current = false; setSending(false) }
  }
  if (!audience) return error ? <Notice variant="error">{error}</Notice> : <div style={{ padding: spacing.lg }}><LoadingSkeleton label="Loading email composer" rows={4} /></div>
  if (sent) return <Notice><div role="status">Email sent.</div><Button variant="secondary" onClick={onClose}>Back to recipients</Button></Notice>
  return <>
    <Notice style={{ margin: spacing.lg }}>BCC hides account-holder addresses. CC and To make addresses visible to the other recipients. With no To recipients, the organisation sender is used as To.</Notice>
    {error && <Notice variant="error" style={{ margin: spacing.lg }}>{error}</Notice>}
    {count > 50 && <Notice variant="warning">CC/BCC emails support up to 50 recipients. Choose fewer or use individual emails.</Notice>}
    <ExcludedRecipientsNotice contacts={audience.excluded} channel="email" />
    <PrototypeEmailComposer name="" email="" student="" draft={draft} people={people} templates={templates}
      onChange={value => { if (!locked && !sending) setDraft(value) }} onCreateTemplate={template => setTemplates(current => [...current, template])}
      onSend={send} onCollapse={onClose} onDiscard={onClose} replying={false} senderName={sender?.name || ''} senderEmail={senderEmail}
      signatureHtml={signatureHtml} signatureImageUrl={signature?.logoUrl} companyLogoUrl={signature?.companyLogoUrl}
      allowBccOnly disabled={sending || locked || !sender || !count || count > 50} sendLabel={sending ? 'Sending…' : 'Send email'}
      fromControl={<Select aria-label="Send email from" value={senderEmail} disabled={sending || locked} onChange={event => setSenderEmail(event.target.value)}>
        {!sender && <option value="">No authorised sender</option>}{senders.map(item => <option key={item.email} value={item.email}>{item.name} — {item.email}</option>)}
      </Select>} />
  </>
}