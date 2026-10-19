'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Button, Input, PageContainer, PageHeader, SectionTitle, Select, SurfacePanel, Modal, ModalHeader, ModalBody, ModalFooter, SlidePanel } from '@/components/ui'
import { useIdentity } from '@/components/layout/IdentityProvider'
import { useWorkspaceHistory } from '@/lib/useWorkspaceHistory'
import { BackControl } from '@/components/ui/BackControl'
import { ControlButton } from '@/components/ui/ControlButton'
import { PersonName } from '@/components/ui/PersonName'
import { EmptyState } from '@/components/ui/EmptyState'
import PrototypeEmailComposer, { type PrototypeEmailDraft } from '@/components/inbox/PrototypeEmailComposer'
import PrototypeSmsConversation from '@/components/inbox/PrototypeSmsConversation'
import { colors, spacing, typography } from '@/lib/tokens'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { groupPrototypeContacts, type PrototypeChannel, type PrototypeMessage } from '@/lib/conversations-prototype'
import { getActiveTenantId } from '@/lib/tenant'
import { useSearchParams } from 'next/navigation'
import { mergeConversationThreads, personThread, type ConversationPerson, type LiveThread, type Mailbox } from '@/lib/conversations-live'
import ConversationProfilePanel from '@/components/inbox/ConversationProfilePanel'
import ComposePanel from '@/components/campaigns/ComposePanel'
import SmsRecipientPicker from '@/components/inbox/SmsRecipientPicker'
import PrototypeNewMessage from '@/components/inbox/PrototypeNewMessage'
import { initialMockTemplates, type MockEmailRecipients } from '@/lib/prototype-messaging'
import { prototypeHtmlText, prototypePreviewDocument } from '@/lib/conversations-prototype-html'
import { resolveConversationRecipient } from '@/lib/conversation-links'
import { createConversationEmailPreview } from '@/lib/conversations-email-preview'
import { compareConversations, CONVERSATIONS_HOME_EVENT, lastContactTimestamp, newestEmail, type ConversationSort } from '@/lib/conversation-display'
import { ProfilePanelSkeleton } from '@/components/ui/ProfilePanelSkeleton'
import type { ConversationChannel } from '@/lib/conversation-links'

const meta: CSSProperties = { ...typography.bodySmall, color: colors.textSecondary }
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: spacing.lg, flexWrap: 'wrap' }
const pane: CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }

type ConversationLocation = {
  view: 'contacts' | 'contact' | 'compose' | 'sms-compose'
  contactId: string
  channel: PrototypeChannel
  activeId: string
  screen: 'list' | 'reader'
}
const initialLocation: ConversationLocation = { view: 'contacts', contactId: '', channel: 'sms', activeId: '', screen: 'list' }

async function requestJson(url: string, options?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...options })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.')
  return data
}

type SmsInboxThread = {
  thread_key: string; contact_id: string | null; other_phone: string; display_name: string; student_name: string; client_status: string
  profile_type: 'contact' | 'lead' | null; profile_id: string | null; profile_intake_type: string | null; has_unread: boolean
  messages: { id: string; body: string; direction: 'inbound' | 'outbound'; status: string; created_at: string }[]
}

function EmailBody({ message }: { message: PrototypeMessage }) {
  if (message.html) return <iframe title={`Email content ${message.id}`} sandbox="" referrerPolicy="no-referrer" srcDoc={prototypePreviewDocument(message.html)} style={{ width: '100%', height: 450, border: 0 }} />
  return <div style={{ ...typography.body, lineHeight: 1.85, overflowWrap: 'anywhere' }}>
    {message.body.split('\n\n').map((paragraph, index) => <p key={index} style={{ margin: `${spacing.xl} 0`, whiteSpace: 'pre-line' }}>{paragraph}</p>)}

  </div>
}

function EmailDirection({ direction }: { direction: 'inbound' | 'outbound' }) {
  return <span role="img" aria-label={direction === 'outbound' ? 'Outbound email' : 'Inbound email'} title={direction === 'outbound' ? 'Outbound email' : 'Inbound email'} style={{ color: direction === 'outbound' ? colors.tealDark : colors.crimson, fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{direction === 'outbound' ? '↗' : '↙'}</span>
}

export default function Conversations({ emailPreview: previewEnabled = false, embedded }: { emailPreview?: boolean; embedded?: { recipient: string; channel: ConversationChannel; onClose: () => void } }) {
  const [emailPreview, setEmailPreview] = useState(previewEnabled)
  const { identity } = useIdentity()
  const senderName = identity?.fullName?.trim() || 'Your mailbox'
  const signatureHtml = ''
  const [threads, setThreads] = useState<LiveThread[]>([])
  const [people, setPeople] = useState<ConversationPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const sendLock = useRef(false)
  const [mailboxes, setMailboxes] = useState<(Mailbox & { canSend: boolean })[]>([])
  const [mailboxId, setMailboxId] = useState('')
  const [mailboxesLoaded, setMailboxesLoaded] = useState(false)
  const [emailCursor, setEmailCursor] = useState<string | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [loadedEmailPeople, setLoadedEmailPeople] = useState<string[]>([])
  const [profile, setProfile] = useState<ConversationPerson | null>(null)
  const [bulkReview, setBulkReview] = useState(false)
  const [tenantId, setTenantId] = useState('')
  const searchParams = useSearchParams()
  const campaignId = embedded ? null : searchParams.get('campaign')
  const requestedRecipient = embedded?.recipient || searchParams.get('recipient')
  const requestedChannel = embedded?.channel || searchParams.get('channel')
  const requestedTenant = embedded ? null : searchParams.get('tenant')
  const requestedCompose = embedded ? '1' : searchParams.get('compose')
  const handledComposeLink = useRef('')
  const [composeLinkError, setComposeLinkError] = useState('')
  useEffect(() => { setTenantId(getActiveTenantId()) }, [])
  const mailbox = mailboxes.find(item => item.id === mailboxId)
  const previewHistory = emailPreview && mailboxesLoaded && !mailboxes.length
  const senderEmail = mailbox?.email || (emailPreview ? 'preview@example.com' : '')
  const canComposeEmail = emailPreview || !!mailbox?.canSend

  const [location, setLocation] = useState<ConversationLocation>(initialLocation)
  const [emailDrafts, setEmailDrafts] = useState<Record<string, PrototypeEmailDraft>>({})
  const [smsDrafts, setSmsDrafts] = useState<Record<string, string>>({})
  const [discardOpen, setDiscardOpen] = useState(false)
  const [leaveSmsOpen, setLeaveSmsOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [newSms, setNewSms] = useState<{ id: string; ids: string[]; body: string } | null>(null)
  const [editingSmsRecipients, setEditingSmsRecipients] = useState(false)
  const [smsRecipientQuery, setSmsRecipientQuery] = useState('')
  const [newMessageOpen, setNewMessageOpen] = useState(false)
  const [templates, setTemplates] = useState(() => initialMockTemplates().filter(template => template.channel === 'sms'))
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<ConversationSort>('time')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const workspace = useRef<HTMLDivElement>(null)
  const [workspaceHeight, setWorkspaceHeight] = useState<number>()
  const remembered = useRef<Record<string, ConversationLocation>>({})
  const draftSequence = useRef(0)
  const heading = useRef<HTMLDivElement>(null)
  const reader = useRef<HTMLElement>(null)
  const replyEditor = useRef<HTMLDivElement>(null)
  const mobile = useMediaQuery('(max-width: 760px)')
  const wide = useMediaQuery('(min-width: 1000px)')
  const desktop = wide && !embedded
  const history = useWorkspaceHistory(initialLocation, next => {
    if (next.view !== 'contacts' && next.view !== 'sms-compose') remembered.current[next.contactId] = { ...next, view: 'contact' }
    setDiscardOpen(false)
    setLeaveSmsOpen(false)
    setEditingSmsRecipients(false)
    setLocation(next)
  }, !embedded)
  const refreshSms = useCallback(async () => {
    if (!tenantId) return
    const [directory, inbox] = await Promise.all([
      requestJson(`/api/conversations?tenant=${tenantId}`),
      requestJson(`/api/inbox?tenant=${tenantId}${campaignId ? `&campaign_id=${encodeURIComponent(campaignId)}` : ''}`),
    ])
    const nextPeople: ConversationPerson[] = directory.people
    const smsThreads: LiveThread[] = (inbox as SmsInboxThread[]).map(thread => {
      let person = nextPeople.find(person => person.profileId && person.profileId === thread.profile_id && person.profileType === thread.profile_type)
      if (!person) {
        person = { id: `phone:${thread.thread_key}`, name: thread.display_name || thread.other_phone, phone: thread.other_phone, email: '', student: thread.student_name || '', stage: thread.client_status || '', profileType: thread.profile_type, profileId: thread.profile_id, intakeType: thread.profile_intake_type || undefined, smsContactId: thread.contact_id }
        nextPeople.push(person)
      }
      return { ...personThread(person), id: `sms:${thread.thread_key}`, phone: thread.other_phone, unread: thread.has_unread,
        messages: thread.messages.slice().sort((a, b) => a.created_at.localeCompare(b.created_at)).map(message => ({
          id: message.id, channel: 'sms', direction: message.direction, body: message.body || '', timestamp: message.created_at,
          time: `${new Date(message.created_at).toLocaleString()}${message.direction === 'outbound' ? ` · ${message.status}` : ''}`,
          unread: message.direction === 'inbound' && message.status !== 'read',
        })) }
    })
    setPeople(nextPeople)
    setThreads(current => [...smsThreads, ...current.filter(thread => thread.channel === 'email')])
    setLoadError('')
  }, [tenantId, campaignId])
  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    void refreshSms().catch(error => { if (!cancelled) setLoadError(error.message) }).finally(() => { if (!cancelled) setLoading(false) })
    const interval = window.setInterval(() => { void refreshSms().catch(() => {}) }, 15000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [refreshSms, tenantId])
  useEffect(() => {
    if (embedded) return
    const reset = () => {
      setLocation(initialLocation)
      setProfile(null)
      setNewMessageOpen(false)
      setSearch(''); setDateFrom(''); setDateTo('')
      remembered.current = {}
      // Remove recipient-compose parameters so another click cannot reopen a draft.
      window.history.replaceState({ ...window.history.state, odeonWorkspace: undefined }, '', window.location.pathname)
      void refreshSms().catch(error => setLoadError(error.message))
    }
    window.addEventListener(CONVERSATIONS_HOME_EVENT, reset)
    return () => window.removeEventListener(CONVERSATIONS_HOME_EVENT, reset)
  }, [refreshSms, embedded])
  useEffect(() => {
    const resize = () => {
      if (workspace.current) setWorkspaceHeight(Math.max(280, window.innerHeight - workspace.current.getBoundingClientRect().top - 20))
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [location.view, loading, mobile])
  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    void requestJson(`/api/conversations/email?tenant=${tenantId}`).then(data => {
      if (cancelled) return
      setMailboxes(data.mailboxes); setMailboxId(current => current || data.mailboxes[0]?.id || ''); setMailboxesLoaded(true)
      if (data.emailPreview === true) setEmailPreview(true)
    }).catch(error => { if (!cancelled) setEmailError(error.message) })
    return () => { cancelled = true }
  }, [tenantId])
  useEffect(() => {
    if (!previewHistory) return
    const sampleThreads = createConversationEmailPreview(people)
    setThreads(current => [...current.filter(thread => !thread.id.startsWith('preview-email:')), ...sampleThreads])
    setLoadedEmailPeople(sampleThreads.map(thread => thread.contactId))
  }, [previewHistory, people])
  const emailRequest = useRef(0)
  const loadEmails = useCallback(async (personId: string, cursor?: string) => {
    if (!mailboxId || !personId || !tenantId || !people.some(person => person.id === personId && person.email.trim())) return
    const request = ++emailRequest.current
    setEmailLoading(true); setEmailError('')
    try {
      const params = new URLSearchParams({ tenant: tenantId, mailbox: mailboxId, person: personId })
      if (cursor) params.set('cursor', cursor)
      const data = await requestJson(`/api/conversations/email?${params}`)
      if (request !== emailRequest.current) return
      setThreads(current => [...current.filter(thread => thread.channel !== 'email' || thread.contactId !== personId || ((cursor || emailDrafts[thread.id]) && !data.threads.some((next: LiveThread) => next.id === thread.id))),
        ...data.threads as LiveThread[]])
      setEmailCursor(data.nextCursor)
      setLoadedEmailPeople(current => [...new Set([...current, personId])])
    } catch (error) { if (request === emailRequest.current) setEmailError(error instanceof Error ? error.message : 'Could not load email.') }
    finally { if (request === emailRequest.current) setEmailLoading(false) }
  }, [tenantId, mailboxId, emailDrafts, people])
  useEffect(() => {
    if (!location.contactId || location.view === 'contacts' || location.view === 'sms-compose') return
    void loadEmails(location.contactId)
    const requestRef = emailRequest
    return () => { requestRef.current++ }
    // Draft changes must not refetch and replace the reader while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.channel, location.contactId, location.view, mailboxId, tenantId])
  const pageFocusKey = location.view === 'sms-compose' ? 'sms-compose' : location.view === 'contacts' ? 'contacts' : `${location.contactId}-conversation`
  useEffect(() => { heading.current?.focus() }, [pageFocusKey])
  useEffect(() => {
    if (location.view !== 'compose' || !reader.current || !replyEditor.current) return
    const panel = reader.current
    const editorTop = replyEditor.current.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop
    // Leave a real slice of the preceding message visible, rather than a banner.
    panel.scrollTop = Math.max(0, editorTop - Math.min(96, panel.clientHeight * 0.2))
  }, [location.view, location.activeId])

  const contacts = groupPrototypeContacts(mergeConversationThreads(people, threads)).sort((a, b) => compareConversations(a, b, sort, sortDirection))
  const contact = contacts.find(item => item.id === location.contactId) || contacts[0] || { ...personThread({ id: '', name: 'Contact', email: '', phone: '', student: '', stage: '', profileType: null, profileId: null, smsContactId: null }), threads: [], newSms: 0, newEmails: 0 }
  const selectedPerson = people.find(person => person.id === contact.id)

  const emails = threads.filter(thread => thread.contactId === contact.id && thread.channel === 'email').sort((a, b) => lastContactTimestamp([b]).localeCompare(lastContactTimestamp([a])))
  const active = emails.find(thread => thread.id === location.activeId) || newestEmail(emails)
  const sms = threads.find(thread => thread.contactId === contact.id && thread.channel === 'sms') || { ...contact, id: `${contact.id}-sms-draft`, contactId: contact.id, channel: 'sms' as const, messages: [] }
  const draft = active ? emailDrafts[active.id] : undefined
  // Old Back/Forward entries must not recreate a sent or discarded draft.
  const contextThread = draft?.contextThreadId ? emails.find(thread => thread.id === draft.contextThreadId) : active
  const contextMessages = contextThread?.messages || []
  const composing = location.view === 'compose' && !!active && !!draft
  const composingSms = location.view === 'sms-compose' && !!newSms && location.activeId === newSms.id
  const smsRecipients = contacts.filter(person => newSms?.ids.includes(person.id))
  const singleSmsRecipient = smsRecipients.length === 1 ? smsRecipients[0] : undefined
  const newSmsThread = singleSmsRecipient ? threads.find(thread => thread.contactId === singleSmsRecipient.id && thread.channel === 'sms') || { ...singleSmsRecipient, id: `${singleSmsRecipient.id}-sms-draft`, contactId: singleSmsRecipient.id, channel: 'sms' as const, messages: [] } : undefined
  const smsOptions = contacts.map(person => ({ id: person.id, first_name: person.name.split(' ')[0], last_name: person.name.split(' ').slice(1).join(' '), phone: person.phone, email: person.email }))
  const standalone = !!draft && draft.contactOnly === false
  const latestMessage = (person: typeof contact) => person.threads.flatMap(thread => thread.messages).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).at(0)
  useEffect(() => {
    if (!requestedRecipient || loading || loadError || !tenantId) return
    const key = JSON.stringify([requestedTenant, requestedRecipient, requestedChannel, requestedCompose])
    if (handledComposeLink.current === key) return
    handledComposeLink.current = key
    const person = resolveConversationRecipient(people, requestedRecipient)
    if ((requestedTenant && requestedTenant !== tenantId) || !person || !['sms', 'email'].includes(requestedChannel || '') || requestedCompose !== '1') {
      setComposeLinkError('This recipient link is unavailable in the current account. Return to the original card and open it again.')
      return
    }
    const channel = requestedChannel as PrototypeChannel
    if (!(channel === 'email' ? person.email : person.phone)) {
      setComposeLinkError(`This recipient has no ${channel === 'email' ? 'email address' : 'phone number'}.`)
      return
    }
    setComposeLinkError('')
    if (channel === 'email') {
      // Draft creation does not require provider consent; only sending does.
      const id = `email-draft-${++draftSequence.current}`
      setThreads(current => [{ ...personThread(person), id, channel: 'email', subject: '', messages: [] }, ...current])
      setEmailDrafts(current => ({ ...current, [id]: { subject: '', html: '<p><br></p>', contactOnly: true, recipients: { to: [person.id], cc: [], bcc: [] } } }))
      history.navigate({ view: 'compose', contactId: person.id, channel, activeId: id, screen: 'reader' })
    } else {
      history.navigate({ view: 'contact', contactId: person.id, channel, activeId: '', screen: 'reader' })
      markSmsRead(person.id)
    }
    // Process a link once, never recreate drafts during polling, consent loads or Back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTenant, requestedRecipient, requestedChannel, requestedCompose, tenantId, loading, loadError, people])
  const visibleContacts = contacts.filter(person => {
    const matches = `${person.name} ${person.student} ${person.email} ${person.phone} ${person.threads.flatMap(thread => thread.messages.map(message => message.body)).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase())
    const date = latestMessage(person)?.timestamp?.slice(0, 10) || ''
    return matches && (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo)
  })
  const showEmailList = desktop || (location.screen === 'list' && emails.length > 0)
  const showReader = desktop || location.screen === 'reader' || !emails.length

  function navigate(patch: Partial<ConversationLocation>) {
    history.navigate({ ...location, ...patch })
    setNotice('')
  }
  function leaveSms() {
    setNewSms(null)
    setLeaveSmsOpen(false)
    history.close()
  }
  function goBackToConversations() {
    if (embedded) { embedded.onClose(); return }
    if (composingSms && newSms?.body.trim()) {
      setLeaveSmsOpen(true)
      return
    }
    if (location.view === 'sms-compose') leaveSms()
    else history.close()
  }
  function markSmsRead(id: string) {
    const thread = threads.find(thread => thread.contactId === id && thread.channel === 'sms' && thread.unread)
    if (!thread) return
    void requestJson(`/api/inbox?tenant=${tenantId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ other_phone: thread.phone }) }).then(() => {
      setThreads(current => current.map(item => item.id === thread.id ? { ...item, unread: false, messages: item.messages.map(message => ({ ...message, unread: false })) } : item))
      window.dispatchEvent(new CustomEvent('pulse:conversation-count-changed'))
    }).catch(error => setSendError(error.message))
  }
  function selectContact(id: string) {
    const person = contacts.find(item => item.id === id)!
    const next = remembered.current[id] || { ...initialLocation, contactId: id, channel: person.channel }
    history.navigate({ ...next, view: 'contact' })
    setNotice('')
    if (next.channel === 'sms') markSmsRead(id)
  }
  function switchChannel(channel: PrototypeChannel) {
    navigate({ view: 'contact', channel, activeId: channel === 'email' ? active?.id || '' : location.activeId, screen: channel === 'email' ? 'reader' : 'list' })
    if (channel === 'sms') markSmsRead(contact.id)
    if (channel === 'sms' && composing) setNotice('Email saved as draft.')
  }
  function readThread(id: string) {
    navigate({ view: 'contact', activeId: id, screen: 'reader' })
  }
  function openDraft() {
    if (!active) return
    setEmailDrafts(current => current[active.id] ? current : { ...current, [active.id]: { subject: active.messages.length ? `Re: ${active.subject || ''}` : active.subject || '', html: '<p><br></p>', contactOnly: true, recipients: { to: [contact.id], cc: [], bcc: [] } } })
    navigate({ view: 'compose', activeId: active.id, channel: 'email', screen: 'reader' })
  }
  function newEmail(recipients?: MockEmailRecipients) {
    // Drafting is available before provider consent; sending remains permission-gated.
    const primary = recipients ? contacts.find(person => person.id === recipients.to[0]) || contact : contact
    const id = `email-draft-${++draftSequence.current}`
    setThreads(current => [{ ...primary, id, contactId: primary.id, channel: 'email', subject: '', unread: false, messages: [] }, ...current])
    setEmailDrafts(current => ({ ...current, [id]: { subject: '', html: '<p><br></p>', contactOnly: !recipients, contextThreadId: !recipients ? active?.messages.length ? active.id : emails.find(thread => thread.messages.length)?.id : undefined, recipients: recipients || { to: [contact.id], cc: [], bcc: [] } } }))
    navigate({ view: 'compose', contactId: primary.id, activeId: id, channel: 'email', screen: 'reader' }); setNewMessageOpen(false)
  }
  function updateDraft(next: PrototypeEmailDraft) {
    if (!active) return
    setEmailDrafts(current => ({ ...current, [active.id]: { ...next, bodyText: prototypeHtmlText(next.html) } }))
    if (!active.messages.length) setThreads(current => current.map(thread => thread.id === active.id ? { ...thread, subject: next.subject } : thread))
  }
  async function sendSms(body = smsDrafts[sms.id] || '', mediaUrl = '') {
    if (!body.trim() || !contact.phone || sendLock.current) return
    sendLock.current = true; setSending(true); setSendError('')
    try {
      await requestJson(`/api/inbox/reply?tenant=${tenantId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: selectedPerson?.smsContactId || null, body, to_phone: contact.phone, media_url: mediaUrl || undefined }) })
      setSmsDrafts(current => ({ ...current, [sms.id]: '' }))
      setNotice('Text message submitted.')
      await refreshSms().catch(() => setNotice('Text message submitted. Refresh Conversations to see the latest history.'))
    } catch (error) { setSendError(error instanceof Error ? error.message : 'Text could not be sent.'); throw error }
    finally { sendLock.current = false; setSending(false) }
  }
  async function sendEmail(body: string, html: string) {
    if (emailPreview) {
      setNotice('Preview only — no email sent.')
      return
    }
    if (!active || !draft || !body.trim() || !mailbox || sendLock.current) return
    sendLock.current = true; setSending(true); setSendError('')
    try {
      const recipients = draft.recipients || { to: [contact.id], cc: [], bcc: [] }
      const thread = active as LiveThread
      await requestJson(`/api/conversations/email?tenant=${tenantId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mailboxId, ...recipients, subject: draft.subject, body, html, threadId: thread.providerThreadId }) })
      setEmailDrafts(current => { const next = { ...current }; delete next[active.id]; return next })
      setThreads(current => current.filter(item => item.id !== active.id || item.messages.length))
      navigate({ view: 'contact', contactId: recipients.to[0], activeId: '', channel: 'email', screen: 'list' })
      setNotice('Email sent.')
      await loadEmails(recipients.to[0])
    } catch (error) { setSendError(error instanceof Error ? error.message : 'Email could not be sent.') }
    finally { sendLock.current = false; setSending(false) }
  }
  function discardDraft() {
    if (!active) return
    setEmailDrafts(current => { const next = { ...current }; delete next[active.id]; return next })
    if (!active.messages.length) setThreads(current => current.filter(thread => thread.id !== active.id))
    navigate({ view: standalone ? 'contacts' : 'contact', activeId: active.messages.length ? active.id : '', screen: active.messages.length ? 'reader' : 'list' })
    setDiscardOpen(false)
  }

  function startNewSms(ids: string[]) {
    if (ids.length === 1) {
      const person = contacts.find(contact => contact.id === ids[0])
      if (!person?.phone) return
      setNewMessageOpen(false)
      navigate({ view: 'contact', contactId: person.id, channel: 'sms', activeId: '', screen: 'reader' })
      markSmsRead(person.id)
      return
    }
    const id = `new-sms-${++draftSequence.current}`
    setNewSms({ id, ids, body: '' })
    setNewMessageOpen(false)
    navigate({ view: 'sms-compose', activeId: id, channel: 'sms' })
  }
  function sendNewSms() {
    // Use the existing production campaign confirmation/sensitive-recipient/send flow.
    setBulkReview(true)
  }
  const returnToConversation = () => navigate({ view: standalone ? 'contacts' : 'contact' })
  const draftAction = 'Reply'

  if (loading || (embedded && location.view === 'contacts' && !composeLinkError && !loadError)) return <PageContainer><ProfilePanelSkeleton /></PageContainer>
  if (loadError) return <PageContainer><p role="alert">{loadError}</p><Button onClick={() => { setLoading(true); void refreshSms().catch(error => setLoadError(error.message)).finally(() => setLoading(false)) }}>Retry</Button></PageContainer>
  if (composeLinkError) return <PageContainer><PageHeader title="Recipient unavailable" /><p role="alert">{composeLinkError}</p><Button onClick={() => { setComposeLinkError(''); setLocation(initialLocation) }}>Browse Conversations</Button></PageContainer>

  return <PageContainer style={{ padding: embedded ? spacing.md : mobile ? spacing.md : spacing['3xl'], boxSizing: 'border-box', minWidth: 0, color: colors.text, fontFamily: typography.fontSans, ...(embedded ? { flex: 1, minHeight: 0, overflowY: 'auto' } : {}) }}>
    {!embedded && <div ref={heading} tabIndex={-1} style={{ outline: 'none' }}>
      <PageHeader title={location.view === 'sms-compose' ? 'Write a text message' : location.view === 'contacts' ? 'Conversations' : standalone ? 'New message' : contact.name}
        titleAction={location.view !== 'contacts' && location.view !== 'sms-compose' && !standalone ? <ControlButton kind="link" aria-label={`Open lead for ${contact.name}`} disabled={!selectedPerson?.profileId || sending} onClick={() => selectedPerson && setProfile(selectedPerson)}>View lead</ControlButton> : undefined}
        onBack={location.view === 'contacts' ? undefined : goBackToConversations} backLabel="Back to Conversations"
        right={location.view === 'contacts' ? <Button onClick={() => setNewMessageOpen(true)}>New message</Button> : undefined} />
    </div>}

    {sendError && <p role="alert" style={{ color: colors.error }}>{sendError}</p>}
    {emailError && <p role="alert" style={{ color: colors.error }}>{emailError}</p>}
    <fieldset disabled={sending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    {location.view === 'contacts' ? <div style={{ width: '100%', minWidth: 0 }}>
      <section aria-label="Conversation filters" style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0, 1fr)' : 'minmax(0, 2fr) repeat(2, minmax(0, 1fr))', alignItems: 'end', gap: spacing.md, marginBottom: spacing.lg }}>
        <Input type="search" aria-label="Search conversations" placeholder="Search conversations…" value={search} onChange={event => setSearch(event.target.value)} />
        <Input type="date" aria-label="From date" label="From date" value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} />
        <Input type="date" aria-label="To date" label="To date" value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} />
        {(search || dateFrom || dateTo) && <Button variant="ghost" onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }}>Clear filters</Button>}
      </section>
      <SurfacePanel padding="0" style={{ overflow: 'hidden' }}>
      <div aria-label="Sort conversations" style={{ display: 'flex', gap: spacing.md, alignItems: 'center', padding: spacing.md, borderBottom: `1px solid ${colors.border}`, flexWrap: 'wrap' }}>
        {([{ key: 'name', label: 'Name' }, { key: 'time', label: 'Time contacted' }, { key: 'date', label: 'Date' }] as const).map(item => <ControlButton kind="tab" key={item.key} selected={sort === item.key} aria-label={`Sort by ${item.label.toLowerCase()}`} onClick={() => {
          if (sort === item.key) setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
          else { setSort(item.key); setSortDirection(item.key === 'name' ? 'asc' : 'desc') }
        }}>{item.label}{sort === item.key ? sortDirection === 'asc' ? ' ↑' : ' ↓' : ''}</ControlButton>)}
      </div>
      {Object.entries(emailDrafts).filter(([, saved]) => saved.contactOnly === false).map(([id, saved]) => <div key={id} style={{ ...row, padding: spacing.lg, borderTop: `1px solid ${colors.border}`, overflowWrap: 'anywhere' }}><span style={{ ...meta, minWidth: 0, flex: 1 }}>Draft · {saved.subject || 'New message'}</span><Button variant="secondary" onClick={() => { const thread = threads.find(item => item.id === id); if (thread) navigate({ view: 'compose', activeId: id, contactId: thread.contactId, channel: 'email', screen: 'reader' }) }}>Continue draft</Button></div>)}
      <aside aria-label="Contacts">
        {!visibleContacts.length && <p role="status" style={{ ...meta, padding: spacing.lg }}>No conversations match your filters.</p>}
        {visibleContacts.map(person => <ControlButton kind="row" key={person.id} aria-label={`Open conversation with ${person.name}`} onClick={() => selectContact(person.id)} style={{ display: 'block', width: '100%', minWidth: 0, boxSizing: 'border-box', whiteSpace: 'normal', overflowWrap: 'anywhere', padding: mobile ? spacing.lg : spacing['2xl'], borderBottom: `1px solid ${colors.borderLight}`, borderRadius: 0 }}>
          <div style={{ ...row, justifyContent: 'space-between' }}><PersonName>{person.name}</PersonName><span style={meta}>{lastContactTimestamp(person.threads) ? <><time dateTime={lastContactTimestamp(person.threads)}>{new Date(lastContactTimestamp(person.threads)).toLocaleDateString()} · {new Date(lastContactTimestamp(person.threads)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></> : 'Not contacted yet'}</span></div>
          <div style={{ ...row, justifyContent: 'space-between', marginTop: spacing.sm }}><span style={{ ...meta, fontWeight: person.newSms + person.newEmails ? typography.weightSemibold : typography.weightNormal }}>{person.newSms} new SMS{loadedEmailPeople.includes(person.id) ? ` · ${person.newEmails} unread emails` : ''}</span><span aria-hidden="true" style={{ fontSize: typography.sizeXl, color: colors.textMuted }}>›</span></div>
        </ControlButton>)}
      </aside>
      </SurfacePanel>
    </div> : location.view === 'sms-compose' ? composingSms && newSms ? <section aria-label="New SMS composer" style={{ minWidth: 0 }}>
      <SurfacePanel padding="0" style={{ ...pane, minHeight: 'max(360px, calc(100dvh - 240px))' }}>
        <div style={{ padding: spacing.lg, borderBottom: `1px solid ${colors.border}`, overflowWrap: 'anywhere' }}>
          <div style={{ ...row, justifyContent: 'space-between' }}><strong>To: {smsRecipients.map(person => person.name).join(', ') || 'No recipients selected'}</strong><div role="group" aria-label="Text message actions" style={row}><Button variant="secondary" onClick={() => { setSmsRecipientQuery(''); setEditingSmsRecipients(true) }}>Edit recipients</Button><Button variant="ghost" onClick={() => setDiscardOpen(true)}>Discard text message</Button></div></div>
          <p style={{ ...meta, marginBottom: 0 }}>Sent individually to each recipient.</p>
        </div>
        <PrototypeSmsConversation live disabled={sending || !contact.phone} thread={newSmsThread || { ...sms, id: newSms.id, messages: [] }} mobile={mobile} recipients={smsRecipients} draft={newSms.body} onChange={body => setNewSms(current => current ? { ...current, body } : current)} onSend={() => { if (newSms.body.trim() && smsRecipients.length && smsRecipients.every(person => person.phone)) sendNewSms() }} />
      </SurfacePanel>
      <Modal isOpen={editingSmsRecipients} onClose={() => setEditingSmsRecipients(false)} ariaLabel="Edit SMS recipients" size="lg"><ModalHeader title="SMS recipients" onClose={() => setEditingSmsRecipients(false)} /><ModalBody><div style={{ display: 'flex', flexDirection: 'column', height: 'min(55dvh, 480px)', minWidth: 0 }}><SmsRecipientPicker query={smsRecipientQuery} results={smsOptions.filter(person => `${person.first_name} ${person.last_name} ${person.phone}`.toLowerCase().includes(smsRecipientQuery.trim().toLowerCase()))} selected={smsOptions.filter(person => newSms.ids.includes(person.id))} handleSearch={setSmsRecipientQuery} toggleRecipient={person => setNewSms(current => current ? { ...current, ids: current.ids.includes(person.id) ? current.ids.filter(id => id !== person.id) : [...current.ids, person.id] } : current)} /></div></ModalBody><ModalFooter><Button onClick={() => setEditingSmsRecipients(false)}>Done</Button></ModalFooter></Modal>
      <Modal isOpen={discardOpen} onClose={() => setDiscardOpen(false)} ariaLabel="Discard text message" size="sm"><ModalHeader title="Discard this text message?" onClose={() => setDiscardOpen(false)} /><ModalBody>Your recipients and unsent text will be removed.</ModalBody><ModalFooter><Button variant="secondary" onClick={() => setDiscardOpen(false)}>Keep message</Button><Button variant="destructive" onClick={() => { setNewSms(null); navigate({ view: 'contacts', activeId: '' }) }}>Discard message</Button></ModalFooter></Modal>
    </section> : <p role="status">This text message is no longer available. Go back to Conversations to start a new message.</p> : standalone && composing && active && draft ? <section aria-label="New email message" style={{ minWidth: 0, maxWidth: 1000 }}>
      {discardOpen && <section aria-label="Discard email draft" style={{ padding: spacing.lg }}><p>Discard this draft?</p><Button variant="secondary" onClick={() => setDiscardOpen(false)}>Keep draft</Button><Button onClick={discardDraft}>Discard draft</Button></section>}
      <PrototypeEmailComposer disabled={sending || !canComposeEmail} senderEmail={senderEmail} key={active.id} name="" email="" student="" draft={draft} onChange={updateDraft} onSend={sendEmail} onCollapse={returnToConversation} onDiscard={() => setDiscardOpen(true)} replying={false} signatureHtml={signatureHtml} senderName={senderName} people={contacts} templates={templates} onCreateTemplate={template => setTemplates(current => [...current, template])} />
    </section> : <div ref={workspace}><SurfacePanel padding="0" style={{ ...pane, height: workspaceHeight ?? 'calc(100dvh - 160px)', overflow: 'hidden', border: 0, borderRadius: 0, boxShadow: 'none' }}>
      <section aria-label={`Conversation with ${contact.name}`} style={{ ...pane, flex: 1 }}>
        <div style={{ ...row, justifyContent: 'flex-start', gap: spacing.xs, padding: `0 ${spacing.md}`, borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
          {mailboxes.length > 0 && <Select aria-label="Sending mailbox" value={mailboxId} onChange={event => { setMailboxId(event.target.value); setEmailCursor(null); setLoadedEmailPeople([]); setThreads(current => current.filter(thread => thread.channel !== 'email')); navigate({ activeId: '', screen: 'list' }) }} disabled={sending || Object.keys(emailDrafts).length > 0}>{mailboxes.map(item => <option key={item.id} value={item.id}>{item.email}</option>)}</Select>}
          {!embedded && (['sms', 'email'] as const).map(channel => <ControlButton key={channel} kind="tab" selected={location.channel === channel} aria-pressed={location.channel === channel} onClick={() => switchChannel(channel)} style={{ marginBottom: -1 }}>{channel === 'sms' ? 'SMS' : 'Email'}</ControlButton>)}
        </div>
        {location.channel === 'sms' ? <PrototypeSmsConversation key={sms.id} compact={!!embedded} live disabled={sending || !contact.phone} thread={sms} mobile={mobile} draft={smsDrafts[sms.id] || ''} onChange={value => setSmsDrafts(current => ({ ...current, [sms.id]: value }))} onSend={() => void sendSms().catch(() => {})} onDraft={async () => {
          const data = await requestJson('/api/draft-message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: smsDrafts[sms.id]?.trim() || 'Write a warm friendly reply', recipient_context: `Writing to ${contact.name}. Recent conversation: ${sms.messages.slice(-5).map(message => `${message.direction}: ${message.body}`).join('\n')}` }) })
          return data.draft
        }} /> : <div style={{ ...pane, flex: 1, display: 'grid', gridTemplateColumns: desktop ? 'minmax(0, 3fr) minmax(0, 7fr)' : 'minmax(0, 1fr)' }}>
          {showEmailList && <aside aria-label="Email conversations" style={{ ...pane, borderRight: desktop ? `1px solid ${colors.border}` : undefined, overflowY: 'auto' }}>

            {emails.map(thread => {
              const latest = thread.messages.at(-1)
              return <ControlButton kind="row" key={thread.id} aria-label={`Read email: ${thread.subject || 'Untitled draft'}`} selected={active?.id === thread.id} onClick={() => readThread(thread.id)} style={{ display: 'block', borderBottom: `1px solid ${colors.borderLight}`, padding: spacing['2xl'], borderRadius: 0 }}>
                <div style={{ ...row, justifyContent: 'space-between', ...meta }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm }}>{latest && <EmailDirection direction={latest.direction} />}{latest?.direction === 'inbound' ? thread.name : latest ? senderName : 'Draft'}</span><span>{latest?.time.split(' · ')[0] || 'Unsent'}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>{thread.unread && <span role="img" aria-label="Unread email" style={{ display: 'inline-block', width: 8, height: 8, flexShrink: 0, borderRadius: '50%', background: colors.teal }} />}<strong style={{ color: colors.text }}>{thread.subject || 'Untitled draft'}</strong></div>
                <p style={{ ...meta, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: `${spacing.sm} 0 0` }}>{emailDrafts[thread.id] ? `Draft · ${emailDrafts[thread.id].bodyText || 'No message yet'}` : latest?.body || 'Unsent draft'}</p>
              </ControlButton>
            })}
          </aside>}
          {showReader && <section ref={reader} aria-label="Email reader" style={{ ...pane, overflowY: 'auto', background: colors.background, padding: mobile ? spacing.md : spacing.xl }}>
            {!embedded && !desktop && emails.length > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}><BackControl label="Back to emails" onClick={() => navigate({ screen: 'list' })} /><h2 style={{ ...typography.h2, margin: 0 }}>Email conversation</h2></div>}
            {!active ? emailLoading ? <ProfilePanelSkeleton /> : <div style={{ margin: 'auto' }}><EmptyState title="No email history" description="No received or sent emails are available for this contact." action={<Button onClick={() => newEmail()}>New email</Button>} /></div> : <div style={{ width: '100%', maxWidth: 820, margin: '0 auto' }}>
              <div style={{ ...row, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['3xl'] }}><SectionTitle>{active.subject || 'New email'}</SectionTitle>{active.messages.length > 0 && <ControlButton kind="link" onClick={() => newEmail()}>New email</ControlButton>}</div>
              {!!draft?.contextThreadId && <p style={meta}>Previous conversation: {contextThread?.subject}</p>}
              <div aria-label="Previous email context">
              {contextMessages.map((message, index) => {
                const header = <div style={{ ...row, justifyContent: 'space-between' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm }}><EmailDirection direction={message.direction} /><strong>{message.direction === 'inbound' ? contact.name : senderName}</strong></span><span style={meta}>{message.time}</span></div>
                const content = <>{message.simulated && <span style={meta}>Sample email</span>}<p style={{ ...meta, overflowWrap: 'anywhere' }}>From: {message.direction === 'inbound' ? contact.email : senderEmail}<br />To: {message.direction === 'inbound' ? senderEmail : message.emailTo?.join(', ') || contact.email}{!!message.emailCc?.length && <><br />Cc: {message.emailCc.join(', ')}</>}</p><EmailBody message={message} /></>
                return index < contextMessages.length - 1 ? <details key={message.id} style={{ padding: `${spacing.xl} 0`, borderBottom: `1px solid ${colors.border}`, marginBottom: spacing.xl }}><summary style={{ cursor: 'pointer' }}>{header}</summary>{content}</details> : <article key={message.id} style={{ padding: `${spacing.xl} 0` }}>{header}{content}</article>
              })}
              </div>
              <div ref={replyEditor} style={{ marginTop: spacing.xl, paddingTop: contextMessages.length ? spacing.xl : 0, borderTop: contextMessages.length ? `1px solid ${colors.border}` : undefined, paddingBottom: spacing.xl }}>
                {composing && draft ? <>
                  {discardOpen ? <section aria-label="Discard email draft" style={{ padding: spacing.xl, border: `1px solid ${colors.border}`, marginBottom: spacing.lg }}><strong>Discard this draft?</strong><p style={meta}>Only this unsent draft will be removed.</p><div style={row}><Button variant="secondary" onClick={() => setDiscardOpen(false)}>Keep draft</Button><Button onClick={discardDraft}>Discard draft</Button></div></section> : null}
                  <PrototypeEmailComposer disabled={sending || !canComposeEmail} senderEmail={senderEmail} key={active.id} name={contact.name} email={contact.email} student={contact.student} draft={draft} onChange={updateDraft} onSend={sendEmail} onCollapse={returnToConversation} onDiscard={() => setDiscardOpen(true)} replying={active.messages.length > 0} signatureHtml={signatureHtml} senderName={senderName} people={contacts} templates={templates} onCreateTemplate={template => setTemplates(current => [...current, template])} />
                </> : draft ? <section aria-label="Email draft preview" style={{ border: `1px solid ${colors.border}`, borderRadius: 8, padding: spacing['2xl'], background: colors.surface }}><strong style={{ color: colors.crimson }}>Draft</strong><p style={{ ...meta, margin: `${spacing.sm} 0` }}>To: {draft.recipients?.to.map(id => contacts.find(person => person.id === id)?.name).join(', ') || contact.name}</p><p style={{ ...typography.body, whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{draft.bodyText || 'No message yet'}</p><Button variant="secondary" onClick={openDraft}>Continue draft</Button></section>
                  : active.messages.length > 0 ? <Button variant="secondary" onClick={openDraft}>{draftAction}</Button> : null}
              </div>
            </div>}
          </section>}
        </div>}
      </section>
    </SurfacePanel></div>}
    </fieldset>
    <PrototypeNewMessage open={newMessageOpen} onClose={() => setNewMessageOpen(false)} people={contacts} preselected={location.view === 'contacts' ? undefined : contact.id} onEmail={newEmail} onSms={startNewSms} />
    {profile && <ConversationProfilePanel key={profile.id} person={profile} tenantId={tenantId} onClose={() => setProfile(null)} onCompose={channel => {
      setProfile(null)
      if (channel === 'email') {
        if (active && emailDrafts[active.id]) navigate({ view: 'compose', channel, activeId: active.id, screen: 'reader' })
        else newEmail()
      } else navigate({ view: 'contact', channel, screen: 'reader' })
    }} />}
    {bulkReview && newSms && <SlidePanel isOpen onClose={() => setBulkReview(false)} fullScreen={mobile} width="min(95vw, 1400px)" ariaLabel="Review text message"><ComposePanel channel="sms" recipientIds={newSms.ids.map(id => people.find(person => person.id === id)?.smsContactId).filter((id): id is string => !!id)} recipientCount={newSms.ids.length} filterExplanation="Conversations recipients" initialMessage={newSms.body.replaceAll('{{firstName}}', '{first_name}')} onClose={() => setBulkReview(false)} onSent={() => { setBulkReview(false); setNewSms(null); navigate({ view: 'contacts', activeId: '' }); void refreshSms() }} /></SlidePanel>}
    <Modal isOpen={leaveSmsOpen} onClose={() => setLeaveSmsOpen(false)} ariaLabel="Discard message and go back" size="sm"><ModalHeader title="Go back to Conversations?" onClose={() => setLeaveSmsOpen(false)} /><ModalBody>Going back to conversations will discard the current message</ModalBody><ModalFooter><Button variant="secondary" onClick={() => setLeaveSmsOpen(false)}>Cancel</Button><Button onClick={leaveSms}>Continue</Button></ModalFooter></Modal>
    {location.channel === 'email' && location.view !== 'contacts' && <div style={row}>{emailLoading && <p role="status">Loading email…</p>}{mailboxId && <Button variant="secondary" disabled={emailLoading || sending} onClick={() => void loadEmails(contact.id)}>Refresh email</Button>}{emailCursor && <Button disabled={emailLoading || sending} onClick={() => void loadEmails(contact.id, emailCursor)}>Load more emails</Button>}</div>}
    {notice && <p role="status" style={{ ...meta, marginTop: spacing.xl }}>{notice}</p>}
  </PageContainer>
}
