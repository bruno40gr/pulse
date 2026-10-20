'use client'

import { useEffect, useState } from 'react'
import { Button, Notice, Select } from '@/components/ui'
import ComposePanel from '@/components/campaigns/ComposePanel'
import PrototypeEmailComposer, { type PrototypeEmailDraft } from '@/components/inbox/PrototypeEmailComposer'
import { conversationSignatureHtml, type ConversationSignature } from '@/lib/conversation-signature'
import { sanitizePrototypeHtml } from '@/lib/conversations-prototype-html'
import type { RecipientResolution } from '@/lib/communication-recipients'
import type { OrganisationSender } from '@/lib/organisation-email-policy'
import type { MockTemplate } from '@/lib/prototype-messaging'
import { spacing } from '@/lib/tokens'

type Audience = RecipientResolution & { version: string }
type Draft = PrototypeEmailDraft & { senderEmail: string }
async function json(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'This action could not be completed.')
  return body
}

export default function ContactBulkComposer({ tenantId, contactIds, channel, onClose }: {
  tenantId: string; contactIds: string[]; channel: 'sms' | 'email'; onClose: () => void
}) {
  const [audience, setAudience] = useState<Audience | null>(null)
  const [senders, setSenders] = useState<OrganisationSender[]>([])
  const [signature, setSignature] = useState<ConversationSignature | null>(null)
  const [templates, setTemplates] = useState<MockTemplate[]>([])
  const [draft, setDraft] = useState<Draft>({ subject: '', html: '', senderEmail: '' })
  const [operationId, setOperationId] = useState('')
  const [sending, setSending] = useState(false)
  const [locked, setLocked] = useState(false)
  const [payload, setPayload] = useState<{ body: string; html: string; version: string; senderEmail: string; subject: string } | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [restored, setRestored] = useState(false)
  const selectionKey = [...contactIds].sort().join(',')
  const storageKey = `pulse:contacts-email:${tenantId}:${selectionKey}`
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
      if (saved?.draft && typeof saved.draft.subject === 'string' && typeof saved.draft.html === 'string' && typeof saved.draft.senderEmail === 'string') {
        setDraft(saved.draft); setOperationId(saved.operationId || ''); setLocked(!!saved.locked); setPayload(saved.payload || null)
      }
    } catch { /* A malformed local draft must not block composing. */ }
    setRestored(true)
  }, [storageKey])
  useEffect(() => {
    if (restored && channel === 'email') {
      try { sessionStorage.setItem(storageKey, JSON.stringify({ draft, operationId, locked, payload })) } catch { /* Storage can be unavailable. */ }
    }
  }, [draft, operationId, locked, restored, storageKey, channel, payload])
  useEffect(() => {
    let cancelled = false
    const query = `?tenant=${encodeURIComponent(tenantId)}`
    setAudience(null); setError('')
    void json(`/api/communications/recipients${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactIds: selectionKey.split(','), channel }) })
      .then(result => { if (!cancelled) setAudience(result) }).catch(error => { if (!cancelled) setError(error.message) })
    if (channel === 'email') {
      void json(`/api/communications/senders${query}`).then(result => {
        if (cancelled) return
        setSenders(result.senders)
        setDraft(current => ({ ...current, senderEmail: current.senderEmail || result.senders[0]?.email || '' }))
        if (!result.senders.length) setError('Ask the account owner to set up the shared organisation email in Settings.')
      }).catch(error => { if (!cancelled) setError(error.message) })
      void json(`/api/conversations/signature${query}`).then(result => { if (!cancelled) setSignature(result) }).catch(() => {})
      void json(`/api/conversations/templates${query}`).then(result => { if (!cancelled) setTemplates(result.templates || []) }).catch(() => {})
    }
    return () => { cancelled = true }
  }, [tenantId, selectionKey, channel])
  const sender = senders.find(sender => sender.email === draft.senderEmail)
  const signatureHtml = sender?.signatureHtml ? sanitizePrototypeHtml(sender.signatureHtml) : signature && sender ? conversationSignatureHtml({ ...signature, name: sender.name, title: sender.mine ? signature.title : '' }, sender.name) : ''

  async function send(body: string, html: string) {
    if (!audience || !sender || sending) return
    setSending(true); setError('')
    const id = operationId || crypto.randomUUID()
    const immutable = payload || { body, html, version: audience.version, senderEmail: sender.email, subject: draft.subject }
    setPayload(immutable)
    setOperationId(id); setLocked(true)
    // Freeze the payload once delivery begins; repeated calls only continue the
    // same durable operation and never resend a confirmed/unknown destination.
    try {
      let result: { sent: number; failed: number; uncertain: number; pending: number }
      do {
        result = await json(`/api/communications/email?tenant=${encodeURIComponent(tenantId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactIds, ...immutable, operationId: id }) })
        setNotice(`${result.sent} emails sent.${result.pending ? ` ${result.pending} remaining.` : ''}${result.failed ? ` ${result.failed} could not be sent.` : ''}${result.uncertain ? ` ${result.uncertain} need checking in the shared mailbox’s Sent folder. Do not resend them.` : ''}`)
      } while (result.pending && !result.failed && !result.uncertain)
      if (!result.pending && !result.failed && !result.uncertain) {
        sessionStorage.removeItem(storageKey)
        onClose()
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Check Sent before trying again.') } finally { setSending(false) }
  }

  if (!audience) return <div style={{ padding: spacing.xl }}>{error ? <Notice variant="error">{error}</Notice> : <p role="status">Checking recipients…</p>}</div>
  if (channel === 'sms') return <ComposePanel recipientIds={contactIds} recipientCount={audience.recipients.length} filterExplanation="" channel="sms" composeSource="scratch" onClose={onClose} onSent={onClose} resolvedAudience={{ count: audience.recipients.length, version: audience.version }} excludedRecipients={audience.excluded} />
  return <>
    {error && <Notice variant="error" style={{ margin: spacing.lg }}>{error}</Notice>}
    {notice && <p role="status" style={{ margin: spacing.lg }}>{notice}</p>}
    <PrototypeEmailComposer name="" email="" student="" people={[]} templates={templates} onCreateTemplate={template => setTemplates(current => [...current, template])}
      draft={draft} onChange={value => { if (!locked) setDraft({ ...value, senderEmail: draft.senderEmail }) }}
      onSend={send} onCollapse={onClose} onDiscard={() => { if (sending) return; if (window.confirm(locked ? 'Close this send? Emails already submitted cannot be recalled.' : 'Discard this email draft?')) { sessionStorage.removeItem(storageKey); onClose() } }}
      replying={false} signatureHtml={signatureHtml} signatureImageUrl={signature?.logoUrl} senderName={sender?.name || 'Organisation'} senderEmail={sender?.email || ''}
      disabled={sending || locked || !sender || !audience.recipients.length} sendLabel={sending ? 'Sending…' : `Send ${audience.recipients.length} emails`}
      fromControl={senders.length > 1 ? <Select aria-label="Send email from" value={draft.senderEmail} disabled={sending || locked} onChange={event => setDraft({ ...draft, senderEmail: event.target.value })}>{senders.map(item => <option key={item.email} value={item.email}>{item.mine ? 'Me' : 'Organisation admin'} — {item.name} · {item.email}</option>)}</Select> : undefined}
      recipientSummary={<div><span>{audience.recipients.length} {audience.recipients.length === 1 ? 'recipient' : 'recipients'}</span>{audience.excluded.length > 0 && <Notice variant="warning" style={{ marginTop: spacing.sm }}>{audience.excluded.length} {audience.excluded.length === 1 ? 'contact cannot' : 'contacts cannot'} be reached by email.</Notice>}</div>} />
    {locked && !sending && <div style={{ padding: spacing.lg, display: 'flex', gap: spacing.sm }}><Button variant="secondary" onClick={onClose}>Close</Button>{payload && <Button onClick={() => void send(payload.body, payload.html)}>Check progress / continue unsent emails</Button>}</div>}
  </>
}