'use client'
import { TaskCompletionButton } from './TaskCompletionButton'
import { DenseSectionPanel } from './DenseSectionPanel'
import { FieldLabel } from './FieldLabel'
import { SectionTitle } from './SectionTitle'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { GraduationCap, Link2, Shield, StickyNote, X } from 'lucide-react'
import { Button, Input, Textarea } from '@/beta-source/components/ui'
import MentionTextarea, { type MentionMember } from '@/beta-source/components/notes/MentionTextarea'
import { colors, typography, radius, spacing } from '@/beta-source/lib/tokens'
import { getNoteAuthorInitials } from '@/beta-source/lib/note-author'
import { Avatar } from './Avatar'
import { getStaffAvatarUrl } from '@/beta-source/lib/staff-avatars'
import { getActiveTenantId } from '@/beta-source/lib/tenant'
import { NoteLinkPreview } from './NoteLinkPreview'
import { CURRICULUM_LINK, noteAttachmentLabel, toNoteAttachment, type NoteAttachment } from '@/beta-source/lib/note-links'
import styles from './NotesSection.module.css'

interface NoteEntry {
  id?: string
  text: string
  timestamp: string
  actor_name?: string | null
  actor_avatar_url?: string | null
  editable?: boolean
  edited_at?: string | null
  completed_at?: string | null
  links?: NoteAttachment[]
  /** Per-note card background (e.g. a sticky note keeps its own colour). */
  background?: string
  /** Only task entries (sticky notes, or written notes that mention staff) show the completion toggle. */
  task?: boolean
  /** Marks a note that originated in the sticky-notes board. */
  sticky?: boolean
}

interface NotesSectionProps {
  title: string
  notes: NoteEntry[]
  avatarInitial: string
  avatarBg: string
  cardBg: string
  /** Extra styling for each saved note card (e.g. sticky border/shadow). */
  cardStyle?: CSSProperties
  addLabel?: string
  saving?: boolean
  signifierLabel?: string
  helperText?: string
  showHeader?: boolean
  /** Optional section toolbar; replaces the built-in add-note control. */
  renderToolbar?: (onAdd: () => void, composing: boolean) => React.ReactNode
  /** Card header actions and a fixed composer above independently scrolling history. */
  panel?: boolean
  autoSaveOnBlur?: boolean
  draft?: string
  onDraftChange?: (draft: string) => void
  mentionsEnabled?: boolean
  /** Optional directory for @mentions; when provided it is used instead of the live member lookup. */
  mentionMembers?: MentionMember[]
  /** Show the "attach link" controls (video / PDF / media previews). */
  attachmentsEnabled?: boolean
  onSave: (text: string, mentionMembershipIds: string[], links?: NoteAttachment[]) => boolean | void | Promise<boolean | void>
  onToggleComplete?: (index: number) => void | Promise<void>
  onEdit?: (entry: NoteEntry, text: string) => boolean | void | Promise<boolean | void>
}

function formatNoteTimestamp(ts: string) {
  const d = new Date(ts)
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
}

export function NotesSection({
  title,
  notes,
  avatarBg,
  cardBg,
  cardStyle,
  addLabel = 'Add a note',
  saving = false,
  signifierLabel,
  helperText,
  showHeader = true,
  renderToolbar,
  panel = false,
  autoSaveOnBlur = false,
  draft,
  onDraftChange,
  mentionsEnabled = false,
  mentionMembers,
  attachmentsEnabled = false,
  onSave,
  onToggleComplete,
  onEdit,
}: NotesSectionProps) {
  const [showInput, setShowInput] = useState(false)
  const [input, setInput] = useState(draft || '')
  const [mentionMembershipIds, setMentionMembershipIds] = useState<string[]>([])
  const [links, setLinks] = useState<NoteAttachment[]>([])
  const [linkInput, setLinkInput] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const savingRef = useRef(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const editSavingRef = useRef(false)

  const saveEdit = async (entry: NoteEntry) => {
    if (!onEdit || editSavingRef.current || !editText.trim()) return
    editSavingRef.current = true
    setEditSaving(true)
    setEditError('')
    try {
      const saved = await onEdit(entry, editText.trim())
      if (saved !== false) setEditingId(null)
      else setEditError('Could not save the note. Your changes are retained.')
    } catch { setEditError('Could not save the note. Your changes are retained.') }
    finally { editSavingRef.current = false; setEditSaving(false) }
  }

  useEffect(() => {
    if (typeof draft === 'string') {
      setInput(draft)
      if (draft) setShowInput(true)
    }
  }, [draft])

  const updateInput = (value: string) => {
    setInput(value)
    onDraftChange?.(value)
  }

  const handleSave = async () => {
    if (savingRef.current) return
    if (!input.trim()) return
    savingRef.current = true
    const note = input.trim()
    try {
      const saved = await onSave(note, mentionMembershipIds, links)
      if (saved !== false) {
        updateInput('')
        setMentionMembershipIds([])
        setLinks([])
        setLinkInput('')
        setShowLinkInput(false)
        setShowInput(false)
      }
    } finally {
      savingRef.current = false
    }
  }

  const addLink = () => {
    const attachment = toNoteAttachment(linkInput)
    if (!attachment.url) return
    setLinks(current => current.some(item => item.url === attachment.url) ? current : [...current, attachment])
    setLinkInput('')
    setShowLinkInput(false)
  }

  const addCurriculum = () => {
    setLinks(current => current.some(item => item.url === CURRICULUM_LINK.url) ? current : [...current, CURRICULUM_LINK])
  }

  const content = (
    <div style={panel ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } : undefined}>
      {renderToolbar?.(() => setShowInput(true), showInput)}
      {showHeader && !panel && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
              <SectionTitle as="h3" variant="card">
                {title}
              </SectionTitle>
              {signifierLabel && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                borderRadius: radius.full,
                background: '#E5EEF8',
                border: '1px solid #B9D0EA',
                color: '#1E3A5F',
                fontSize: typography.sizeXs,
                fontWeight: 700,
                letterSpacing: '0.03em',
                fontFamily: typography.fontSans,
              }}>
                <Shield size={12} strokeWidth={2} />
                {signifierLabel}
              </span>
              )}
            </div>
            {!showInput && !renderToolbar && (
              <Button variant="secondary" size="sm"
                type="button"
                onClick={() => setShowInput(true)}
                style={{ whiteSpace: 'nowrap' }}
              >
                <span style={{ fontSize: typography.sizeMd, lineHeight: 1 }}>+</span>
                {addLabel}
              </Button>
            )}
          </div>
          {helperText && (
            <div style={{ marginTop: '4px', fontSize: typography.sizeSm, color: colors.textMuted, fontFamily: typography.fontSans }}>
              {helperText}
            </div>
          )}
        </div>
      )}

      <div style={panel ? { flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' } : undefined} aria-label="Note history">
      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
          {notes.map((entry, i) => (
            <div key={entry.id || `${entry.timestamp}-${i}`} style={{
              display: 'flex',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: radius.lg,
              background: entry.background || cardBg,
              border: `1px solid ${colors.borderLight}`,
              ...cardStyle,
            }}>
              <div style={{
                width: '28px', height: '28px',
                borderRadius: '50%',
                background: avatarBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: typography.sizeSm,
                fontWeight: 600,
                color: 'white',
                flexShrink: 0,
                marginTop: '1px',
              }} title={entry.actor_name || 'Author not recorded'}>
                {(entry.actor_avatar_url || getStaffAvatarUrl(getActiveTenantId(), entry.actor_name))
                  ? <Avatar firstName={entry.actor_name?.split(' ')[0] || ''} lastName={entry.actor_name?.split(' ').slice(1).join(' ') || ''} size={28} src={entry.actor_avatar_url || getStaffAvatarUrl(getActiveTenantId(), entry.actor_name)} style={{ background: avatarBg }} />
                  : getNoteAuthorInitials(entry.actor_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FieldLabel style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
                  {entry.sticky && <><StickyNote size={12} aria-hidden="true" />Sticky note · </>}
                  {entry.actor_name ? `${entry.actor_name} · ${formatNoteTimestamp(entry.timestamp)}` : formatNoteTimestamp(entry.timestamp)}
                  {entry.edited_at ? ` · Edited ${formatNoteTimestamp(entry.edited_at)}` : ''}
                </FieldLabel>
                {editingId === entry.id ? <div>
                  <Textarea aria-label="Edit note" className={styles.composer} value={editText} maxLength={12000} disabled={editSaving || saving} onChange={event => setEditText(event.target.value)} />
                  {editError && <p role="alert">{editError}</p>}
                  <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end', marginTop: spacing.sm }}>
                    <Button type="button" variant="ghost" size="sm" disabled={editSaving || saving} onClick={() => setEditingId(null)}>Cancel edit</Button>
                    <Button type="button" variant="primary" size="sm" disabled={editSaving || saving || !editText.trim()} onClick={() => void saveEdit(entry)}>{editSaving ? 'Saving…' : 'Save changes'}</Button>
                  </div>
                </div> : <div style={{ fontSize: typography.sizeBase, color: entry.completed_at ? colors.textSecondary : colors.text, lineHeight: 1.5, textDecoration: entry.completed_at ? 'line-through' : 'none', whiteSpace: 'pre-wrap' }}>{entry.text.replace(/\u00A0/g, ' ')}</div>}
                {entry.links && entry.links.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, marginTop: spacing.sm }}>{entry.links.map((link, linkIndex) => <NoteLinkPreview key={`${link.url}-${linkIndex}`} link={link} />)}</div>}
              </div>
              {onEdit && entry.id && entry.editable === true && editingId !== entry.id && <Button type="button" variant="ghost" size="sm" disabled={saving || editSaving || editingId !== null} onClick={() => { setEditingId(entry.id!); setEditText(entry.text); setEditError('') }}>Edit</Button>}
              {onToggleComplete && entry.task && (
                <TaskCompletionButton completed={Boolean(entry.completed_at)}
                  type="button"
                  onClick={() => onToggleComplete(i)}
                  title={entry.completed_at ? 'Mark note as open' : 'Mark note as done'}
                  aria-label={entry.completed_at ? 'Mark note as open' : 'Mark note as done'}
                >
                </TaskCompletionButton>
              )}
            </div>
          ))}
        </div>
      )}
      {panel && notes.length === 0 && <p style={{ ...typography.bodySmall, color: colors.textMuted }}>No notes yet.</p>}
      </div>

      {!showInput && !showHeader && !panel && !renderToolbar ? (
        <Button variant="secondary" size="sm"
          onClick={() => setShowInput(true)}
          style={{ width: '100%' }}
        >
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px', height: '18px',
            borderRadius: '50%',
            background: '#E5E7EB',
            color: colors.textMuted,
            fontSize: typography.sizeBase,
            lineHeight: 1,
          }}>+</span>
          {addLabel}
        </Button>
      ) : showInput ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, ...(panel ? { order: -1, flexShrink: 0, marginBottom: spacing.md } : {}) }}>
          {mentionsEnabled ? (
            <MentionTextarea
              value={input}
              onChange={updateInput}
              mentionMembershipIds={mentionMembershipIds}
              onMentionMembershipIdsChange={setMentionMembershipIds}
              members={mentionMembers}
              placeholder="Write a note..."
              style={{ minHeight: '100px', border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: spacing.md, fontSize: typography.sizeBase, fontFamily: typography.fontSans, resize: 'vertical' }}
            />
          ) : (
            <Textarea
              value={input}
              onChange={e => updateInput(e.target.value)}
              onBlur={() => {
                if (autoSaveOnBlur) void handleSave()
              }}
              placeholder="Write a note..."
              className={styles.composer}
              style={{ minHeight: '100px', border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: spacing.md, fontSize: typography.sizeBase, fontFamily: typography.fontSans, resize: 'vertical' }}
            />
          )}
          {attachmentsEnabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              {links.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
                {links.map((link, linkIndex) => <span key={`${link.url}-${linkIndex}`} style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, padding: `${spacing.xs} ${spacing.sm}`, borderRadius: radius.full, border: `1px solid ${colors.border}`, background: colors.surfaceMuted, ...typography.helper, color: colors.text }}>
                  <Link2 size={12} aria-hidden="true" />{noteAttachmentLabel(link)}
                  <button type="button" aria-label={`Remove attachment ${noteAttachmentLabel(link)}`} onClick={() => setLinks(current => current.filter(item => item.url !== link.url))} style={{ display: 'inline-flex', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: colors.textMuted }}><X size={12} aria-hidden="true" /></button>
                </span>)}
              </div>}
              {showLinkInput ? (
                <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}><Input aria-label="Link URL" placeholder="Paste a link (YouTube, PDF, image…)" value={linkInput} onChange={event => setLinkInput(event.target.value)} /></div>
                  <Button type="button" variant="secondary" size="sm" onClick={addLink} disabled={!linkInput.trim()}>Add link</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setShowLinkInput(false); setLinkInput('') }}>Cancel</Button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowLinkInput(true)}><Link2 size={14} aria-hidden="true" />Attach link</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={addCurriculum}><GraduationCap size={14} aria-hidden="true" />Curriculum</Button>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onMouseDown={(event) => event.preventDefault()} onClick={() => { setShowInput(false); updateInput(''); setMentionMembershipIds([]); setLinks([]); setLinkInput(''); setShowLinkInput(false) }}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={saving}>{saving ? 'Saving...' : 'Save note'}</Button>
          </div>
        </div>
      ) : null}
    </div>
  )

  if (!panel) return content

  return (
    <DenseSectionPanel title={title}
      actions={!showInput && !renderToolbar ? <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => setShowInput(true)}>{addLabel}</Button> : undefined}
      style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
      contentStyle={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {content}
    </DenseSectionPanel>
  )
}