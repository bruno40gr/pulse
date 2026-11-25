'use client'

import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { useContext, useEffect, useRef, useState } from 'react'
import { ProfileComposerCancelContext } from '@/components/inbox/ProfileComposerToolbar'
import { CommunicationCanvas } from '@/beta-source/app/content-studio-prototype/students/StudentCommunication'
import PrototypeEmailComposer from '@/components/inbox/PrototypeEmailComposer'
import { Notice, Select } from '@/components/ui'
import { personThread, type ConversationPerson, type LiveThread } from '@/lib/conversations-live'
import { smsDestination, type RecipientResolution } from '@/lib/communication-recipients'
import { formatPhoneNumber } from '@/lib/phone'
import { conversationSignatureHtml, type ConversationSignature } from '@/lib/conversation-signature'
import type { OrganisationSender } from '@/lib/organisation-email-policy'
import type { MockTemplate } from '@/lib/prototype-messaging'

type Target = { id: string; address: string; name: string; canSend: boolean }
type InboxThread = { other_phone: string; messages: { id: string; direction: 'inbound' | 'outbound'; body: string; created_at: string }[] }
type Mailbox = { id: string; email: string; canSend: boolean }

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const body = await response.json()
  if (!response.ok) throw Object.assign(new Error(body.error || 'Request failed.'), { retryable: body.retryable === true })
  return body
}
const post = (body: object): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export default function LiveContactCommunication({ tenantId, channel, contactIds, destination, name, drafts, onDraft }: {
  tenantId: string; channel: 'sms' | 'email'; contactIds: string[]; destination: string; name: string
  drafts: Record<string, string>; onDraft: (key: string, value: string) => void
}) {
  const profileCompose = !!useContext(ProfileComposerCancelContext)
  const tenant = `tenant=${encodeURIComponent(tenantId)}`
  const ids = contactIds.join(',')
  const [target, setTarget] = useState<Target | null>(null)
  const [smsTargets, setSmsTargets] = useState<Target[]>([])
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
  const [senders, setSenders] = useState<OrganisationSender[]>([])
  const [senderId, setSenderId] = useState('')
  const [templates, setTemplates] = useState<MockTemplate[]>([])
  const [signature, setSignature] = useState<ConversationSignature | null>(null)
  const [setupLoading, setSetupLoading] = useState(channel === 'email')
  const [setupError, setSetupError] = useState('')
  const [sms, setSms] = useState<LiveThread['messages']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const historyRefresh = profileCompose ? 0 : refresh
  const locked = useRef(false)
  const normalize = channel === 'sms' ? smsDestination : normalizeEmail
  const mailbox = mailboxes.find(item => item.canSend)
  const sender = senders.find(item => item.email === senderId) ?? senders[0]
  const prefix = `${tenantId}:${channel}:${ids}:${channel === 'sms' ? target?.address || destination : destination}`

  useEffect(() => {
    if (channel !== 'email') return
    const controller = new AbortController()
    const { signal } = controller
    setSetupLoading(true); setSetupError('')
    void Promise.allSettled([
      json<{ mailboxes: Mailbox[] }>(`/api/conversations/email?${tenant}`, { signal }).then(data => { if (!signal.aborted) setMailboxes(data.mailboxes) }),
      json<{ senders: OrganisationSender[] }>(`/api/communications/senders?${tenant}`, { signal }).then(data => { if (!signal.aborted) setSenders(data.senders) }),
      json<{ templates: MockTemplate[] }>(`/api/conversations/templates?${tenant}`, { signal }).then(data => { if (!signal.aborted) setTemplates(data.templates) }),
      json<ConversationSignature>(`/api/conversations/signature?${tenant}`, { signal }).then(data => { if (!signal.aborted) setSignature(data) }),
    ]).then(results => {
      if (signal.aborted) return
      const failure = results.find(result => result.status === 'rejected')
      if (failure?.status === 'rejected') setSetupError(failure.reason instanceof Error ? failure.reason.message : 'Could not load email settings.')
      setSetupLoading(false)
    })
    return () => controller.abort()
  }, [channel, tenant])

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    setLoading(true); setError(''); setTarget(null); setSmsTargets([]); setSendError('')
    void (async () => {
      const [audience, directory] = await Promise.all([
        json<RecipientResolution>(`/api/communications/recipients?${tenant}`, { ...post({ contactIds: ids.split(','), channel }), signal }).catch(error => {
          // History is a read permission; send-only verification may be denied.
          if (channel === 'email') return null
          throw error
        }),
        json<{ people: ConversationPerson[] }>(`/api/conversations?${tenant}`, { signal }),
      ])
      const address = normalize(destination)
      if (channel === 'sms') {
        const targets = (audience?.recipients || []).flatMap(recipient => {
          const person = directory.people.find(item => recipient.contactIds.some(id => item.id === `person:${id}`))
          return person ? [{ id: person.id, address: recipient.destination, name: recipient.name, canSend: true }] : []
        })
        if (!targets.length) throw new Error('The recipient could not be verified. Check the contact’s saved routing.')
        if (signal.aborted) return
        setSmsTargets(targets)
        setTarget(targets.find(item => item.address === address) || targets[0])
      }
      const verified = audience?.recipients.find(item => item.destination === address)
      const allowedIds = verified?.contactIds ?? ids.split(',')
      const candidate = directory.people.find(item => allowedIds.some(id => item.id === `person:${id}`) && normalize(channel === 'sms' ? item.phone : item.email) === address)
      if (channel === 'email' && (!candidate || !address)) throw new Error('The recipient could not be verified. Check the contact’s saved routing.')
      if (signal.aborted) return
      if (channel === 'email' && candidate) setTarget({ id: candidate.id, address, name: verified?.name || candidate.name, canSend: !!verified })
      if (channel === 'sms' && !profileCompose) {
        const inbox = await json<InboxThread[]>(`/api/inbox?${tenant}`, { signal })
        const messages = inbox.filter(thread => smsDestination(thread.other_phone) === address).flatMap(thread => thread.messages)
        if (!signal.aborted) setSms([...new Map(messages.map(item => [item.id, item])).values()].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(item => ({ id: item.id, channel: 'sms', direction: item.direction, body: item.body || '', timestamp: item.created_at, time: '' })))
      }
    })().catch(error => { if (!signal.aborted) setError(error.message) }).finally(() => { if (!signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [channel, destination, ids, normalize, historyRefresh, tenant, profileCompose])

  async function send(url: string, payload: object, done: () => void) {
    if (locked.current) return
    locked.current = true; setSending(true); setSendError('')
    try { await json(url, post(payload)); done(); if (channel === 'sms') setRefresh(n => n + 1) }
    catch (error) { setSendError(error instanceof Error ? error.message : 'The message could not be sent.') }
    finally { locked.current = false; setSending(false) }
  }

  const contact = { name: target?.name || name, phone: channel === 'sms' ? formatPhoneNumber(target?.address || destination) : '', email: channel === 'email' ? destination : '' }
  const smsThread = { ...personThread({ ...contact, id: prefix, student: '', stage: '', profileType: null, profileId: null, smsContactId: null }), messages: sms }
  if (loading || setupLoading) return <LoadingSkeleton label="Loading composer" />
  if (error || setupError) return <Notice variant="error">{error || setupError}</Notice>
  return <CommunicationCanvas composeInPlace person={contact} channel={channel} smsThread={smsThread} threads={[]} draftPrefix={prefix} drafts={drafts} onDraft={onDraft}
    smsRecipientControl={smsTargets.length > 1 ? <Select aria-label="SMS account holder" controlSize="compact" fullWidth={false} value={target?.address || ''} disabled={sending} onChange={event => { const next = smsTargets.find(item => item.address === event.target.value); if (next) { setTarget(next); setSendError('') } }}>
      {smsTargets.map(item => <option key={item.address} value={item.address}>{item.name} — {formatPhoneNumber(item.address)}</option>)}
    </Select> : undefined}
    notice={sendError ? <Notice variant="error">{sendError}</Notice> : undefined}
    liveSms={{ disabled: !target || loading || sending || !!error, onSend: body => {
      if (target) void send(`/api/inbox/reply?${tenant}`, { contact_id: target.id.slice('person:'.length), to_phone: target.address, body }, () => onDraft(`${prefix}:sms`, ''))
    }, onDraft: async () => {
      const result = await json<{ text?: string; draft?: string }>(`/api/draft-message?${tenant}`, post({ description: drafts[`${prefix}:sms`] || 'Write a warm friendly reply', recipient_context: `Writing to ${contact.name}.` }))
      return result.text || result.draft || ''
    } }}
    renderEmail={({ draft, onChange, onBack, replying }) => {
      return <>
        {sendError && <Notice variant="error">{sendError}</Notice>}
        <PrototypeEmailComposer name={contact.name} email={contact.email} student="" draft={draft} onChange={onChange}
          onSend={(body, html) => {
            if (!target?.canSend || !mailbox || !sender) return
            void send(`/api/conversations/email?${tenant}`, { mailboxId: mailbox.id, senderEmail: sender.email, to: [target.id], cc: [], bcc: [], subject: draft.subject, body, html, expectedContactEmail: target.address }, () => { onChange({ subject: '', html: '' }); onBack() })
          }} disabled={!target?.canSend || !mailbox || !sender || sending}
          senderName={sender?.name || ''} senderEmail={sender?.email || ''}
          fromControl={<Select aria-label="Send email from" value={sender?.email || ''} onChange={event => setSenderId(event.target.value)} disabled={sending || !senders.length}>
            {!sender && <option value="">No authorised sender</option>}{senders.map(item => <option key={item.id} value={item.email}>{item.name} — {item.email}</option>)}
          </Select>}
          signatureHtml={signature?.personal ? conversationSignatureHtml(signature, sender?.name || '') : sender?.signatureHtml || (signature && sender ? conversationSignatureHtml(signature, sender.name) : '')}
          signatureImageUrl={signature?.logoUrl} companyLogoUrl={signature?.companyLogoUrl}
          people={[]} templates={templates} onCreateTemplate={template => setTemplates(items => [...items, template])} onCollapse={onBack} onDiscard={() => { onChange({ subject: '', html: '' }); onBack() }} replying={replying} />
      </>
    }} />
}

function normalizeEmail(value: string) { return value.trim().toLowerCase() }