'use client'

import { Pencil } from 'lucide-react'

import { formatContactTiming } from '@/lib/contact-timing'
import { ArrowDownLeft } from 'lucide-react'
import { conversationSignatureHtml, type ConversationSignature } from '@/lib/conversation-signature'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Button, Input, PageContainer, PageHeader, SectionTitle, Avatar, Notice, SurfacePanel, Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui'
import MessageActions from '@/components/inbox/MessageActions'
import { Select } from '@/components/ui/Select'
import type { OrganisationSender } from '@/lib/organisation-email-policy'
import { sanitizePrototypeHtml } from '@/lib/conversations-prototype-html'
import { useIdentity } from '@/components/layout/IdentityProvider'
import { useWorkspaceHistory } from '@/lib/useWorkspaceHistory'
import { BackControl } from '@/components/ui/BackControl'
import { ControlButton } from '@/components/ui/ControlButton'
import { ResponsiveDataTable } from '@/components/ui/DataGridTable'
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
import { initialMockTemplates, type MockEmailRecipients, type MockTemplate } from '@/lib/prototype-messaging'
import { prototypeHtmlText, prototypePreviewDocument } from '@/lib/conversations-prototype-html'
import { resolveConversationRecipient } from '@/lib/conversation-links'
import { createConversationEmailPreview } from '@/lib/conversations-email-preview'
import { compareConversations, conversationAttention, CONVERSATIONS_HOME_EVENT, lastContactTimestamp, newestEmail, type ConversationSort } from '@/lib/conversation-display'
import { ProfilePanelSkeleton } from '@/components/ui/ProfilePanelSkeleton'
import type { ConversationChannel } from '@/lib/conversation-links'

const draftPreviewStyle: CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', margin: `${spacing.sm} 0` }
const draftPreview = (text: string) => { const compact = text.replace(/\s+/g, ' ').trim(); return compact.length > 200 ? `${compact.slice(0, 200).trimEnd()}…` : compact }

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
  return <span role="img" aria-label={direction === 'outbound' ? 'Outbound email' : 'Inbound email'} title={direction === 'outbound' ? 'Outbound email' : 'Inbound email'} style={{ color: direction === 'outbound' ? colors.tealDark : colors.textSecondary, fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{direction === 'outbound' ? '↗' : '↙'}</span>
}

export default function Conversations({ emailPreview: previewEnabled = false, embedded }: { emailPreview?: boolean; embedded?: { recipient: string; channel: ConversationChannel; onClose: () => void } }) {
  const [emailPreview, setEmailPreview] = useState(previewEnabled)
  const { identity } = useIdentity()
  const memberName = identity?.fullName?.trim() || 'Organisation'
  const [organisationSenders, setOrganisationSenders] = useState<OrganisationSender[]>([])
  const [senderId, setSenderId] = useState('')
  const authorisedSender = organisationSenders.find(sender => sender.email === senderId) || organisationSenders[0]
  const senderName = authorisedSender?.name || memberName
  const [signature, setSignature] = useState<ConversationSignature | null>(null)
  const [signatureError, setSignatureError] = useState('')
  const [emailSummaries, setEmailSummaries] = useState<LiveThread[]>([])
  const [summaryError, setSummaryError] = useState('')
  const [readEmailIds, setReadEmailIds] = useState<Set<string>>(() => new Set())
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
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [loadedEmailPeople, setLoadedEmailPeople] = useState<string[]>([])
  const [profile, setProfile] = useState<ConversationPerson | null>(null)
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
  const senderEmail = authorisedSender?.email || mailbox?.email || (emailPreview ? 'preview@example.com' : '')
  const signatureHtml = signature?.personal ? conversationSignatureHtml(signature, memberName) : authorisedSender?.signatureHtml ? sanitizePrototypeHtml(authorisedSender.signatureHtml) : signature ? conversationSignatureHtml({ ...signature, name: senderName }, senderName) : ''
  const canComposeEmail = emailPreview || (!!mailbox?.canSend && !!authorisedSender)
  const fromControl = <Select aria-label="Send email from" disabled={sending || !organisationSenders.length} value={authorisedSender?.email || ''} onChange={event => setSenderId(event.target.value)}>{!authorisedSender && <option value="">{organisationSenders.length ? 'Select a sender' : 'Set up organisation email in Settings'}</option>}{organisationSenders.map(sender => <option key={sender.email} value={sender.email}>{sender.mine ? 'Me — ' : ''}{sender.name} — {sender.email}</option>)}</Select>

  const [location, setLocation] = useState<ConversationLocation>(initialLocation)
  const [emailDrafts, setEmailDrafts] = useState<Record<string, PrototypeEmailDraft>>({})
  const [smsDrafts, setSmsDrafts] = useState<Record<string, string>>({})
  const [discardOpen, setDiscardOpen] = useState(false)
  const [leaveSmsOpen, setLeaveSmsOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [newSms, setNewSms] = useState<{ id: string; ids: string[]; body: string } | null>(null)
  const [editingSmsRecipients, setEditingSmsRecipients] = useState(false)
  const [smsRecipientQuery, setSmsRecipientQuery] = useState('')
  const [newMessageChannel, setNewMessageChannel] = useState<'sms' | 'email'>('sms')
  const [newMessageOpen, setNewMessageOpen] = useState(false)
  const [templates, setTemplates] = useState<MockTemplate[]>(() => initialMockTemplates().filter(template => template.channel === 'sms'))
  const [templateError, setTemplateError] = useState('')
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
      if (workspace.current) setWorkspaceHeight(Math.max(360, window.innerHeight - workspace.current.getBoundingClientRect().top - (mobile ? 12 : 28)))
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [location.view, loading, mobile, sendError, emailError])
  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    void requestJson(`/api/communications/senders?tenant=${tenantId}`).then(data => { if (!cancelled) setOrganisationSenders(data.senders || []) }).catch(() => { if (!cancelled) setOrganisationSenders([]) })
    void requestJson(`/api/conversations/email?tenant=${tenantId}`).then(data => {
      if (cancelled) return
      setMailboxes(data.mailboxes); setMailboxId(current => current || data.mailboxes[0]?.id || ''); setMailboxesLoaded(true)
      if (data.emailPreview === true) setEmailPreview(true)
    }).catch(error => { if (!cancelled) setEmailError(error.message) })
    return () => { cancelled = true }
  }, [tenantId])
  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    setTemplates(initialMockTemplates().filter(template => template.channel === 'sms'))
    setTemplateError('')
    void requestJson(`/api/conversations/templates?tenant=${encodeURIComponent(tenantId)}`).then(data => {
      if (!Array.isArray(data.templates)) throw new Error('Invalid template response')
      if (!cancelled) setTemplates([...initialMockTemplates().filter(template => template.channel === 'sms'), ...data.templates])
    }).catch(() => { if (!cancelled) setTemplateError('Shared email templates could not be loaded. Refresh to try again.') })
    return () => { cancelled = true }
  }, [tenantId])
  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    void requestJson(`/api/conversations/signature?tenant=${tenantId}`).then(data => {
      if (!cancelled) { setSignature(data); setSignatureError('') }
    }).catch(() => { if (!cancelled) setSignatureError('Company signature could not be loaded. Check company settings before sending.') })
    return () => { cancelled = true }
  }, [tenantId])
  useEffect(() => {
    setReadEmailIds(new Set())
    if (!tenantId || !mailboxId) return
    try { setReadEmailIds(new Set(JSON.parse(sessionStorage.getItem(`pulse:email-read:${tenantId}:${mailboxId}`) || '[]'))) } catch { /* Optional session storage. */ }
  }, [tenantId, mailboxId])
  useEffect(() => {
    setEmailSummaries([])
    // Background history must not compete with composing/sending, or scan the
    // entire mailbox on every minute tick (and multiply that work across tabs).
    if (!tenantId || !mailboxId || location.view === 'compose' || location.view === 'sms-compose') return
    let cancelled = false
    let running = false
    let olderCursor: string | null = null
    let scannedFirstPage = false
    const controller = new AbortController()
    const refresh = async () => {
      if (running || cancelled || document.visibilityState === 'hidden') return
      running = true
      try {
        const summaries: LiveThread[] = []
        const loadPage = async (cursor: string | null) => {
          const params = new URLSearchParams({ tenant: tenantId, mailbox: mailboxId, summary: '1' })
          if (cursor) params.set('cursor', cursor)
          const data = await requestJson(`/api/conversations/email?${params}`, { signal: controller.signal })
          summaries.push(...data.threads)
          return data.nextCursor as string | null
        }
        const next = await loadPage(null)
        if (cancelled) return
        // Refresh recent mail, then advance at most ONE older page per tick.
        // Accumulate older summaries instead of re-downloading every old thread.
        if (scannedFirstPage && olderCursor) olderCursor = await loadPage(olderCursor)
        else if (!scannedFirstPage) olderCursor = next
        scannedFirstPage = true
        if (!cancelled) {
          setEmailSummaries(current => [...current.filter(thread => !summaries.some(next => next.id === thread.id)), ...summaries])
          setSummaryError('')
        }
      } catch { if (!cancelled) setSummaryError('Email attention status could not be refreshed. SMS status is still available.') }
      finally { running = false }
    }
    void refresh()
    const interval = window.setInterval(() => { void refresh() }, 60000)
    return () => { cancelled = true; controller.abort(); window.clearInterval(interval) }
  }, [tenantId, mailboxId, location.view])
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
      setLoadedEmailPeople(current => [...new Set([...current, personId])])
    } catch (error) { if (request === emailRequest.current) setEmailError(error instanceof Error ? error.message : 'Could not load email.') }
    finally { if (request === emailRequest.current) setEmailLoading(false) }
  }, [tenantId, mailboxId, emailDrafts, people])
  useEffect(() => {
    // A new message needs sender/recipient data, not a Gmail history request.
    if (!location.contactId || location.view !== 'contact' || location.channel !== 'email') return
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

  const markEmailLocallyRead = (thread: LiveThread): LiveThread => thread.channel === 'email' ? { ...thread, unread: thread.messages.some(message => message.direction === 'inbound' && message.unread && !readEmailIds.has(message.id)), messages: thread.messages.map(message => readEmailIds.has(message.id) ? { ...message, unread: false } : message) } : thread
  const summaryIsNewer = (summary: LiveThread) => {
    const loaded = threads.find(thread => thread.id === summary.id)
    return !loaded || lastContactTimestamp([summary]) > lastContactTimestamp([loaded])
  }
  const newerSummaries = emailSummaries.filter(summaryIsNewer)
  const contactHistories = [...threads.filter(thread => !newerSummaries.some(summary => summary.id === thread.id)), ...newerSummaries].map(markEmailLocallyRead)
  const contacts = groupPrototypeContacts(mergeConversationThreads(people, contactHistories)).sort((a, b) => compareConversations(a, b, sort, sortDirection))
  const contact = contacts.find(item => item.id === location.contactId) || contacts[0] || { ...personThread({ id: '', name: 'Contact', email: '', phone: '', student: '', stage: '', profileType: null, profileId: null, smsContactId: null }), threads: [], newSms: 0, newEmails: 0 }
  const selectedPerson = people.find(person => person.id === contact.id)

  const emails = threads.filter(thread => thread.contactId === contact.id && thread.channel === 'email').map(markEmailLocallyRead).sort((a, b) => lastContactTimestamp([b]).localeCompare(lastContactTimestamp([a])))
  const active = emails.find(thread => thread.id === location.activeId) || newestEmail(emails)
  useEffect(() => {
    if (location.channel !== 'email' || location.view !== 'contact' || (!desktop && location.screen !== 'reader') || !active) return
    const inbound = active.messages.filter(message => message.direction === 'inbound' && message.unread)
    if (!inbound.length) return
    setReadEmailIds(current => {
      const ids = new Set([...current, ...inbound.map(message => message.id)])
      try { sessionStorage.setItem(`pulse:email-read:${tenantId}:${mailboxId}`, JSON.stringify([...ids])) } catch { /* Optional session storage. */ }
      return ids
    })
  }, [active, desktop, location.channel, location.screen, location.view, mailboxId, tenantId])
  const sms = threads.find(thread => thread.contactId === contact.id && thread.channel === 'sms') || { ...contact, id: `${contact.id}-sms-draft`, contactId: contact.id, channel: 'sms' as const, messages: [] }
  const draft = active ? emailDrafts[active.id] : undefined
  // Old Back/Forward entries must not recreate a sent or discarded draft.
  const contextThread = draft?.contextThreadId ? emails.find(thread => thread.id === draft.contextThreadId) : active
  const contextMessages = contextThread?.messages || []
  const composing = location.view === 'compose' && !!active && !!draft
  const composingSms = location.view === 'sms-compose' && !!newSms && location.activeId === newSms.id
  const smsRecipients = contacts.filter(person => newSms?.ids.includes(person.id))
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
    const thread = threads.find(thread => thread.id === id)
    if (thread) {
      const ids = new Set([...readEmailIds, ...thread.messages.filter(message => message.direction === 'inbound').map(message => message.id)])
      setReadEmailIds(ids)
      try { sessionStorage.setItem(`pulse:email-read:${tenantId}:${mailboxId}`, JSON.stringify([...ids])) } catch { /* Reading still works without storage. */ }
    }
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
    setEmailDrafts(current => ({ ...current, [id]: { subject: '', html: '<p><br></p>', contactOnly: !recipients, recipients: recipients || { to: [contact.id], cc: [], bcc: [] } } }))
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
      await requestJson(`/api/conversations/email?tenant=${tenantId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mailboxId, senderEmail, ...recipients, subject: draft.subject, body, html, threadId: thread.providerThreadId }) })
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
    if (ids.length === 1 && contacts.some(person => person.id === ids[0] && person.phone)) {
      const person = contacts.find(contact => contact.id === ids[0])!
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
  const returnToConversation = () => navigate({ view: standalone ? 'contacts' : 'contact' })
  const draftAction = 'Reply'

  if (loading || (embedded && location.view === 'contacts' && !composeLinkError && !loadError)) return <PageContainer><ProfilePanelSkeleton /></PageContainer>
  if (loadError) return <PageContainer><Notice variant="error">{loadError}</Notice><Button onClick={() => { setLoading(true); void refreshSms().catch(error => setLoadError(error.message)).finally(() => setLoading(false)) }}>Retry</Button></PageContainer>
  if (composeLinkError) return <PageContainer><PageHeader title="Recipient unavailable" /><Notice variant="error">{composeLinkError}</Notice><Button onClick={() => { setComposeLinkError(''); setLocation(initialLocation) }}>Browse Conversations</Button></PageContainer>

  return <PageContainer style={{ padding: embedded ? 0 : mobile ? spacing.md : spacing['3xl'], boxSizing: 'border-box', minWidth: 0, color: colors.text, fontFamily: typography.fontSans, ...(embedded ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' } : {}) }}>
    {!embedded && <div ref={heading} tabIndex={-1} style={{ outline: 'none' }}>
      <PageHeader title={location.view === 'sms-compose' ? 'Write a text message' : location.view === 'contacts' ? 'Conversations' : standalone ? 'New message' : contact.name}
        titleAction={location.view !== 'contacts' && location.view !== 'sms-compose' && !standalone ? <ControlButton kind="link" aria-label={`Open lead for ${contact.name}`} disabled={!selectedPerson?.profileId || sending} onClick={() => selectedPerson && setProfile(selectedPerson)}>View lead</ControlButton> : undefined}
        onBack={location.view === 'contacts' ? undefined : goBackToConversations} backLabel="Back to Conversations"
        right={location.view === 'contacts' ? <MessageActions onSms={() => { setNewMessageChannel('sms'); setNewMessageOpen(true) }} onEmail={() => { setNewMessageChannel('email'); setNewMessageOpen(true) }} /> : undefined} />
    </div>}

    <fieldset disabled={sending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    {location.view === 'contacts' ? <div style={{ width: '100%', minWidth: 0 }}>
      <section aria-label="Conversation filters" style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0, 1fr)' : 'minmax(0, 2fr) repeat(2, minmax(0, 1fr))', alignItems: 'end', gap: spacing.md, marginBottom: spacing.lg }}>
        <Input type="search" aria-label="Search conversations" placeholder="Search conversations…" value={search} onChange={event => setSearch(event.target.value)} />
        <Input type="date" aria-label="From date" label="From date" value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} />
        <Input type="date" aria-label="To date" label="To date" value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} />
        {(search || dateFrom || dateTo) && <Button variant="ghost" onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }}>Clear filters</Button>}
      </section>
      {newSms?.body.trim() && <Notice title="You have a message in draft" style={{ marginBottom: spacing.md }}><p style={{ ...meta, ...draftPreviewStyle }}>{draftPreview(newSms.body)}</p><div style={row}><Button variant="secondary" onClick={() => setNewSms(null)}>Discard draft</Button><Button onClick={() => navigate({ view: 'sms-compose', activeId: newSms.id, channel: 'sms' })}>Continue draft</Button></div></Notice>}
      {Object.entries(smsDrafts).filter(([, body]) => body.trim()).map(([id]) => { const thread = threads.find(item => item.id === id); return thread ? <Notice key={id} title="You have a message in draft" style={{ marginBottom: spacing.md }}><p style={{ ...meta, ...draftPreviewStyle }}>{draftPreview(smsDrafts[id])}</p><div style={row}><Button variant="secondary" onClick={() => setSmsDrafts(current => { const next = { ...current }; delete next[id]; return next })}>Discard draft</Button><Button onClick={() => navigate({ view: 'contact', contactId: thread.contactId, channel: 'sms', activeId: thread.id, screen: 'reader' })}>Continue draft</Button></div></Notice> : null })}
      {Object.entries(emailDrafts).map(([id, saved]) => <Notice key={id} title="You have a message in draft" style={{ marginBottom: spacing.md }}><p style={{ ...meta, ...draftPreviewStyle }}>{draftPreview(saved.bodyText || prototypeHtmlText(saved.html) || saved.subject || 'New email')}</p><div style={row}><Button variant="secondary" onClick={() => { setEmailDrafts(current => { const next = { ...current }; delete next[id]; return next }); setThreads(current => current.filter(thread => thread.id !== id || thread.messages.length)) }}>Discard draft</Button><Button onClick={() => { const thread = threads.find(item => item.id === id); if (thread) navigate({ view: 'compose', activeId: id, contactId: thread.contactId, channel: 'email', screen: 'reader' }) }}>Continue draft</Button></div></Notice>)}

      <SurfacePanel padding="0" style={{ overflow: 'hidden' }}>
      <ResponsiveDataTable rows={visibleContacts} getRowKey={person => person.id} ariaLabel="Conversations" minDesktopWidth={360} alignToSelectionInset stickyHeaderOffset={0}
        getRowStyle={person => conversationAttention(person.threads).unread ? { background: '#F0F8FA' } : undefined}
        sort={{ key: sort, direction: sortDirection }} onSortChange={next => { setSort(next.key); setSortDirection(next.direction) }}
        onRowClick={person => selectContact(person.id)} emptyContent="No conversations match your filters."
        columns={[
          { id: 'name', header: 'Name', width: 'minmax(220px, 2fr)', sortable: true, sortKey: 'name', render: person => { const attention = conversationAttention(person.threads); return <div><div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>{attention.unattended && <span role="img" aria-label={attention.unread ? 'Unread and unattended message' : 'Unattended message'} title={`Awaiting your reply · ${attention.channels.join(' and ')}${attention.unread ? ' · Unread' : ''}`} style={{ color: colors.tealDark, display: 'inline-flex', flexShrink: 0 }}><ArrowDownLeft size={20} aria-hidden="true" /></span>}<PersonName as="button" aria-label={`Open conversation with ${person.name}`} onClick={() => selectContact(person.id)} style={{ textAlign: 'left' }}>{person.name}</PersonName></div><div style={{ ...meta, marginTop: spacing.xs }}>{attention.unattended && <span style={{ color: colors.tealDark }}>{attention.unread ? 'Unread · Unattended' : 'Unattended'} · </span>}{person.newSms} new SMS{loadedEmailPeople.includes(person.id) || emailSummaries.some(thread => thread.contactId === person.id) ? ` · ${person.newEmails} unread emails` : ''}</div></div> } },
          { id: 'time', header: 'Last contacted', width: 'minmax(180px, 1fr)', sortable: true, sortKey: 'time', defaultSortDirection: 'desc', render: person => formatContactTiming(lastContactTimestamp(person.threads)) },
        ]} />
      </SurfacePanel>
      {summaryError && <p role="status" style={meta}>{summaryError}</p>}
    </div> : location.view === 'sms-compose' ? composingSms && newSms ? <section aria-label="New SMS composer" style={{ minWidth: 0 }}>
      <SurfacePanel padding="0" style={{ ...pane, height: 'max(440px, calc(100dvh - 160px))', overflow: 'hidden' }}>
        <div style={{ ...row, justifyContent: 'flex-end', padding: `${spacing.sm} ${spacing.lg}`, borderBottom: `1px solid ${colors.border}` }}>
          <Button variant="ghost" size="sm" onClick={() => { setSmsRecipientQuery(''); setEditingSmsRecipients(true) }}>Edit recipients</Button>
        </div>
        <ComposePanel key={newSms.id} channel="sms" composeSource="scratch" composeIntent="neutral"
          recipientIds={smsRecipients.filter(person => person.phone).map(person => people.find(item => item.id === person.id)?.smsContactId).filter((id): id is string => !!id)}
          recipientCount={smsRecipients.filter(person => person.phone).length} filterExplanation=""
          recipientPreview={smsRecipients.filter(person => person.phone).map(person => ({ id: people.find(item => item.id === person.id)?.smsContactId || person.id, first_name: person.name.split(' ')[0], last_name: person.name.split(' ').slice(1).join(' ') }))}
          excludedRecipients={smsRecipients.filter(person => !person.phone).map(person => ({ id: person.id, name: person.name, reason: 'No phone number' }))}
          draft={{ body: newSms.body, onChange: body => setNewSms(current => current ? { ...current, body } : current) }}
          onSent={() => { setNewSms(null); navigate({ view: 'contacts', activeId: '' }); void refreshSms() }} />
      </SurfacePanel>
      <Modal isOpen={editingSmsRecipients} onClose={() => setEditingSmsRecipients(false)} ariaLabel="Edit SMS recipients" size="lg"><ModalHeader compact title="Select text message recipients" onClose={() => setEditingSmsRecipients(false)} /><ModalBody style={{ display: 'flex', flexDirection: 'column' }}><div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 }}><SmsRecipientPicker query={smsRecipientQuery} results={smsOptions.filter(person => `${person.first_name} ${person.last_name} ${person.phone}`.toLowerCase().includes(smsRecipientQuery.trim().toLowerCase()))} selected={smsOptions.filter(person => newSms.ids.includes(person.id))} handleSearch={setSmsRecipientQuery} toggleRecipient={person => setNewSms(current => current ? { ...current, ids: current.ids.includes(person.id) ? current.ids.filter(id => id !== person.id) : [...current.ids, person.id] } : current)} /></div></ModalBody><ModalFooter><Button onClick={() => setEditingSmsRecipients(false)}>Done</Button></ModalFooter></Modal>
      <Modal isOpen={discardOpen} onClose={() => setDiscardOpen(false)} ariaLabel="Discard text message" size="sm"><ModalHeader title="Discard this text message?" onClose={() => setDiscardOpen(false)} /><ModalBody>Your recipients and unsent text will be removed.</ModalBody><ModalFooter><Button variant="secondary" onClick={() => setDiscardOpen(false)}>Keep message</Button><Button variant="destructive" onClick={() => { setNewSms(null); navigate({ view: 'contacts', activeId: '' }) }}>Discard message</Button></ModalFooter></Modal>
    </section> : <p role="status">This text message is no longer available. Go back to Conversations to start a new message.</p> : standalone && composing && active && draft ? <section aria-label="New email message" style={{ minWidth: 0, width: '100%' }}>
      {sendError && <Notice variant="error" style={{ marginBottom: spacing.md }}>{sendError}</Notice>}
      {discardOpen && <section aria-label="Discard email draft" style={{ padding: spacing.lg }}><p>Discard this draft?</p><Button variant="secondary" onClick={() => setDiscardOpen(false)}>Keep draft</Button><Button onClick={discardDraft}>Discard draft</Button></section>}
      {templateError && <p role="status" style={meta}>{templateError}</p>}
      {signatureError && <p role="status" style={meta}>{signatureError}</p>}
      <PrototypeEmailComposer fromControl={fromControl} disabled={sending || !canComposeEmail} senderEmail={senderEmail} key={active.id} name="" email="" student="" draft={draft} onChange={updateDraft} onSend={sendEmail} onCollapse={returnToConversation} onDiscard={() => setDiscardOpen(true)} replying={false} signatureHtml={signatureHtml} signatureImageUrl={signature?.logoUrl} senderName={senderName} people={contacts} templates={templates} onCreateTemplate={template => setTemplates(current => [...current, template])} />
    </section> : <div ref={workspace} style={embedded ? { ...pane, flex: 1 } : undefined}><SurfacePanel padding="0" style={{ ...pane, height: embedded ? undefined : workspaceHeight ?? 'calc(100dvh - 160px)', overflow: 'hidden', ...(embedded ? { flex: 1, border: 0, borderRadius: 0, boxShadow: 'none' } : {}) }}>
      <section aria-label={`Conversation with ${contact.name}`} style={{ ...pane, flex: 1 }}>
        <header style={{ ...row, flexWrap: 'nowrap', justifyContent: 'space-between', padding: mobile ? spacing.md : spacing.xl, borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, minWidth: 0 }}>
            <Avatar firstName={contact.name.split(' ')[0]} lastName={contact.name.split(' ').slice(1).join(' ')} size={40} />
            <div style={{ minWidth: 0 }}><strong>{contact.name}</strong><div style={{ ...meta, marginTop: spacing.xs, overflowWrap: 'anywhere' }}>{[contact.student ? `Student: ${contact.student}` : '', location.channel === 'sms' ? contact.phone || 'No phone number' : contact.email || 'No email address'].filter(Boolean).join(' · ')}</div></div>
          </div>
          {!embedded && <div role="group" aria-label="Conversation channel" style={{ display: 'flex', gap: spacing.sm, flexShrink: 0 }}>
            {(['sms', 'email'] as const).map(channel => <ControlButton key={channel} kind="toggle" selected={location.channel === channel} aria-pressed={location.channel === channel} onClick={() => switchChannel(channel)}>{channel === 'sms' ? 'SMS' : 'Email'}</ControlButton>)}
          </div>}
        </header>
        {sendError && <Notice variant="error" style={{ margin: spacing.md, flexShrink: 0 }}>{sendError}</Notice>}
        {location.channel === 'email' && location.view !== 'compose' && emailError && <Notice variant="warning" style={{ margin: spacing.md, flexShrink: 0 }}><div style={row}><span>{emailError}</span><Button variant="secondary" size="sm" disabled={emailLoading} onClick={() => void loadEmails(contact.id)}>Retry history</Button></div></Notice>}
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
          {showReader && <section ref={reader} aria-label="Email reader" style={{ ...pane, overflowY: embedded ? 'hidden' : 'auto', background: colors.background, padding: embedded ? 0 : mobile ? spacing.md : spacing.xl }}>
            {!embedded && !desktop && emails.length > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}><BackControl label="Back to emails" onClick={() => navigate({ screen: 'list' })} /><h2 style={{ ...typography.h2, margin: 0 }}>Email conversation</h2></div>}
            {!active ? emailLoading ? <ProfilePanelSkeleton /> : <div style={{ margin: 'auto' }}><EmptyState title="No email history" description="No received or sent emails are available for this contact." action={<Button onClick={() => newEmail()}><Pencil size={14} aria-hidden="true" />New email</Button>} /></div> : <div style={{ width: '100%', minWidth: 0, ...(embedded ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } as CSSProperties : {}) }}>
              {!embedded && <div style={{ ...row, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['3xl'] }}><SectionTitle>{active.subject || 'New email'}</SectionTitle>{active.messages.length > 0 && <ControlButton kind="link" onClick={() => newEmail()}><Pencil size={14} aria-hidden="true" />New email</ControlButton>}</div>}
              {!!draft?.contextThreadId && <p style={meta}>Previous conversation: {contextThread?.subject}</p>}
              {contextMessages.length > 0 && <div aria-label="Previous email context">
              {contextMessages.map((message, index) => {
                const header = <div style={{ ...row, justifyContent: 'space-between' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm }}><EmailDirection direction={message.direction} /><strong>{message.direction === 'inbound' ? contact.name : senderName}</strong></span><span style={meta}>{message.time}</span></div>
                const content = <>{message.simulated && <span style={meta}>Sample email</span>}<p style={{ ...meta, overflowWrap: 'anywhere' }}>From: {message.direction === 'inbound' ? contact.email : senderEmail}<br />To: {message.direction === 'inbound' ? senderEmail : message.emailTo?.join(', ') || contact.email}{!!message.emailCc?.length && <><br />Cc: {message.emailCc.join(', ')}</>}</p><EmailBody message={message} /></>
                return index < contextMessages.length - 1 ? <details key={message.id} style={{ padding: `${spacing.xl} 0`, borderBottom: `1px solid ${colors.border}`, marginBottom: spacing.xl }}><summary style={{ cursor: 'pointer' }}>{header}</summary>{content}</details> : <article key={message.id} style={{ padding: `${spacing.xl} 0` }}>{header}{content}</article>
              })}
              </div>}
              <div ref={replyEditor} style={{ ...(embedded ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } : {}), marginTop: embedded ? 0 : spacing.xl, paddingTop: contextMessages.length ? spacing.xl : 0, borderTop: contextMessages.length ? `1px solid ${colors.border}` : undefined, paddingBottom: embedded ? 0 : spacing.xl }}>
                {composing && draft ? <>
                  {discardOpen ? <section aria-label="Discard email draft" style={{ padding: spacing.xl, border: `1px solid ${colors.border}`, marginBottom: spacing.lg }}><strong>Discard this draft?</strong><p style={meta}>Only this unsent draft will be removed.</p><div style={row}><Button variant="secondary" onClick={() => setDiscardOpen(false)}>Keep draft</Button><Button onClick={discardDraft}>Discard draft</Button></div></section> : null}
                  {signatureError && <p role="status" style={meta}>{signatureError}</p>}
                  <PrototypeEmailComposer fromControl={fromControl} disabled={sending || !canComposeEmail} senderEmail={senderEmail} key={active.id} name={contact.name} email={contact.email} student={contact.student} draft={draft} onChange={updateDraft} onSend={sendEmail} onCollapse={returnToConversation} onDiscard={() => setDiscardOpen(true)} replying={active.messages.length > 0} signatureHtml={signatureHtml} signatureImageUrl={signature?.logoUrl} senderName={senderName} people={contacts} templates={templates} onCreateTemplate={template => setTemplates(current => [...current, template])} />
                </> : draft ? <section aria-label="Email draft preview" style={{ border: `1px solid ${colors.border}`, borderRadius: 8, padding: spacing['2xl'], background: colors.surface }}><strong style={{ color: colors.crimson }}>Draft</strong><p style={{ ...meta, margin: `${spacing.sm} 0` }}>To: {draft.recipients?.to.map(id => contacts.find(person => person.id === id)?.name).join(', ') || contact.name}</p><p style={{ ...typography.body, whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{draft.bodyText || 'No message yet'}</p><Button variant="secondary" onClick={openDraft}>Continue draft</Button></section>
                  : active.messages.length > 0 ? <Button variant="secondary" onClick={openDraft}>{draftAction}</Button> : null}
              </div>
            </div>}
          </section>}
        </div>}
      </section>
    </SurfacePanel></div>}
    </fieldset>
    <PrototypeNewMessage key={newMessageChannel + String(newMessageOpen)} initialChannel={newMessageChannel} open={newMessageOpen} onClose={() => setNewMessageOpen(false)} people={contacts} preselected={location.view === 'contacts' ? undefined : contact.id} onEmail={newEmail} onSms={startNewSms} />
    {profile && <ConversationProfilePanel key={profile.id} person={profile} tenantId={tenantId} onClose={() => setProfile(null)} onCompose={channel => {
      setProfile(null)
      if (channel === 'email') {
        if (active && emailDrafts[active.id]) navigate({ view: 'compose', channel, activeId: active.id, screen: 'reader' })
        else newEmail()
      } else navigate({ view: 'contact', channel, screen: 'reader' })
    }} />}

    <Modal isOpen={leaveSmsOpen} onClose={() => setLeaveSmsOpen(false)} ariaLabel="Discard message and go back" size="sm"><ModalHeader title="Go back to Conversations?" onClose={() => setLeaveSmsOpen(false)} /><ModalBody>Going back to conversations will discard the current message</ModalBody><ModalFooter><Button variant="secondary" onClick={() => setLeaveSmsOpen(false)}>Cancel</Button><Button onClick={leaveSms}>Continue</Button></ModalFooter></Modal>
    {location.channel === 'email' && location.view !== 'contacts' && emailLoading && <p role="status">Loading email…</p>}
    {notice && <p role="status" style={{ ...meta, marginTop: spacing.xl }}>{notice}</p>}
  </PageContainer>
}
