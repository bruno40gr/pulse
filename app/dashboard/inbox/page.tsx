'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { getActiveTenantId } from '@/lib/tenant'
import { Avatar, Button, Textarea, PageHeader } from '@/components/ui'
import ContactSlidePanel from '@/components/contacts/ContactSlidePanel'
import { colors, typography, spacing } from '@/lib/tokens'

interface Message {
  id: string
  body: string
  direction: 'inbound' | 'outbound'
  status: string
  created_at: string
  to_phone: string | null
  from_phone: string | null
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
}

function InboxPageInner() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThread, setActiveThread] = useState<Thread | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedContact, setSelectedContact] = useState<any>(null)
  const [tenantFields, setTenantFields] = useState<any[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [campaignContext, setCampaignContext] = useState<string | null>(null)
  const tenantId = getActiveTenantId()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const replyInputRef = useRef<HTMLTextAreaElement>(null)
  const searchParams = useSearchParams()
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
  }, [tenantId])

  useEffect(() => {
    if (!messagesEndRef.current) return
    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [activeThread?.thread_key, activeThread?.messages?.length])

  const handleViewProfile = async () => {
    if (!activeThread) return
    const data = await fetch(`/api/contacts/${activeThread.contact_id}`).then(r => r.json())
    if (data && !data.error) setSelectedContact(data)
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
      await fetch(`/api/inbox/reply?tenant=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: activeThread.contact_id,
          body: reply,
          to_phone: activeThread.other_phone,
        })
      })
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

  const unreadCount = threads.filter(t => t.has_unread).length

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '320px 1fr',
      height: 'calc(100vh - 0px)',
      overflow: 'hidden',
    }}>

      {/* LEFT — Thread list */}
      <div style={{ borderRight: `1px solid ${colors.border}`, overflowY: 'auto', background: colors.surface, display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: spacing['2xl'], borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
          <PageHeader
            title="Inbox"
            subtitle={loading ? 'Loading...' : unreadCount > 0
              ? `${unreadCount} ${unreadCount === 1 ? 'conversation needs' : 'conversations need'} attention`
              : 'All caught up'}
          />
        </div>

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
                onClick={() => setActiveThread(thread)}
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
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: colors.background }}>

          {/* Thread header */}
          <div style={{
            padding: `${spacing.lg} ${spacing['2xl']}`,
            borderBottom: `1px solid ${colors.border}`,
            background: colors.surface,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
              <Avatar
                firstName={activeThread.first_name || '?'}
                lastName={activeThread.last_name || '?'}
                size={40}
              />
              <div>
                <div style={{ fontSize: typography.sizeLg, fontWeight: typography.weightSemibold, color: colors.text, fontFamily: typography.fontSans }}>
                  {activeThread.display_name}
                </div>
                <div style={{ fontSize: typography.sizeSm, color: colors.textMuted, fontFamily: typography.fontSans }}>
                  Student: {activeThread.student_name} · {activeThread.other_phone}
                </div>
              </div>
            </div>
            <button
              onClick={handleViewProfile}
              style={{
                fontSize: typography.sizeSm,
                color: colors.teal,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: typography.fontSans,
                padding: 0,
              }}
            >
              View profile →
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: `${spacing['2xl']} ${spacing['3xl']}`, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {activeThread.messages
              .slice()
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              .map(msg => (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start' }}>
                  <div>
                    <div style={{
                      maxWidth: '360px',
                      padding: `${spacing.sm} ${spacing.md}`,
                      borderRadius: msg.direction === 'outbound' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: msg.direction === 'outbound' ? '#007AFF' : colors.surface,
                      color: msg.direction === 'outbound' ? 'white' : colors.text,
                      fontSize: typography.sizeBase,
                      fontFamily: typography.fontSans,
                      lineHeight: 1.5,
                      border: msg.direction === 'inbound' ? `1px solid ${colors.border}` : 'none',
                      wordBreak: 'break-word',
                    }}>
                      {msg.body}
                    </div>
                    <div style={{
                      fontSize: typography.sizeXs,
                      color: colors.textMuted,
                      fontFamily: typography.fontSans,
                      marginTop: '4px',
                      textAlign: msg.direction === 'outbound' ? 'right' : 'left',
                    }}>
                      {formatTime(msg.created_at)}
                      {msg.direction === 'outbound' && msg.status ? ` · ${msg.status}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply bar */}
          <div style={{
            padding: spacing['2xl'],
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
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
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.background }}>
          <p style={{ fontSize: typography.sizeBase, color: colors.textMuted, fontFamily: typography.fontSans }}>
            Select a conversation to read and reply.
          </p>
        </div>
      )}

      {/* Contact slide panel */}
      {selectedContact && (
        <ContactSlidePanel
          contact={selectedContact}
          tenantFields={tenantFields}
          onClose={() => setSelectedContact(null)}
          onUpdated={(updated) => setSelectedContact(updated)}
          onCompose={() => {
            setSelectedContact(null)
            setTimeout(() => replyInputRef.current?.focus(), 150)
          }}
        />
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
