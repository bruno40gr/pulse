'use client'

import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { useEffect, useRef, useState } from 'react'
import { CommunicationCanvas, type CommunicationThread } from '@/beta-source/app/content-studio-prototype/students/StudentCommunication'
import PrototypeEmailComposer from '@/components/inbox/PrototypeEmailComposer'
import { Notice, Select } from '@/components/ui'
import { personThread, type ConversationPerson, type LiveThread } from '@/lib/conversations-live'
import { smsDestination, type RecipientResolution } from '@/lib/communication-recipients'
import { formatPhoneNumber } from '@/lib/phone'
import { loadConversationEmailPages } from '@/lib/conversation-email-pages'
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
  const tenant = `tenant=${encodeURIComponent(tenantId)}`
  const ids = contactIds.join(',')
  const [target, setTarget] = useState<Target | null>(null)
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
  const [senders, setSenders] = useState<OrganisationSender[]>([])
  const [senderId, setSenderId] = useState('')
  const [templates, setTemplates] = useState<MockTemplate[]>([])
  const [signature, setSignature] = useState<ConversationSignature | null>(null)
  const [setupLoading, setSetupLoading] = useState(channel === 'email')
  const [setupError, setSetupError] = useState('')
  const [threads, setThreads] = useState<LiveThread[]>([])
  const [sms, setSms] = useState<LiveThread['messages']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const locked = useRef(false)
  const normalize = channel === 'sms' ? smsDestination : normalizeEmail
  const mailbox = mailboxes.find(item => item.canSend)
  const sender = senders.find(item => item.email === senderId) ?? senders[0]
  const prefix = `${tenantId}:${channel}:${ids}:${destination}`

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
    setLoading(true); setError(''); setTarget(null)
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
      const verified = audience?.recipients.find(item => item.destination === address)
      const allowedIds = verified?.contactIds ?? ids.split(',')
      const candidate = directory.people.find(item => allowedIds.some(id => item.id === `person:${id}`) && normalize(channel === 'sms' ? item.phone : item.email) === address)
      if (!candidate || !address || channel === 'sms' && !verified) throw new Error('The recipient could not be verified. Check the contact’s saved routing.')
      if (signal.aborted) return
      setTarget({ id: candidate.id, address, name: verified?.name || candidate.name, canSend: !!verified })
      if (channel === 'sms') {
        const inbox = await json<InboxThread[]>(`/api/inbox?${tenant}`, { signal })
        const messages = inbox.filter(thread => smsDestination(thread.other_phone) === address).flatMap(thread => thread.messages)
        if (!signal.aborted) setSms([...new Map(messages.map(item => [item.id, item])).values()].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(item => ({ id: item.id, channel: 'sms', direction: item.direction, body: item.body || '', timestamp: item.created_at, time: '' })))
      }
    })().catch(error => { if (!signal.aborted) setError(error.message) }).finally(() => { if (!signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [channel, destination, ids, normalize, refresh, tenant])

  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [syncPending, setSyncPending] = useState(false)
  useEffect(() => {
    if (channel !== 'email' || !target || !mailboxes.length) return
    const controller = new AbortController()
    const { signal } = controller
    const history = new Map<string, LiveThread>()
    setHistoryLoading(true); setHistoryError('')
    const pendingMailboxes = new Set<string>()
    void Promise.all(mailboxes.map(box => loadConversationEmailPages<LiveThread>(async cursor => {
      const params = new URLSearchParams({ tenant: tenantId, mailbox: box.id, person: target.id, from: '2000-01-01', to: new Date().toISOString().slice(0, 10) })
      if (cursor) params.set('cursor', cursor)
      const result = await json<{ threads: LiveThread[]; nextCursor?: string; sync?: { state: string } }>(`/api/conversations/email?${params}`, { signal })
      if (result.sync && result.sync.state !== 'complete') pendingMailboxes.add(box.id)
      return result
    }, rows => {
      for (const row of rows) history.set(row.id, row)
      if (!signal.aborted) setThreads([...history.values()].sort((a, b) => (b.messages.at(-1)?.timestamp || '').localeCompare(a.messages.at(-1)?.timestamp || '')))
    }, () => signal.aborted))).then(() => { if (!signal.aborted) setSyncPending(pendingMailboxes.size > 0) }).catch(error => { if (!signal.aborted) setHistoryError(error.message) }).finally(() => { if (!signal.aborted) setHistoryLoading(false) })
    return () => controller.abort()
  }, [channel, mailboxes, target, tenantId])

  useEffect(() => {
    if (!syncPending || historyLoading || loading || historyError || error) return
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') setRefresh(value => value + 1)
    }, 15000)
    return () => window.clearTimeout(timer)
  }, [syncPending, historyLoading, loading, historyError, error])

  async function send(url: string, payload: object, done: () => void) {
    if (locked.current) return
    locked.current = true; setSending(true); setSendError('')
    try { await json(url, post(payload)); done(); setRefresh(n => n + 1) }
    catch (error) { setSendError(error instanceof Error ? error.message : 'The message could not be sent.') }
    finally { locked.current = false; setSending(false) }
  }

  const contact = { name: target?.name || name, phone: channel === 'sms' ? formatPhoneNumber(destination) : '', email: channel === 'email' ? destination : '' }
  const smsThread = { ...personThread({ ...contact, id: prefix, student: '', stage: '', profileType: null, profileId: null, smsContactId: null }), messages: sms }
  const emailThreads: CommunicationThread[] = threads.filter(thread => thread.messages.length).map(thread => ({ id: thread.id, subject: thread.subject || 'No subject', messages: thread.messages.map(item => ({ id: item.id, direction: item.direction, text: item.body, timestamp: item.timestamp || '', from: item.emailFrom, to: item.emailTo?.join(', ') })) }))
  if (loading || setupLoading) return <LoadingSkeleton label="Loading composer" />
  if (error || setupError) return <Notice variant="error">{error || setupError}</Notice>
  return <CommunicationCanvas composeInPlace person={contact} channel={channel} smsThread={smsThread} threads={emailThreads} draftPrefix={prefix} drafts={drafts} onDraft={onDraft}
    emailHistoryPending={loading || historyLoading || syncPending || !!historyError || !!error}
    notice={(error || historyError || sendError) ? <Notice variant="error">{sendError || error || historyError}</Notice> : (loading || historyLoading || syncPending) ? <LoadingSkeleton label="Loading conversation" /> : undefined}
    liveSms={{ disabled: !target || loading || sending || !!error, onSend: body => {
      if (target) void send(`/api/inbox/reply?${tenant}`, { contact_id: target.id.slice('person:'.length), to_phone: target.address, body }, () => onDraft(`${prefix}:sms`, ''))
    }, onDraft: async () => {
      const result = await json<{ text?: string; draft?: string }>(`/api/draft-message?${tenant}`, post({ description: drafts[`${prefix}:sms`] || 'Write a warm friendly reply', recipient_context: `Writing to ${contact.name}.` }))
      return result.text || result.draft || ''
    } }}
    renderEmail={({ draft, onChange, onBack, replying, threadId }) => {
      const thread = threads.find(item => item.id === threadId)
      return <>
        {sendError && <Notice variant="error">{sendError}</Notice>}
        <PrototypeEmailComposer name={contact.name} email={contact.email} student="" draft={draft} onChange={onChange}
          onSend={(body, html) => {
            if (!target?.canSend || !mailbox || !sender || thread && thread.mailboxId !== mailbox.id) return
            void send(`/api/conversations/email?${tenant}`, { mailboxId: mailbox.id, senderEmail: sender.email, to: [target.id], cc: [], bcc: [], subject: draft.subject, body, html, threadId: thread?.providerThreadId, expectedContactEmail: target.address }, () => { onChange({ subject: '', html: '' }); onBack() })
          }} disabled={!target?.canSend || !mailbox || !sender || sending || !!(thread && thread.mailboxId !== mailbox.id)}
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