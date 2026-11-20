'use client'

import { useEffect, useState } from 'react'
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, Notice, Select } from '@/components/ui'
import { PrototypeRecipientSearch } from './PrototypeRecipients'
import ComposePanel from '@/components/campaigns/ComposePanel'
import PrototypeEmailComposer, { type PrototypeEmailDraft } from '@/components/inbox/PrototypeEmailComposer'
import { conversationSignatureHtml, type ConversationSignature } from '@/lib/conversation-signature'
import { sanitizePrototypeHtml } from '@/lib/conversations-prototype-html'
import type { RecipientResolution } from '@/lib/communication-recipients'
import type { OrganisationSender } from '@/lib/organisation-email-policy'
import type { MockTemplate } from '@/lib/prototype-messaging'
import { spacing } from '@/lib/tokens'
import ExcludedRecipientsNotice from './ExcludedRecipientsNotice'
import { SHOWCASE_DRAFT, SHOWCASE_RECOVERY_OPERATION, SHOWCASE_SENDER } from '@/lib/showcase-email-recovery'

type Audience = RecipientResolution & { version: string }
type Draft = PrototypeEmailDraft & { senderEmail: string }
type SendPayload = { body: string; html: string; version: string; senderEmail: string; subject: string; destinations?: string[] }
async function json(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'This action could not be completed.')
  return body
}


export default function ContactBulkComposer({ tenantId, contactIds, channel, recoveryOf, onClose }: {
  tenantId: string; contactIds: string[]; channel: 'sms' | 'email'; recoveryOf?: string; onClose: () => void
}) {
  const [audience, setAudience] = useState<Audience | null>(null)
  const [senders, setSenders] = useState<OrganisationSender[]>([])
  const [signature, setSignature] = useState<ConversationSignature | null>(null)
  const [templates, setTemplates] = useState<MockTemplate[]>([])
  const [draft, setDraft] = useState<Draft>(recoveryOf ? SHOWCASE_DRAFT : { subject: '', html: '', senderEmail: '' })
  const [operationId, setOperationId] = useState('')
  const [sending, setSending] = useState(false)
  const [locked, setLocked] = useState(false)
  const [payload, setPayload] = useState<SendPayload | null>(null)
  const [selectedDestinations, setSelectedDestinations] = useState<string[] | null>(null)
  const [editingRecipients, setEditingRecipients] = useState(false)
  const [error, setError] = useState('')
  const [recipientError, setRecipientError] = useState('')
  const [senderError, setSenderError] = useState('')
  const [notice, setNotice] = useState('')
  const [restored, setRestored] = useState(false)
  const [smsBody, setSmsBody] = useState('')
  const selectionKey = [...contactIds].sort().join(',')
  const storageKey = `pulse:contacts-email:${tenantId}:${recoveryOf || selectionKey}`
  const smsStorageKey = `pulse:contacts-sms:${tenantId}:${selectionKey}`
  useEffect(() => {
    try { setSmsBody(sessionStorage.getItem(smsStorageKey) || '') } catch { /* Storage can be unavailable. */ }
  }, [smsStorageKey])
  function updateSmsBody(body: string) {
    setSmsBody(body)
    try { sessionStorage.setItem(smsStorageKey, body) } catch { /* Keep the in-memory draft. */ }
  }
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
      if (saved?.draft && typeof saved.draft.subject === 'string' && typeof saved.draft.html === 'string' && typeof saved.draft.senderEmail === 'string') {
        // Pre-picker recovery drafts had no explicit audience. Keep the copy,
        // but require a fresh selection instead of resuming that old payload.
        const canResume = !recoveryOf || Array.isArray(saved.payload?.destinations) && saved.payload.destinations.length > 0
        setDraft(saved.draft); setOperationId(canResume ? saved.operationId || '' : ''); setLocked(canResume && !!saved.locked); setPayload(canResume ? saved.payload || null : null)
        if (Array.isArray(saved.selectedDestinations) && saved.selectedDestinations.every((value: unknown) => typeof value === 'string')) setSelectedDestinations(saved.selectedDestinations)
      }
    } catch { /* A malformed local draft must not block composing. */ }
    setRestored(true)
  }, [storageKey, recoveryOf])
  useEffect(() => {
    if (restored && channel === 'email') {
      try { sessionStorage.setItem(storageKey, JSON.stringify({ draft, operationId, locked, payload, selectedDestinations })) } catch { /* Storage can be unavailable. */ }
    }
  }, [draft, operationId, locked, restored, storageKey, channel, payload, selectedDestinations])
  useEffect(() => {
    let cancelled = false
    const query = `?tenant=${encodeURIComponent(tenantId)}`
    setAudience(null); setError(''); setRecipientError(''); setSenderError('')
    void json(`/api/communications/recipients${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactIds: recoveryOf ? [] : selectionKey.split(','), channel, recoveryOf }) })
      .then(result => { if (!cancelled) setAudience(result) }).catch(error => { if (!cancelled) setRecipientError(error.message) })
    if (channel === 'email') {
      void json(`/api/communications/senders${query}`).then(result => {
        if (cancelled) return
        setSenders(recoveryOf ? result.senders.filter((item: OrganisationSender) => item.email === SHOWCASE_SENDER && item.name === 'Headliner Music Academy') : result.senders)
        setDraft(current => ({ ...current, senderEmail: current.senderEmail || result.senders[0]?.email || '' }))
        if (recoveryOf && !result.senders.some((item: OrganisationSender) => item.email === SHOWCASE_SENDER && item.name === 'Headliner Music Academy')) setSenderError('The Headliner Music Academy sender is unavailable. Check Organisation email settings.')
        else if (!result.senders.length) setSenderError("Set up your organization email in Settings. If you don't have permission, ask the account owner.")
      }).catch(error => { if (!cancelled) setSenderError(error.message) })
      void json(`/api/conversations/signature${query}`).then(result => { if (!cancelled) setSignature(result) }).catch(() => {})
      void json(`/api/conversations/templates${query}`).then(result => { if (!cancelled) setTemplates(result.templates || []) }).catch(() => {})
    }
    return () => { cancelled = true }
  }, [tenantId, selectionKey, channel, recoveryOf])
  const sender = senders.find(sender => sender.email === draft.senderEmail)
  const available = audience?.recipients || []
  const selected = selectedDestinations === null ? null : new Set(selectedDestinations)
  const destinations = available.filter(row => selected === null || selected.has(row.destination)).map(row => row.destination)
  const signatureHtml = signature?.personal ? conversationSignatureHtml(signature, '') : sender?.signatureHtml ? sanitizePrototypeHtml(sender.signatureHtml) : signature && sender ? conversationSignatureHtml({ ...signature, name: sender.name, title: sender.mine ? signature.title : '' }, sender.name) : ''

  async function send(body: string, html: string) {
    if (!audience || !sender || sending) return
    if (recoveryOf && (payload ? !payload.destinations?.length : !destinations.length)) return
    setSending(true); setError('')
    const id = recoveryOf ? SHOWCASE_RECOVERY_OPERATION : operationId || crypto.randomUUID()
    const immutable = payload || { body, html, version: audience.version, senderEmail: sender.email, subject: draft.subject, ...(recoveryOf ? { destinations } : {}) }
    setPayload(immutable)
    setOperationId(id); setLocked(true)
    // Freeze the payload once delivery begins; repeated calls only continue the
    // same durable operation and never resend a confirmed/unknown destination.
    try {
      let result: { sent: number; failed: number; uncertain: number; pending: number }
      do {
        result = await json(`/api/communications/email?tenant=${encodeURIComponent(tenantId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactIds, ...immutable, operationId: id, recoveryOf }) })
        setNotice(`${result.sent} emails sent.${result.pending ? ` ${result.pending} remaining.` : ''}${result.failed ? ` ${result.failed} could not be sent.` : ''}${result.uncertain ? ` ${result.uncertain} need checking in the shared mailbox’s Sent folder. Do not resend them.` : ''}`)
      } while (result.pending && !result.failed && !result.uncertain)
      if (!result.pending && !result.failed && !result.uncertain) {
        sessionStorage.removeItem(storageKey)
        onClose()
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Check Sent before trying again.') } finally { setSending(false) }
  }

  if (!audience) return <div style={{ padding: spacing.lg, display: 'grid', gap: spacing.lg }}>
    {recipientError ? <Notice variant="error">{recipientError}</Notice> : 'Checking recipients…'}
    {senderError && <Notice variant="error">{senderError}</Notice>}
  </div>
  if (channel === 'sms') return <ComposePanel recipientIds={contactIds} recipientCount={audience.recipients.length} filterExplanation="" channel="sms" composeSource="scratch" draft={{ body: smsBody, onChange: updateSmsBody }} onClose={onClose} onSent={() => { try { sessionStorage.removeItem(smsStorageKey) } catch { /* Delivery already completed. */ } onClose() }} resolvedAudience={{ count: audience.recipients.length, version: audience.version, recipients: audience.recipients }} excludedRecipients={audience.excluded} />
  const count = recoveryOf ? destinations.length : audience.recipients.length
  return <>
    {recoveryOf && <Notice style={{ margin: spacing.lg }}>Only selected recipients will get this email. Unchecked addresses stay in Not sent. The draft already has a closing; remove it if you add your own signature.</Notice>}
    {senderError && <Notice variant="error" style={{ margin: spacing.lg }}>{senderError}</Notice>}
    {error && <Notice variant="error" style={{ margin: spacing.lg }}>{error}</Notice>}
    <div style={{ margin: audience.excluded.length ? spacing.lg : 0 }}><ExcludedRecipientsNotice contacts={audience.excluded} channel="email" /></div>
    {notice && <p role="status" style={{ margin: spacing.lg }}>{notice}</p>}
    <PrototypeEmailComposer name="" email="" student="" people={[]} templates={templates} onCreateTemplate={template => setTemplates(current => [...current, template])}
      draft={draft} onChange={value => { if (!locked) setDraft({ ...value, senderEmail: draft.senderEmail }) }}
      onSend={send} onCollapse={onClose} onDiscard={() => { if (sending) return; if (window.confirm(locked ? 'Close this send? Emails already submitted cannot be recalled.' : 'Discard this email draft?')) { sessionStorage.removeItem(storageKey); onClose() } }}
      replying={false} signatureHtml={signatureHtml} signatureImageUrl={signature?.logoUrl} companyLogoUrl={signature?.companyLogoUrl} includeSignatureByDefault={!recoveryOf} senderName={sender?.name || ''} senderEmail={sender?.email || ''}
      disabled={sending || locked || !sender || !count} sendLabel={sending ? 'Sending…' : `Send ${count} ${count === 1 ? 'email' : 'emails'}`}
      fromControl={<Select aria-label="Send email from" value={sender?.email || ''} disabled={sending || locked || !senders.length} onChange={event => setDraft({ ...draft, senderEmail: event.target.value })}>{!sender && <option value="">{senders.length ? 'Select a sender' : 'Set up organisation email in Settings'}</option>}{senders.map(item => <option key={item.email} value={item.email}>{item.mine ? 'Me — ' : ''}{item.name} — {item.email}</option>)}</Select>}
      recipientSummary={<div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }}><span>{recoveryOf && locked ? `${payload?.destinations?.length ?? 0} selected for this send` : recoveryOf ? `${count} of ${available.length} selected` : `${count} ${count === 1 ? 'recipient' : 'recipients'}`}</span>{recoveryOf && <Button variant="secondary" size="sm" disabled={locked || sending || !available.length} onClick={() => setEditingRecipients(true)}>Manage recipients</Button>}</div>} />
    {recoveryOf && editingRecipients && <Modal isOpen onClose={() => setEditingRecipients(false)} ariaLabel="Select email recipients" size="lg">
      <ModalHeader title="Select email recipients" onClose={() => setEditingRecipients(false)} compact />
      <ModalBody style={{ display: 'flex', flexDirection: 'column' }}>
        <PrototypeRecipientSearch label="campaign recipients" channel="email" people={available.map(row => ({ id: row.destination, email: row.destination, name: row.name || row.destination, phone: '', student: '' }))} selected={destinations} onChange={setSelectedDestinations} fill />
      </ModalBody>
      <ModalFooter><Button onClick={() => setEditingRecipients(false)}>Done</Button></ModalFooter>
    </Modal>}
    {locked && !sending && <div style={{ padding: spacing.lg, display: 'flex', gap: spacing.sm }}><Button variant="secondary" onClick={onClose}>{recoveryOf ? 'Back to Campaigns' : 'Close'}</Button>{payload && (!recoveryOf || payload.destinations?.length) && <Button onClick={() => void send(payload.body, payload.html)}>Check progress / continue unsent emails</Button>}</div>}
  </>
}