'use client'

import { useState } from 'react'
import { Button, EmptyState, FieldValue, SlidePanel, SlidePanelHeader, SurfacePanel } from '@/components/ui'
import { ControlButton } from '@/components/ui/ControlButton'
import { Disclosure } from '@/components/ui/Disclosure'
import PrototypeSmsConversation from '@/components/inbox/PrototypeSmsConversation'
import PrototypeEmailComposer, { type PrototypeEmailDraft } from '@/components/inbox/PrototypeEmailComposer'
import { initialMockTemplates } from '@/lib/prototype-messaging'
import { PROTOTYPE_EMAIL, type PrototypeThread } from '@/lib/conversations-prototype'
import { useIsMobile } from '@/lib/useMediaQuery'
import { colors, spacing, typography } from '@/lib/tokens'
import { formatMessageTimestamp } from '@/lib/message-timestamp'
import { formatScheduleDate } from '@/lib/academy-enrollment-schedule'
import type { WorkspaceSectionProps } from './WorkspaceSections'
import styles from './StudentWorkspace.module.css'

export function StudentCommunication({ account, students, location, channel, drafts, onDraft }: WorkspaceSectionProps) {
  const [composing, setComposing] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [mobileReader, setMobileReader] = useState(false)
  const mobile = useIsMobile()
  const [templates, setTemplates] = useState(initialMockTemplates)
  const key = `${account.id}:communication:${students.map(student => student.id).join(',')}`
  const emailDraft: PrototypeEmailDraft = { subject: drafts[`${key}:subject`] || '', html: drafts[`${key}:html`] || '' }
  const sms = drafts[`${key}:sms`] || ''
  const holder = students.find(student => student.id === account.holderId)
  const manager = students.flatMap(student => student.family).find(member => member.id === account.holderId)
  const selectedStudent = students.find(student => student.id === location.studentId)
  const person = selectedStudent ? { id: selectedStudent.id, name: `${selectedStudent.firstName} ${selectedStudent.lastName}`, email: selectedStudent.email, phone: selectedStudent.phone, student: selectedStudent.firstName } : { id: account.holderId, name: account.holderName, email: account.email, phone: holder?.phone || manager?.phone || '', student: students.map(student => student.firstName).join(', ') }
  const messages = students.flatMap(student => student.messages.map(message => ({ ...message, student }))).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  // Preview fixtures have no provider thread IDs: group only matching student + subject.
  const threads = [...new Set(messages.filter(message => message.channel === 'email').map(message => `${message.student.id}:${(message.subject || 'No subject').replace(/^(re:\s*)+/i, '').toLowerCase()}`))].map(id => {
    const entries = messages.filter(message => message.channel === 'email' && `${message.student.id}:${(message.subject || 'No subject').replace(/^(re:\s*)+/i, '').toLowerCase()}` === id)
    return { id, subject: entries[0].subject || 'No subject', messages: entries }
  }).sort((a, b) => b.messages.at(-1)!.timestamp.localeCompare(a.messages.at(-1)!.timestamp))
  const active = threads.find(thread => thread.id === selectedEmail) || threads[0]
  const smsThread: PrototypeThread = { id: `${key}:sms`, contactId: person.id, channel: 'sms', name: person.name, student: person.student, initials: person.name.split(' ').map(part => part[0]).join(''), email: person.email, phone: person.phone, stage: '', interest: '', nextAction: '', note: '', unread: false, messages: messages.filter(message => message.channel === 'sms').map(message => ({ id: `${message.student.id}:${message.id}`, channel: 'sms', direction: message.direction, body: message.text, timestamp: message.timestamp, time: formatMessageTimestamp(message.timestamp) })) }
  const replyKey = active ? `${key}:reply:${active.id}` : ''
  const replyDraft: PrototypeEmailDraft = { subject: drafts[`${replyKey}:subject`] || '', html: drafts[`${replyKey}:html`] || '' }
  function openComposer(reply: boolean) {
    if (reply && active) {
      if (!replyDraft.subject) onDraft(`${replyKey}:subject`, `Re: ${active.subject.replace(/^(re:\s*)+/i, '')}`)
      setReplyingTo(active.id)
      return
    }
    setComposing(true)
  }
  const inlineReply = active && replyingTo === active.id
  function composer(draft: PrototypeEmailDraft, draftKey: string, inline: boolean) {
    return <PrototypeEmailComposer name={person.name} email={person.email} student={person.student} draft={draft} onChange={value => { onDraft(`${draftKey}:subject`, value.subject); onDraft(`${draftKey}:html`, value.html) }} onSend={() => {}} signatureHtml="" senderName="Preview staff" disabled people={[person]} templates={templates} onCreateTemplate={template => setTemplates(current => [...current, template])} onCollapse={() => inline ? setReplyingTo(null) : setComposing(false)} onDiscard={() => {}} replying={inline} />
  }
  const conversation = <>
    {channel === 'sms' && <SurfacePanel appearance="flat" padding="0" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <PrototypeSmsConversation panelLayout thread={smsThread} mobile={mobile} draft={sms} onChange={value => onDraft(`${key}:sms`, value)} onSend={() => {}} sendDisabled />
    </SurfacePanel>}
    {channel === 'email' && <SurfacePanel appearance="flat" padding="0" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className={styles.emailBrowser} data-reader={mobileReader}>
        <aside aria-label="Email conversations" className={styles.emailList}>
          {threads.map(thread => { const latest = thread.messages.at(-1)!; return <ControlButton kind="row" key={thread.id} selected={active?.id === thread.id} aria-pressed={active?.id === thread.id} aria-label={`Read email: ${thread.subject}`} onClick={() => { setSelectedEmail(thread.id); setReplyingTo(null); setMobileReader(true) }} style={{ display: 'block', borderRadius: 0, borderBottom: `1px solid ${colors.borderLight}`, padding: spacing.lg }}>
            <div style={{ ...typography.bodySmall, color: colors.text, overflowWrap: 'anywhere' }}>{latest.direction === 'inbound' ? '↙' : '↗'} {latest.direction === 'inbound' ? person.email : PROTOTYPE_EMAIL}</div>
            <div style={{ ...typography.bodySmall, color: colors.text, marginTop: spacing.sm }}>{formatScheduleDate(latest.timestamp.slice(0, 10))}</div>
            <strong style={{ display: 'block', marginTop: spacing.md }}>{thread.subject}</strong><p className={styles.emailSnippet}>{latest.text}</p>
          </ControlButton> })}
          {!threads.length && <EmptyState title="No emails yet" />}
        </aside>
        <section aria-label="Email reader" className={styles.emailReader}>
          <div className={styles.emailBack}><Button variant="secondary" size="md" onClick={() => setMobileReader(false)}>Back to emails</Button></div>
          {active ? <>
            <header className={styles.toolbar} style={{ justifyContent: 'space-between', marginBottom: spacing.lg }}><h3 style={{ ...typography.h2, margin: 0 }}>{active.subject}</h3></header>
            {active.messages.map((message, index) => {
              const sender = message.direction === 'inbound' ? person.email : PROTOTYPE_EMAIL
              const header = <div className={styles.emailMessageHeader}><strong style={{ overflowWrap: 'anywhere' }}>{message.direction === 'inbound' ? '↙' : '↗'} {sender}</strong><span style={{ ...typography.bodySmall, color: colors.text }}>{formatMessageTimestamp(message.timestamp)}</span></div>
              const body = <div className={styles.emailMessageContent}><dl className={styles.emailMetadata}><dt>From</dt><dd>{sender}</dd><dt>To</dt><dd>{message.direction === 'inbound' ? PROTOTYPE_EMAIL : person.email}</dd></dl><p className={styles.emailMessageBody}>{message.text}</p></div>
              return index < active.messages.length - 1 ? <Disclosure key={message.id} summary={header} className={styles.emailMessage}>{body}</Disclosure> : <article key={message.id} className={styles.emailMessage}>{header}{body}</article>
            })}
            {inlineReply ? <section aria-label="Reply to email" className={styles.emailReply}>
              <div className={styles.emailMessageHeader}><h4>Reply to {person.name}</h4><Button variant="secondary" size="md" onClick={() => setReplyingTo(null)}>Close reply</Button></div>
              {composer(replyDraft, replyKey, true)}
            </section> : <Button variant="secondary" size="md" onClick={() => openComposer(true)}>{replyDraft.subject || replyDraft.html ? 'Continue reply' : 'Reply'}</Button>}
          </> : <EmptyState title="Select an email to read" />}
        </section>
      </div>
    </SurfacePanel>}
  </>
  const recipientDetails = <section aria-label={`Messaging ${person.name}`} style={{ flexShrink: 0, minWidth: 0 }}>
    <FieldValue style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.sm }}><strong>Messaging {person.name}</strong><span style={{ color: colors.textSecondary }}>{channel === 'sms' ? person.phone || 'No phone number on file' : person.email || 'No email address on file'}</span></FieldValue>
  </section>
  return <section aria-label="Communication" className={styles.communication}>
    {channel === 'email' && <header className={styles.communicationToolbar}>
      {recipientDetails}
      <Button variant="secondary" size="md" onClick={() => openComposer(false)}>{emailDraft.subject || emailDraft.html ? 'Continue draft' : 'New email'}</Button>
    </header>}
    {channel !== 'email' && recipientDetails}
    {conversation}
    <SlidePanel isOpen={composing} fullScreen ariaLabel="Email drafting workspace" onClose={() => setComposing(false)}>
      <SlidePanelHeader title="Draft email" subtitle={person.name} onBack={() => setComposing(false)} backLabel="Back to email conversation" onClose={() => setComposing(false)} />
      <div className={styles.communicationDraft} style={{ background: colors.surfaceMuted }}><div className={styles.communicationDraftInner}>
        <SurfacePanel appearance="flat" padding={spacing.lg}>{composer(emailDraft, key, false)}</SurfacePanel>
      </div></div>
    </SlidePanel>
  </section>
}