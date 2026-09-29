'use client'
import { useState, useEffect, useRef, Suspense, type ComponentProps } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Sparkles, SquarePen, Trash2 } from 'lucide-react'
import { getActiveTenantId } from '@/lib/tenant'
import { useIsMobile } from '@/lib/useMediaQuery'
import { Avatar, Button, Modal, ModalBody, ModalFooter, ModalHeader, Notice, PageContainer, PageHeader, SlidePanel, Textarea } from '@/components/ui'
import ContactSlidePanel from '@/components/contacts/ContactSlidePanel'
import { LeadDetailPanel } from '@/components/leads/LeadDetailPanel'
import ComposeModal from '@/components/inbox/ComposeModal'
import { colors, typography, spacing } from '@/lib/tokens'
import { displayMessageStatus } from '@/lib/message-status'

interface Message {
  id: string
  body: string
  direction: 'inbound' | 'outbound'
  status: string
  error_message: string | null
  created_at: string
  to_phone: string | null
  from_phone: string | null
  media_url: string | null
}

interface Thread {
  thread_key: string
  contact_id: string
  other_phone: string
  first_name: string
  last_name: string
  student_name: string
  display_name: string
  account_holder_name: string | null
  client_status: string
  messages: Message[]
  last_message_at: string
  last_message_body: string
  last_message_direction: string
  has_unread: boolean
  profile_type: 'contact' | 'lead' | null
  profile_id: string | null
  profile_intake_type: string | null
}

type ContactPanelContact = ComponentProps<typeof ContactSlidePanel>['contact']
type ContactPanelTenantField = ComponentProps<typeof ContactSlidePanel>['tenantFields'][number]
type LeadPanelLead = ComponentProps<typeof LeadDetailPanel>['lead']
type LeadPanelDraft = ComponentProps<typeof LeadDetailPanel>['draft']

function InboxPageInner() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThread, setActiveThread] = useState<Thread | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedContact, setSelectedContact] = useState<ContactPanelContact | null>(null)
  const [selectedLead, setSelectedLead] = useState<LeadPanelLead | null>(null)
  const [leadPanelDraft, setLeadPanelDraft] = useState<LeadPanelDraft>({})
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [tenantFields, setTenantFields] = useState<ContactPanelTenantField[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [isMobileThreadOpen, setIsMobileThreadOpen] = useState(false)
  const [canDeleteConversations, setCanDeleteConversations] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const isMobile = useIsMobile()
  const tenantId = getActiveTenantId()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const replyInputRef = useRef<HTMLTextAreaElement>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const campaignId = searchParams.get('campaign')

  const fetchThreads = async (): Promise<Thread[]> => {
    const url = campaignId
      ? `/api/inbox?tenant=${tenantId}&campaign_id=${campaignId}`
      : `/api/inbox?tenant=${tenantId}`
    const data = await fetch(url).then(r => r.json())
    const result = Array.isArray(data) ? data : []
    setThreads(result)
    return result
  }

  useEffect(() => {
    fetchThreads().then(() => setLoading(false))
    fetch(`/api/tenant-fields?tenant=${tenantId}`).then(r => r.json()).then(data => {
      setTenantFields(Array.isArray(data) ? data : [])
    }).catch(() => {})
    fetch(`/api/account/me?tenant=${tenantId}`).then(async response => {
      if (!response.ok) return null
      return response.json()
    }).then(data => setCanDeleteConversations(data?.roleKey === 'owner' || data?.roleKey === 'admin')).catch(() => {})
  }, [tenantId])

  // Poll for new messages so conversations update without a manual refresh.
  useEffect(() => {
    const interval = setInterval(async () => {
      const result = await fetchThreads()
      setActiveThread(prev => {
        if (!prev) return prev
        return result.find(t => t.thread_key === prev.thread_key) || prev
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [tenantId, campaignId])

  useEffect(() => {
    if (!messagesEndRef.current) return
    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [activeThread?.thread_key, activeThread?.messages?.length])

  const handleViewProfile = async () => {
    if (!activeThread?.profile_id || !activeThread.profile_type) return
    setProfileLoading(true)
    setProfileError('')
    try {
      if (activeThread.profile_type === 'lead') {
        const params = new URLSearchParams()
        if (activeThread.profile_intake_type) params.set('intake_type', activeThread.profile_intake_type)
        const response = await fetch(`/api/leads/${activeThread.profile_id}?${params.toString()}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data?.error || 'Could not load lead')
        setSelectedLead(data)
        setLeadPanelDraft({})
        return
      }

      const response = await fetch(`/api/contacts/${activeThread.profile_id}?tenant=${tenantId}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Could not load contact')
      setSelectedContact(data)
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not load profile')
    } finally {
      setProfileLoading(false)
    }
  }

  const patchSelectedLead = async (patch: Record<string, unknown>) => {
    if (!selectedLead) return false
    try {
      const response = await fetch(`/api/leads/${selectedLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Could not save lead')
      setSelectedLead(data)
      return true
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not save lead')
      return false
    }
  }

  const handleAiDraft = async () => {
    if (!activeThread) return
    setAiLoading(true)
    try {
      const lastInbound = activeThread.messages
        .filter(m => m.direction === 'inbound')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

      const res = await fetch('/api/draft-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: reply.trim() || 'Write a helpful reply to this message',
          recipient_context: `Replying to ${activeThread.display_name}. Last message from them: "${lastInbound?.body || 'No previous messages'}"`,
        })
      })
      const data = await res.json()
      if (data.draft) setReply(data.draft)
    } catch (e) {
      console.error(e)
    } finally {
      setAiLoading(false)
    }
  }

  const handleReply = async () => {
    if (!reply.trim() || !activeThread) return
    setSending(true)
    try {
      const response = await fetch(`/api/inbox/reply?tenant=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: activeThread.contact_id,
          body: reply,
          to_phone: activeThread.other_phone,
        })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not send reply')
      setReply('')
      const updated = await fetchThreads()
      const refreshed = updated.find(t => t.thread_key === activeThread.thread_key)
      if (refreshed) setActiveThread(refreshed)
    } catch (e) {
      console.error(e)
    } finally {
      setSending(false)
    }
  }

  const handleDeleteConversation = async () => {
    if (!activeThread || deleteLoading) return
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const response = await fetch(`/api/inbox?tenant=${tenantId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ other_phone: activeThread.other_phone }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Could not delete conversation.')
      setThreads(current => current.filter(thread => thread.thread_key !== activeThread.thread_key))
      setActiveThread(null)
      setReply('')
      setIsMobileThreadOpen(false)
      setIsDeleteOpen(false)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete conversation.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const formatDay = (ts: string) => {
    const d = new Date(ts)
    const today = new Date()
    const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const handleSelectThread = (thread: Thread) => {
    setActiveThread(thread)
    setProfileError('')
    if (!isMobile) return

    setIsMobileThreadOpen(false)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsMobileThreadOpen(true))
    })
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '320px 1fr',
      gridTemplateRows: 'auto 1fr',
      height: isMobile ? 'calc(100dvh - 56px)' : 'calc(100vh - 0px)',
      overflow: 'hidden',
    }}>

      {/* Page header */}
      <PageContainer style={{ gridColumn: '1 / -1', paddingBottom: 0 }}>
        <PageHeader
          title="Conversations"
          subtitle={loading ? 'Loading...' : undefined}
          right={
            <button
              onClick={() => setIsComposeOpen(true)}
              title="New message"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text,
                cursor: 'pointer',
              }}
            >
              <SquarePen size={18} />
            </button>
          }
        />
        {profileError && !selectedLead && !selectedContact && (
          <Notice variant="error" style={{ marginBottom: spacing.lg }}>{profileError}</Notice>
        )}
      </PageContainer>

      {/* LEFT — Thread list */}
      <div style={{
        gridColumn: isMobile ? 1 : undefined,
        gridRow: isMobile ? 2 : undefined,
        minWidth: isMobile ? 0 : undefined,
        borderRight: isMobile ? 'none' : `1px solid ${colors.border}`,
        overflowY: 'auto',
        background: colors.surface,
        display: 'flex',
        flexDirection: 'column',
        transform: isMobile && isMobileThreadOpen ? 'translateX(-100%)' : 'translateX(0)',
        transition: isMobile ? 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
        pointerEvents: isMobile && isMobileThreadOpen ? 'none' : 'auto',
      }}>

        {/* Thread list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!loading && threads.length === 0 ? (
            <div style={{ padding: spacing['2xl'] }}>
              <p style={{ fontSize: typography.sizeBase, color: colors.textMuted, fontFamily: typography.fontSans, lineHeight: 1.6, margin: 0 }}>
                No replies yet. When contacts respond to your messages, conversations will appear here.
              </p>
            </div>
          ) : (
            threads.map(thread => (
              <div
                key={thread.thread_key}
                onClick={() => handleSelectThread(thread)}
                style={{
                  padding: `${spacing.md} ${spacing['2xl']}`,
                  borderBottom: `1px solid ${colors.borderLight}`,
                  cursor: 'pointer',
                  background: activeThread?.thread_key === thread.thread_key
                    ? colors.background : colors.surface,
                  display: 'flex',
                  gap: spacing.md,
                  alignItems: 'flex-start',
                  transition: 'background 0.1s',
                }}
              >
                <Avatar
                  firstName={thread.first_name || '?'}
                  lastName={thread.last_name || '?'}
                  size={36}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontSize: typography.sizeMd, fontWeight: typography.weightSemibold, color: colors.text, fontFamily: typography.fontSans }}>
                      {thread.display_name}
                    </span>
                    <span style={{ fontSize: typography.sizeXs, color: colors.textMuted, fontFamily: typography.fontSans, flexShrink: 0, marginLeft: spacing.sm }}>
                      {thread.last_message_at ? formatDay(thread.last_message_at) : ''}
                    </span>
                  </div>
                  {thread.account_holder_name && thread.account_holder_name !== thread.student_name && (
                    <div style={{ fontSize: typography.sizeXs, color: colors.textMuted, fontFamily: typography.fontSans, marginBottom: '2px' }}>
                      {thread.account_holder_name}
                    </div>
                  )}
                  <div style={{ fontSize: typography.sizeSm, color: colors.textSecondary, fontFamily: typography.fontSans, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {thread.last_message_direction === 'outbound' ? 'You: ' : ''}{thread.last_message_body}
                  </div>
                </div>
                {thread.has_unread && (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors.crimson, flexShrink: 0, marginTop: '6px' }} />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT — Active thread */}
      {activeThread ? (
        <div style={{
          gridColumn: isMobile ? 1 : undefined,
          gridRow: isMobile ? 2 : undefined,
          minWidth: isMobile ? 0 : undefined,
          position: isMobile ? 'fixed' : undefined,
          inset: isMobile ? 0 : undefined,
          width: isMobile ? '100dvw' : undefined,
          height: isMobile ? '100dvh' : undefined,
          zIndex: isMobile ? 100 : undefined,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: colors.background,
          transform: isMobile && !isMobileThreadOpen ? 'translateX(100%)' : 'translateX(0)',
          transition: isMobile ? 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
          pointerEvents: isMobile && !isMobileThreadOpen ? 'none' : 'auto',
        }}>

          {/* Thread header */}
          <div style={{
            padding: isMobile ? `${spacing.md} ${spacing.lg}` : `${spacing.lg} ${spacing['2xl']}`,
            borderBottom: `1px solid ${colors.border}`,
            background: colors.surface,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, minWidth: isMobile ? 0 : undefined }}>
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setIsMobileThreadOpen(false)}
                  aria-label="Back to conversations"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    padding: 0,
                    border: 'none',
                    borderRadius: '50%',
                    background: 'transparent',
                    color: colors.text,
                    cursor: 'pointer',
                  }}
                >
                  <ArrowLeft size={22} />
                </button>
              )}
              <Avatar
                firstName={activeThread.first_name || '?'}
                lastName={activeThread.last_name || '?'}
                size={40}
              />
              <div style={{ minWidth: isMobile ? 0 : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 }}>
                  <div style={{ fontSize: typography.sizeLg, fontWeight: typography.weightSemibold, color: colors.text, fontFamily: typography.fontSans, whiteSpace: isMobile ? 'nowrap' : undefined, overflow: isMobile ? 'hidden' : undefined, textOverflow: isMobile ? 'ellipsis' : undefined }}>
                    {activeThread.display_name}
                  </div>
                  {activeThread.profile_id && activeThread.profile_type && (
                    <button
                      type="button"
                      onClick={() => void handleViewProfile()}
                      disabled={profileLoading}
                      style={{ fontSize: typography.sizeSm, color: colors.teal, background: 'transparent', border: 'none', cursor: profileLoading ? 'wait' : 'pointer', fontFamily: typography.fontSans, padding: 0, flexShrink: 0 }}
                    >
                      {profileLoading ? 'Loading…' : 'View'}
                    </button>
                  )}
                </div>
                <div style={{ fontSize: typography.sizeSm, color: colors.textMuted, fontFamily: typography.fontSans, whiteSpace: isMobile ? 'nowrap' : undefined, overflow: isMobile ? 'hidden' : undefined, textOverflow: isMobile ? 'ellipsis' : undefined }}>
                  Student: {activeThread.student_name} · {activeThread.other_phone}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, flexShrink: 0, marginLeft: isMobile ? spacing.sm : undefined }}>
              {canDeleteConversations && (
                <button
                  type="button"
                  onClick={() => { setDeleteError(''); setIsDeleteOpen(true) }}
                  aria-label={`Delete conversation with ${activeThread.display_name}`}
                  title="Delete conversation"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, padding: 0, border: 'none', borderRadius: '50%', background: 'transparent', color: colors.error, cursor: 'pointer' }}
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, minHeight: isMobile ? 0 : undefined, overflowY: 'auto', padding: isMobile ? `${spacing.lg} ${spacing.md}` : `${spacing['2xl']} ${spacing['3xl']}`, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {activeThread.messages
              .slice()
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              .map(msg => (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: isMobile ? '85%' : undefined }}>
                    <div style={{
                      maxWidth: isMobile ? '100%' : '360px',
                      padding: msg.media_url ? '6px' : `${spacing.sm} ${spacing.md}`,
                      borderRadius: msg.direction === 'outbound' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: msg.direction === 'outbound' ? '#007AFF' : colors.surface,
                      color: msg.direction === 'outbound' ? 'white' : colors.text,
                      fontSize: typography.sizeBase,
                      fontFamily: typography.fontSans,
                      lineHeight: 1.5,
                      border: msg.direction === 'inbound' ? `1px solid ${colors.border}` : 'none',
                      wordBreak: 'break-word',
                    }}>
                      {msg.media_url && (
                        <img
                          src={msg.media_url}
                          alt="Attachment"
                          style={{
                            display: 'block',
                            width: '100%',
                            maxHeight: 260,
                            objectFit: 'cover',
                            borderRadius: 10,
                          }}
                        />
                      )}
                      {msg.body ? (
                        <div style={{ padding: msg.media_url ? `${spacing.sm} ${spacing.md} 2px` : 0 }}>
                          {msg.body}
                        </div>
                      ) : null}
                    </div>
                    <div style={{
                      fontSize: typography.sizeXs,
                      color: colors.textMuted,
                      fontFamily: typography.fontSans,
                      marginTop: '4px',
                      textAlign: msg.direction === 'outbound' ? 'right' : 'left',
                    }}>
                      {formatTime(msg.created_at)}
                      {msg.direction === 'outbound' && msg.status ? ` · ${displayMessageStatus(msg.status)}` : ''}
                      {msg.direction === 'outbound' && msg.error_message ? ` · ${msg.error_message}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply bar */}
          <div style={{
            padding: isMobile ? spacing.md : spacing['2xl'],
            borderTop: `1px solid ${colors.border}`,
            background: colors.surface,
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.sm,
            flexShrink: 0,
          }}>

            {/* Textarea */}
            <Textarea
              ref={replyInputRef}
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleReply()
                }
              }}
              placeholder={`Reply to ${activeThread.display_name}...`}
              style={{ width: '100%', minHeight: '60px', maxHeight: '120px', resize: 'none' }}
            />

            {/* AI drafting button */}
            <button
              onClick={handleAiDraft}
              disabled={aiLoading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start',
                background: aiLoading ? colors.borderLight : reply.trim() ? colors.espresso : colors.borderLight,
                color: aiLoading ? colors.textMuted : reply.trim() ? 'white' : colors.textSecondary,
                border: 'none', borderRadius: '4px', padding: `${spacing.xs} ${spacing.sm}`,
                fontSize: typography.sizeSm, cursor: aiLoading ? 'not-allowed' : 'pointer', fontFamily: typography.fontSans,
              }}
            >
              <Sparkles size={12} /> {aiLoading ? 'Writing...' : reply.trim() ? 'Polish with AI' : 'Draft with AI'}
            </button>

            {/* Bottom row: cost + send */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              {reply.trim().length > 0 && (
                <div style={{ fontSize: typography.sizeSm, color: colors.textMuted, fontFamily: typography.fontSans }}>
                  SMS · {Math.ceil(Math.max(reply.length, 1) / 160)} {Math.ceil(Math.max(reply.length, 1) / 160) === 1 ? 'segment' : 'segments'} · ~${(Math.ceil(Math.max(reply.length, 1) / 160) * 0.0083).toFixed(2)}
                </div>
              )}
              {!reply.trim().length && <span />}
              <Button
                variant="primary"
                onClick={handleReply}
                disabled={sending || !reply.trim()}
              >
                {sending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      ) : !isMobile ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.background }}>
          <p style={{ fontSize: typography.sizeBase, color: colors.textMuted, fontFamily: typography.fontSans }}>
            Select a conversation to read and reply.
          </p>
        </div>
      ) : null}

      {/* Contact slide panel */}
      {selectedContact && (
        <ContactSlidePanel
          contact={selectedContact}
          tenantFields={tenantFields}
          onClose={() => { setSelectedContact(null); setProfileError('') }}
          onUpdated={(updated) => setSelectedContact(updated)}
          onCompose={() => {
            setSelectedContact(null)
            setTimeout(() => replyInputRef.current?.focus(), 150)
          }}
        />
      )}

      <SlidePanel isOpen={Boolean(selectedLead)} onClose={() => { setSelectedLead(null); setProfileError('') }} fullScreen={isMobile} width="min(88vw, 1180px)">
        {profileError && <Notice variant="error">{profileError}</Notice>}
        {selectedLead && (
          <LeadDetailPanel
            lead={selectedLead}
            saving={false}
            calling={false}
            isMobile={isMobile}
            onPatch={patchSelectedLead}
            onCall={async () => {
              if (!selectedLead.contact?.phone) return
              await fetch('/api/calls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to_phone: selectedLead.contact.phone, contact_id: selectedLead.contact?.id || null, lead_id: selectedLead.intake_type === 'job_application' ? null : selectedLead.id }),
              })
            }}
            onCompose={() => { setSelectedLead(null); setTimeout(() => replyInputRef.current?.focus(), 150) }}
            onEdit={() => router.push(`/dashboard/leads?lead=${selectedLead.id}`)}
            onClose={() => { setSelectedLead(null); setProfileError('') }}
            draft={leadPanelDraft}
            onDraftChange={setLeadPanelDraft}
          />
        )}
      </SlidePanel>

      <Modal isOpen={isDeleteOpen} onClose={() => !deleteLoading && setIsDeleteOpen(false)} size="sm" ariaLabel="Delete conversation">
        <ModalHeader
          title="Delete conversation?"
          description={activeThread ? `Permanently delete the full message history with ${activeThread.display_name}.` : undefined}
          onClose={() => !deleteLoading && setIsDeleteOpen(false)}
        />
        <ModalBody>
          <Notice variant="warning" title="This cannot be undone">
            This removes every inbound and outbound message in this phone conversation. It does not delete the contact.
          </Notice>
          {deleteError && <div role="alert" style={{ marginTop: spacing.md, color: colors.error, fontSize: typography.sizeSm }}>{deleteError}</div>}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsDeleteOpen(false)} disabled={deleteLoading}>Cancel</Button>
          <Button variant="destructive" onClick={() => void handleDeleteConversation()} disabled={deleteLoading || !activeThread}>
            {deleteLoading ? 'Deleting…' : 'Delete conversation'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Compose modal */}
      {isComposeOpen && (
        <ComposeModal onClose={() => setIsComposeOpen(false)} />
      )}
    </div>
  )
}

export default function InboxPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ fontSize: typography.sizeBase, color: colors.textMuted, fontFamily: typography.fontSans }}>
          Loading inbox...
        </p>
      </div>
    }>
      <InboxPageInner />
    </Suspense>
  )
}
