'use client'

import { Pencil } from 'lucide-react'

import { formatContactTiming } from '@/lib/contact-timing'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Notice, Button, Input, PageContainer, PageHeader, SectionTitle, SurfacePanel, Tabs, Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui'
import { useIdentity } from '@/components/layout/IdentityProvider'
import { useWorkspaceHistory } from '@/lib/useWorkspaceHistory'
import { BackControl } from '@/components/ui/BackControl'
import { ResponsiveDataTable } from '@/components/ui/DataGridTable'
import { ControlButton } from '@/components/ui/ControlButton'
import { PersonName } from '@/components/ui/PersonName'
import PrototypeEmailComposer, { type PrototypeEmailDraft } from '@/components/inbox/PrototypeEmailComposer'
import PrototypeSmsConversation from '@/components/inbox/PrototypeSmsConversation'
import { colors, spacing, typography } from '@/lib/tokens'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { appendPrototypeMessage, createPrototypeThreads, groupPrototypeContacts, PROTOTYPE_EMAIL, PROTOTYPE_SIGNATURE, type PrototypeChannel, type PrototypeMessage } from '@/lib/conversations-prototype'
import SmsRecipientPicker from '@/components/inbox/SmsRecipientPicker'
import PrototypeNewMessage from '@/components/inbox/PrototypeNewMessage'
import { emailRecipientIds, fillMockTemplate, initialMockTemplates, validMockEmailRecipients, type MockEmailRecipients } from '@/lib/prototype-messaging'
import { prototypeHtmlText, prototypePreviewDocument } from '@/lib/conversations-prototype-html'

const draftPreviewStyle: CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', margin: `${spacing.sm} 0` }
const draftPreview = (text: string) => { const compact = text.replace(/\s+/g, ' ').trim(); return compact.length > 200 ? `${compact.slice(0, 200).trimEnd()}…` : compact }

const meta: CSSProperties = { ...typography.bodySmall, color: colors.textSecondary }
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: spacing.lg, flexWrap: 'wrap' }
const pane: CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }

type ConversationLocation = {
  view: 'contacts' | 'contact' | 'compose' | 'lead' | 'sms-compose'
  contactId: string
  channel: PrototypeChannel
  activeId: string
  screen: 'list' | 'reader'
}
const initialLocation: ConversationLocation = { view: 'contacts', contactId: 'chen', channel: 'sms', activeId: '', screen: 'list' }

function EmailBody({ message }: { message: PrototypeMessage }) {
  if (message.html) return <iframe title={`Email content ${message.id}`} sandbox="" referrerPolicy="no-referrer" srcDoc={prototypePreviewDocument(message.html)} style={{ width: '100%', height: 450, border: 0 }} />
  return <div style={{ ...typography.body, lineHeight: 1.85, overflowWrap: 'anywhere' }}>
    {message.body.split('\n\n').map((paragraph, index) => <p key={index} style={{ margin: `${spacing.xl} 0`, whiteSpace: 'pre-line' }}>{paragraph}</p>)}
    {message.direction === 'outbound' && <iframe title={`Email signature ${message.id}`} sandbox="" referrerPolicy="no-referrer" srcDoc={prototypePreviewDocument(PROTOTYPE_SIGNATURE)} style={{ width: '100%', height: 200, border: 0 }} />}
  </div>
}

function EmailDirection({ direction }: { direction: 'inbound' | 'outbound' }) {
  return <span role="img" aria-label={direction === 'outbound' ? 'Outbound email' : 'Inbound email'} title={direction === 'outbound' ? 'Outbound email' : 'Inbound email'} style={{ color: direction === 'outbound' ? colors.tealDark : colors.crimson, fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{direction === 'outbound' ? '↗' : '↙'}</span>
}

export default function ConversationsPrototype() {
  const { identity } = useIdentity()
  const senderName = identity?.fullName?.trim() || 'Admin identity unavailable in this preview'
  const signatureHtml = PROTOTYPE_SIGNATURE.replace('Headliner Office', senderName.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'))
  const [threads, setThreads] = useState(createPrototypeThreads)
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
  const [templates, setTemplates] = useState(initialMockTemplates)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const remembered = useRef<Record<string, ConversationLocation>>({})
  const draftSequence = useRef(0)
  const heading = useRef<HTMLDivElement>(null)
  const reader = useRef<HTMLElement>(null)
  const replyEditor = useRef<HTMLDivElement>(null)
  const mobile = useMediaQuery('(max-width: 760px)')
  const desktop = useMediaQuery('(min-width: 1000px)')
  const history = useWorkspaceHistory(initialLocation, next => {
    if (next.view !== 'contacts' && next.view !== 'sms-compose') remembered.current[next.contactId] = { ...next, view: 'contact' }
    setDiscardOpen(false)
    setLeaveSmsOpen(false)
    setEditingSmsRecipients(false)
    setLocation(next)
  })
  const pageFocusKey = location.view === 'sms-compose' ? 'sms-compose' : location.view === 'contacts' ? 'contacts' : `${location.contactId}-${location.view === 'lead' ? 'lead' : 'conversation'}`
  useEffect(() => { heading.current?.focus() }, [pageFocusKey])
  useEffect(() => {
    if (location.view !== 'compose' || !reader.current || !replyEditor.current) return
    const panel = reader.current
    const editorTop = replyEditor.current.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop
    // Leave a real slice of the preceding message visible, rather than a banner.
    panel.scrollTop = Math.max(0, editorTop - Math.min(96, panel.clientHeight * 0.2))
  }, [location.view, location.activeId])

  const contacts = groupPrototypeContacts(threads)
  const contact = contacts.find(item => item.id === location.contactId) || contacts[0]
  const emails = threads.filter(thread => thread.contactId === contact.id && thread.channel === 'email')
  const active = threads.find(thread => thread.id === location.activeId && thread.channel === 'email')
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
  const [contactSort, setContactSort] = useState<{ key: 'name' | 'time' | 'date'; direction: 'asc' | 'desc' }>({ key: 'time', direction: 'desc' })
  const latestMessage = (person: typeof contact) => person.threads.flatMap(thread => thread.messages).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).at(0)
  const visibleContacts = contacts.filter(person => {
    const matches = `${person.name} ${person.student} ${person.email} ${person.phone} ${person.threads.flatMap(thread => thread.messages.map(message => message.body)).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase())
    const date = latestMessage(person)?.timestamp?.slice(0, 10) || ''
    return matches && (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo)
  })
  const showEmailList = desktop || location.screen === 'list'
  const showReader = desktop || location.screen === 'reader'

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
    if (composingSms && newSms?.body.trim()) {
      setLeaveSmsOpen(true)
      return
    }
    if (location.view === 'sms-compose') leaveSms()
    else history.close()
  }
  function markSmsRead(id: string) {
    setThreads(current => current.map(thread => thread.contactId === id && thread.channel === 'sms' ? { ...thread, unread: false, messages: thread.messages.map(message => ({ ...message, unread: false })) } : thread))
  }
  function selectContact(id: string) {
    const person = contacts.find(item => item.id === id)!
    const next = remembered.current[id] || { ...initialLocation, contactId: id, channel: person.channel }
    history.navigate({ ...next, view: 'contact' })
    setNotice('')
    if (next.channel === 'sms') markSmsRead(id)
  }
  function switchChannel(channel: PrototypeChannel) {
    navigate({ view: 'contact', channel, screen: 'list' })
    if (channel === 'sms') markSmsRead(contact.id)
    if (channel === 'sms' && composing) setNotice('Email saved as draft.')
  }
  function readThread(id: string) {
    navigate({ view: 'contact', activeId: id, screen: 'reader' })
    setThreads(current => current.map(thread => thread.id === id ? { ...thread, unread: false, messages: thread.messages.map(message => ({ ...message, unread: false })) } : thread))
  }
  function openDraft() {
    if (!active) return
    setEmailDrafts(current => current[active.id] ? current : { ...current, [active.id]: { subject: active.messages.length ? `Re: ${active.subject || ''}` : active.subject || '', html: '<p><br></p>', contactOnly: true, recipients: { to: [contact.id], cc: [], bcc: [] } } })
    navigate({ view: 'compose', channel: 'email', screen: 'reader' })
  }
  function newEmail(recipients?: MockEmailRecipients) {
    const primary = recipients ? contacts.find(person => person.id === recipients.to[0]) || contact : contact
    const id = `email-draft-${++draftSequence.current}`
    setThreads(current => [{ ...primary, id, contactId: primary.id, channel: 'email', subject: '', unread: false, messages: [] }, ...current])
    setEmailDrafts(current => ({ ...current, [id]: { subject: '', html: '<p><br></p>', contactOnly: !recipients, recipients: recipients || { to: [contact.id], cc: [], bcc: [] } } }))
    navigate({ view: 'compose', contactId: primary.id, activeId: id, channel: 'email', screen: 'reader' }); setNewMessageOpen(false)
  }
  function updateDraft(next: PrototypeEmailDraft) {
    if (!active) return
    setEmailDrafts(current => ({ ...current, [active.id]: { ...next, bodyText: prototypeHtmlText(next.html.replaceAll(PROTOTYPE_SIGNATURE, '')) } }))
    if (!active.messages.length) setThreads(current => current.map(thread => thread.id === active.id ? { ...thread, subject: next.subject } : thread))
  }
  function sendSms() {
    const body = smsDrafts[sms.id] || ''
    if (!body.trim()) return
    setThreads(current => [appendPrototypeMessage(sms, body), ...current.filter(thread => thread.id !== sms.id)])
    setSmsDrafts(current => ({ ...current, [sms.id]: '' }))
    setNotice('Mock message added. Nothing was sent.')
  }
  function sendEmail(body: string, html: string) {
    if (!active || !draft || !body.trim() || !draft.subject.trim() || (draft.recipients && !validMockEmailRecipients(draft.recipients, contacts))) return
    const updated = appendPrototypeMessage({ ...active, subject: draft.subject.trim().replace(/^Re: /i, '') }, body, html)
    const outbound = updated.messages.at(-1)!
    if (draft.recipients) {
      outbound.emailTo = draft.recipients.to.map(id => contacts.find(person => person.id === id)!.email)
      outbound.emailCc = draft.recipients.cc.map(id => contacts.find(person => person.id === id)!.email)
    }
    setThreads(current => {
      const ids = draft.recipients ? emailRecipientIds(draft.recipients) : [contact.id]
      const sent = ids.map(id => {
        if (id === active.contactId) return updated
        const person = contacts.find(item => item.id === id)!
        return { ...updated, ...person, id: `${active.id}-copy-${id}`, contactId: id, channel: 'email' as const, subject: updated.subject, messages: [updated.messages.at(-1)!], unread: false }
      })
      const retained = current.filter(thread => thread.id !== active.id || (active.messages.length > 0 && !ids.includes(active.contactId)))
      return [...sent, ...retained]
    })
    setEmailDrafts(current => { const next = { ...current }; delete next[active.id]; return next })
    const first = draft.recipients?.to[0] || contact.id
    navigate({ view: standalone ? 'contacts' : 'contact', contactId: first, activeId: first === active.contactId ? active.id : `${active.id}-copy-${first}`, screen: 'reader' })
    setNotice('Mock message added. Nothing was sent.')
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
  function sendNewSms(ids: string[], body: string) {
    setThreads(current => {
      let next = current
      for (const id of ids) {
        const person = contacts.find(item => item.id === id)
        if (!person?.phone) continue
        const existing = next.find(thread => thread.contactId === id && thread.channel === 'sms')
        const base = existing || { ...person, id: `${id}-sms`, contactId: id, channel: 'sms' as const, messages: [] }
        next = [appendPrototypeMessage(base, fillMockTemplate(body, person)), ...next.filter(thread => thread.id !== base.id)]
      }
      return next
    })
    setNewSms(null)
    navigate({ view: 'contacts', activeId: '' })
    setNewMessageOpen(false); setNotice(`Mock SMS added separately to ${ids.length} conversation${ids.length === 1 ? '' : 's'}. Nothing was sent.`)
  }
  const returnToConversation = () => navigate({ view: standalone ? 'contacts' : 'contact' })
  const draftAction = 'Reply'

  return <PageContainer style={{ padding: mobile ? spacing.md : spacing['3xl'], boxSizing: 'border-box', minWidth: 0, color: colors.text, fontFamily: typography.fontSans }}>
    <div ref={heading} tabIndex={-1} style={{ outline: 'none' }}>
      <PageHeader title={location.view === 'sms-compose' ? 'Write a text message' : location.view === 'contacts' ? 'Conversations' : standalone ? 'New message' : contact.name}
        titleAction={location.view !== 'contacts' && location.view !== 'lead' && location.view !== 'sms-compose' && !standalone ? <ControlButton kind="link" aria-label={`Open lead for ${contact.name}`} onClick={() => navigate({ view: 'lead' })}>View lead</ControlButton> : undefined}
        onBack={location.view === 'contacts' ? undefined : goBackToConversations} backLabel="Back to Conversations"
        right={location.view === 'contacts' ? <div style={row}><Button onClick={() => { setNewMessageChannel('sms'); setNewMessageOpen(true) }}>Send new text message</Button><Button onClick={() => { setNewMessageChannel('email'); setNewMessageOpen(true) }}>Send new email</Button></div> : undefined} />
    </div>

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
      <ResponsiveDataTable rows={visibleContacts.slice().sort((a, b) => {
        const left = latestMessage(a)?.timestamp || ''; const right = latestMessage(b)?.timestamp || ''
        if (contactSort.key !== 'name' && (!left || !right)) return left ? -1 : right ? 1 : a.name.localeCompare(b.name)
        const value = contactSort.key === 'name' ? a.name.localeCompare(b.name) : contactSort.key === 'date' ? left.slice(0, 10).localeCompare(right.slice(0, 10)) : left.localeCompare(right)
        return (contactSort.direction === 'asc' ? value : -value) || a.name.localeCompare(b.name)
      })} getRowKey={person => person.id} ariaLabel="Conversations" minDesktopWidth={360} alignToSelectionInset stickyHeaderOffset={0}
        sort={contactSort} onSortChange={setContactSort} onRowClick={person => selectContact(person.id)} emptyContent="No conversations match your filters."
        columns={[
          { id: 'name', header: 'Name', width: 'minmax(220px, 2fr)', sortable: true, sortKey: 'name', render: person => <div><PersonName as="button" aria-label={`Open conversation with ${person.name}`} onClick={() => selectContact(person.id)} style={{ textAlign: 'left' }}>{person.name}</PersonName><div style={{ ...meta, marginTop: spacing.xs }}>{person.newSms} new SMS · {person.newEmails} unread emails</div></div> },
          { id: 'time', header: 'Last contacted', width: 'minmax(180px, 1fr)', sortable: true, sortKey: 'time', defaultSortDirection: 'desc', render: person => formatContactTiming(latestMessage(person)?.timestamp) },
        ]} />
      </SurfacePanel>
    </div> : location.view === 'sms-compose' ? composingSms && newSms ? <section aria-label="New SMS composer" style={{ minWidth: 0 }}>
      <SurfacePanel padding="0" style={{ ...pane, minHeight: 'max(360px, calc(100dvh - 240px))' }}>
        <div style={{ padding: spacing.lg, borderBottom: `1px solid ${colors.border}`, overflowWrap: 'anywhere' }}>
          <div style={{ ...row, justifyContent: 'space-between' }}><strong>To: {smsRecipients.map(person => person.name).join(', ') || 'No recipients selected'}</strong><div role="group" aria-label="Text message actions" style={row}><Button variant="secondary" onClick={() => { setSmsRecipientQuery(''); setEditingSmsRecipients(true) }}>Edit recipients</Button><Button variant="ghost" onClick={() => setDiscardOpen(true)}>Discard text message</Button></div></div>
          <p style={{ ...meta, marginBottom: 0 }}>Sent individually to each recipient.</p>
        </div>
        <PrototypeSmsConversation thread={newSmsThread || { ...sms, id: newSms.id, messages: [] }} mobile={mobile} recipients={smsRecipients} draft={newSms.body} onChange={body => setNewSms(current => current ? { ...current, body } : current)} onSend={() => { if (newSms.body.trim() && smsRecipients.some(person => person.phone)) sendNewSms(newSms.ids, newSms.body) }} />
      </SurfacePanel>
      <Modal isOpen={editingSmsRecipients} onClose={() => setEditingSmsRecipients(false)} ariaLabel="Edit SMS recipients" size="lg"><ModalHeader compact title="Select text message recipients" onClose={() => setEditingSmsRecipients(false)} /><ModalBody style={{ display: 'flex', flexDirection: 'column' }}><div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 }}><SmsRecipientPicker query={smsRecipientQuery} results={smsOptions.filter(person => `${person.first_name} ${person.last_name} ${person.phone}`.toLowerCase().includes(smsRecipientQuery.trim().toLowerCase()))} selected={smsOptions.filter(person => newSms.ids.includes(person.id))} handleSearch={setSmsRecipientQuery} toggleRecipient={person => setNewSms(current => current ? { ...current, ids: current.ids.includes(person.id) ? current.ids.filter(id => id !== person.id) : [...current.ids, person.id] } : current)} /></div></ModalBody><ModalFooter><Button onClick={() => setEditingSmsRecipients(false)}>Done</Button></ModalFooter></Modal>
      <Modal isOpen={discardOpen} onClose={() => setDiscardOpen(false)} ariaLabel="Discard text message" size="sm"><ModalHeader title="Discard this text message?" onClose={() => setDiscardOpen(false)} /><ModalBody>Your recipients and unsent text will be removed.</ModalBody><ModalFooter><Button variant="secondary" onClick={() => setDiscardOpen(false)}>Keep message</Button><Button variant="destructive" onClick={() => { setNewSms(null); navigate({ view: 'contacts', activeId: '' }) }}>Discard message</Button></ModalFooter></Modal>
    </section> : <p role="status">This text message is no longer available. Go back to Conversations to start a new message.</p> : standalone && composing && active && draft ? <section aria-label="New email message" style={{ minWidth: 0, width: '100%' }}>
      {discardOpen && <section aria-label="Discard email draft" style={{ padding: spacing.lg }}><p>Discard this draft?</p><Button variant="secondary" onClick={() => setDiscardOpen(false)}>Keep draft</Button><Button onClick={discardDraft}>Discard draft</Button></section>}
      <PrototypeEmailComposer key={active.id} name="" email="" student="" draft={draft} onChange={updateDraft} onSend={sendEmail} onCollapse={returnToConversation} onDiscard={() => setDiscardOpen(true)} replying={false} signatureHtml={signatureHtml} senderName={senderName} people={contacts} templates={templates} onCreateTemplate={template => setTemplates(current => [...current, template])} />
    </section> : location.view === 'lead' ? <SurfacePanel style={{ maxWidth: 900 }}>
      <section aria-label="Lead preview"><div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}><BackControl label="Back to conversation" onClick={returnToConversation} /><SectionTitle>{contact.student}</SectionTitle></div><p style={meta}>{contact.interest} · {contact.stage}</p><SectionTitle>Notes</SectionTitle><p style={meta}>{contact.note}</p></section>
    </SurfacePanel> : <SurfacePanel padding="0" style={{ ...pane, height: 'max(280px, calc(100dvh - 240px))', overflow: 'hidden' }}>
      <section aria-label={`Conversation with ${contact.name}`} style={{ ...pane, flex: 1 }}>
        <div style={{ ...row, justifyContent: 'space-between', padding: mobile ? spacing.md : `${spacing.xl} ${spacing['3xl']}`, borderBottom: `1px solid ${colors.borderLight}` }}>
          <Tabs items={[{ key: 'sms', label: 'SMS' }, { key: 'email', label: 'Email' }]} activeKey={location.channel} onChange={switchChannel} />
        </div>
        {location.channel === 'sms' ? <PrototypeSmsConversation thread={sms} mobile={mobile} draft={smsDrafts[sms.id] || ''} onChange={value => setSmsDrafts(current => ({ ...current, [sms.id]: value }))} onSend={sendSms} /> : <div style={{ ...pane, flex: 1, display: 'grid', gridTemplateColumns: desktop ? 'minmax(0, 3fr) minmax(0, 7fr)' : 'minmax(0, 1fr)' }}>
          {showEmailList && <aside aria-label="Email conversations" style={{ ...pane, borderRight: desktop ? `1px solid ${colors.border}` : undefined, overflowY: 'auto' }}>

            {!emails.length && <div style={{ padding: spacing['2xl'], ...meta }}><p>No email history with {contact.name.split(' ')[0]} yet.</p><Button onClick={() => newEmail()}>Draft email</Button></div>}
            {emails.map(thread => {
              const latest = thread.messages.at(-1)
              return <ControlButton kind="row" key={thread.id} aria-label={`Read email: ${thread.subject || 'Untitled draft'}`} selected={active?.id === thread.id} onClick={() => readThread(thread.id)} style={{ display: 'block', borderBottom: `1px solid ${colors.borderLight}`, padding: spacing['2xl'], borderRadius: 0 }}>
                <div style={{ ...row, justifyContent: 'space-between', ...meta }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm }}>{latest && <EmailDirection direction={latest.direction} />}{latest?.direction === 'inbound' ? thread.name : latest ? 'Headliner Office' : 'Draft'}</span><span>{latest?.time.split(' · ')[0] || 'Unsent'}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>{thread.unread && <span role="img" aria-label="Unread email" style={{ display: 'inline-block', width: 8, height: 8, flexShrink: 0, borderRadius: '50%', background: colors.teal }} />}<strong style={{ color: colors.text }}>{thread.subject || 'Untitled draft'}</strong></div>
                <p style={{ ...meta, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: `${spacing.sm} 0 0` }}>{emailDrafts[thread.id] ? `Draft · ${emailDrafts[thread.id].bodyText || 'No message yet'}` : latest?.body || 'Unsent draft'}</p>
              </ControlButton>
            })}
          </aside>}
          {showReader && <section ref={reader} aria-label="Email reader" style={{ ...pane, overflowY: 'auto', background: colors.background, padding: mobile ? spacing.md : spacing.xl }}>
            {!desktop && <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}><BackControl label="Back to emails" onClick={() => navigate({ screen: 'list' })} /><h2 style={{ ...typography.h2, margin: 0 }}>Email conversation</h2></div>}
            {!active ? <p style={{ ...meta, margin: 'auto', textAlign: 'center' }}>Select an email to read.</p> : <div style={{ width: '100%', minWidth: 0 }}>
              <div style={{ ...row, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['3xl'] }}><SectionTitle>{active.subject || 'New email'}</SectionTitle>{active.messages.length > 0 && <ControlButton kind="link" onClick={() => newEmail()}><Pencil size={14} aria-hidden="true" />New email</ControlButton>}</div>
              {!active.messages.length && <p style={meta}>This email has not been sent.</p>}
              {!!draft?.contextThreadId && <p style={meta}>Previous conversation: {contextThread?.subject}</p>}
              {contextMessages.length > 0 && <div aria-label="Previous email context">
              {contextMessages.map((message, index) => {
                const header = <div style={{ ...row, justifyContent: 'space-between' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm }}><EmailDirection direction={message.direction} /><strong>{message.direction === 'inbound' ? contact.name : 'Headliner Office'}</strong></span><span style={meta}>{message.time}</span></div>
                const content = <><p style={{ ...meta, overflowWrap: 'anywhere' }}>From: {message.direction === 'inbound' ? contact.email : PROTOTYPE_EMAIL}<br />To: {message.direction === 'inbound' ? PROTOTYPE_EMAIL : message.emailTo?.join(', ') || contact.email}{!!message.emailCc?.length && <><br />Cc: {message.emailCc.join(', ')}</>}</p><EmailBody message={message} />{message.simulated && <p style={meta}>Mock only — not sent</p>}</>
                return index < contextMessages.length - 1 ? <details key={message.id} style={{ padding: `${spacing.xl} 0`, borderBottom: `1px solid ${colors.border}`, marginBottom: spacing.xl }}><summary style={{ cursor: 'pointer' }}>{header}</summary>{content}</details> : <article key={message.id} style={{ padding: `${spacing.xl} 0` }}>{header}{content}</article>
              })}
              </div>}
              <div ref={replyEditor} style={{ marginTop: spacing.xl, paddingTop: contextMessages.length ? spacing.xl : 0, borderTop: contextMessages.length ? `1px solid ${colors.border}` : undefined, paddingBottom: spacing.xl }}>
                {composing && draft ? <>
                  {discardOpen ? <section aria-label="Discard email draft" style={{ padding: spacing.xl, border: `1px solid ${colors.border}`, marginBottom: spacing.lg }}><strong>Discard this draft?</strong><p style={meta}>Only this unsent draft will be removed.</p><div style={row}><Button variant="secondary" onClick={() => setDiscardOpen(false)}>Keep draft</Button><Button onClick={discardDraft}>Discard draft</Button></div></section> : null}
                  <PrototypeEmailComposer key={active.id} name={contact.name} email={contact.email} student={contact.student} draft={draft} onChange={updateDraft} onSend={sendEmail} onCollapse={returnToConversation} onDiscard={() => setDiscardOpen(true)} replying={active.messages.length > 0} signatureHtml={signatureHtml} senderName={senderName} people={contacts} templates={templates} onCreateTemplate={template => setTemplates(current => [...current, template])} />
                </> : draft ? <section aria-label="Email draft preview" style={{ border: `1px solid ${colors.border}`, borderRadius: 8, padding: spacing['2xl'], background: colors.surface }}><strong style={{ color: colors.crimson }}>Draft</strong><p style={{ ...meta, margin: `${spacing.sm} 0` }}>To: {draft.recipients?.to.map(id => contacts.find(person => person.id === id)?.name).join(', ') || contact.name}</p><p style={{ ...typography.body, whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{draft.bodyText || 'No message yet'}</p><Button variant="secondary" onClick={openDraft}>Continue draft</Button></section>
                  : active.messages.length > 0 ? <Button variant="secondary" onClick={openDraft}>{draftAction}</Button> : null}
              </div>
            </div>}
          </section>}
        </div>}
      </section>
    </SurfacePanel>}
    <PrototypeNewMessage key={newMessageChannel + String(newMessageOpen)} initialChannel={newMessageChannel} open={newMessageOpen} onClose={() => setNewMessageOpen(false)} people={contacts} preselected={location.view === 'contacts' ? undefined : contact.id} onEmail={newEmail} onSms={startNewSms} />
    <Modal isOpen={leaveSmsOpen} onClose={() => setLeaveSmsOpen(false)} ariaLabel="Discard message and go back" size="sm"><ModalHeader title="Go back to Conversations?" onClose={() => setLeaveSmsOpen(false)} /><ModalBody>Going back to conversations will discard the current message</ModalBody><ModalFooter><Button variant="secondary" onClick={() => setLeaveSmsOpen(false)}>Cancel</Button><Button onClick={leaveSms}>Continue</Button></ModalFooter></Modal>
    {notice && <p role="status" style={{ ...meta, marginTop: spacing.xl }}>{notice}</p>}
  </PageContainer>
}
