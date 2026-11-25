'use client'


import { ControlButton } from '@/components/ui/ControlButton'
import { Button } from '@/components/ui/Button'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { colors, radius, shadows, typography } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'
import type { TaskPerson } from '@/lib/note-tasks'

export interface MentionMember {
  membership_id: string
  person_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
}

const NBSP = '\u00A0'

function displayName(p: MentionMember): string {
  return `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unnamed'
}

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  mentionMembershipIds?: string[]
  onMentionMembershipIdsChange?: (ids: string[]) => void
  placeholder?: string
  style?: React.CSSProperties
  taskMentions?: boolean
  highlightMentions?: boolean
  autoGrow?: boolean
  onRelatedPersonMention?: (person: TaskPerson) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  showMentionButton?: boolean
  renderActions?: (mentionButton: React.ReactNode) => React.ReactNode
}

export default function MentionTextarea({ value, onChange, mentionMembershipIds = [], onMentionMembershipIdsChange, placeholder, style, onKeyDown, taskMentions = false, highlightMentions = false, autoGrow = false, onRelatedPersonMention, showMentionButton = false, renderActions }: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const cursorRef = useRef(0)
  const selectedMentionTokensRef = useRef(new Map<string, string>())
  const [tenantId] = useState<string>(() => getActiveTenantId())
  const [open, setOpen] = useState(false)
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<MentionMember[]>([])
  const [relatedSuggestions, setRelatedSuggestions] = useState<TaskPerson[]>([])
  const [scrollTop, setScrollTop] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!autoGrow || !textarea) return
    const resize = () => {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight + textarea.offsetHeight - textarea.clientHeight}px`
    }
    resize()
    let width = textarea.getBoundingClientRect().width
    const observer = new ResizeObserver(() => {
      const nextWidth = textarea.getBoundingClientRect().width
      if (nextWidth !== width) {
        width = nextWidth
        resize()
      }
    })
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [autoGrow, value])

  const close = () => {
    setOpen(false)
    setMentionStart(null)
    setQuery('')
    setSuggestions([])
    setRelatedSuggestions([])
    setActiveIndex(0)
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const qs = query ? `?q=${encodeURIComponent(query)}&tenant=${tenantId}` : `?tenant=${tenantId}`
        const res = await fetch(`/api/staff/mention-directory${qs}`)
        const data = await res.json()
        let related: TaskPerson[] = []
        if (taskMentions && query.trim()) {
          const response = await fetch(`/api/notes/directory?tenant=${tenantId}&q=${encodeURIComponent(query)}`)
          if (response.ok) related = await response.json()
        }
        if (!cancelled) {
          setSuggestions((Array.isArray(data) ? data : []).slice(0, 8))
          setRelatedSuggestions(related.slice(0, 8))
          setActiveIndex(0)
        }
      } catch {
        if (!cancelled) setSuggestions([])
      }
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, query, tenantId, taskMentions])

  const detectMention = (val: string, cursor: number) => {
    const before = val.slice(0, cursor)
    const match = before.match(/@([A-Za-z0-9._-]*)$/)
    if (!match) {
      close()
      return
    }
    const atIndex = before.length - match[0].length
    const charBefore = before[atIndex - 1]
    if (charBefore && /[A-Za-z0-9]/.test(charBefore)) {
      close()
      return
    }
    setMentionStart(atIndex)
    setQuery(match[1])
    setOpen(true)
  }

  const select = (person: MentionMember) => {
    const start = mentionStart ?? 0
    const name = displayName(person).replace(/ /g, NBSP)
    const before = value.slice(0, start)
    const after = value.slice(cursorRef.current)
    const next = `${before}@${name} ${after}`
    selectedMentionTokensRef.current.set(person.membership_id, `@${name}`)
    onChange(next)
    onMentionMembershipIdsChange?.([...new Set([...mentionMembershipIds, person.membership_id])])
    const cursor = start + 1 + name.length + 1
    close()
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(cursor, cursor)
      }
    })
  }

  const startMention = () => {
    const el = textareaRef.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? start
    const prefix = start > 0 && !/\s/.test(value[start - 1]) ? ' @' : '@'
    const next = value.slice(0, start) + prefix + value.slice(end)
    const cursor = start + prefix.length
    cursorRef.current = cursor
    onChange(next)
    detectMention(next, cursor)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(cursor, cursor)
    })
  }

  const selectRelated = (person: TaskPerson) => {
    const start = mentionStart ?? 0
    const name = person.name.replace(/ /g, NBSP)
    onChange(`${value.slice(0, start)}@${name} ${value.slice(cursorRef.current)}`)
    onRelatedPersonMention?.(person)
    close()
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(start + name.length + 2, start + name.length + 2)
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target
    const val = el.value
    const cursor = el.selectionStart ?? val.length
    cursorRef.current = cursor
    onChange(val)
    if (onMentionMembershipIdsChange) {
      const visibleIds = mentionMembershipIds.filter((membershipId) => {
        const token = selectedMentionTokensRef.current.get(membershipId)
        return !token || val.includes(token)
      })
      if (visibleIds.length !== mentionMembershipIds.length) onMentionMembershipIdsChange(visibleIds)
    }
    detectMention(val, cursor)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const count = suggestions.length + relatedSuggestions.length
    if (open && count > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % count)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + count) % count)
        return
      }
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault()
        const index = activeIndex % count
        if (index < suggestions.length) select(suggestions[index])
        else selectRelated(relatedSuggestions[index - suggestions.length])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
    }
    onKeyDown?.(e)
  }

  const highlighted = highlightMentions && /@[\u00a0\p{L}\p{N}._-]+/u.test(value)
  const textStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'transparent', fontFamily: typography.fontSans, fontSize: typography.sizeBase, lineHeight: 1.5, letterSpacing: 'normal', wordSpacing: 'normal', textAlign: 'left', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', color: colors.text, padding: 0, ...style }
  return (
    <>
    <div style={{ position: 'relative' }}>
      {highlighted && <div aria-hidden="true" style={{ ...textStyle, position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
        <div style={{ color: 'transparent', transform: `translateY(-${scrollTop}px)` }}>{value.split(/(@[\u00a0\p{L}\p{N}._-]+)/gu).map((part, index) => part.startsWith('@') ? <span key={index} style={{ background: '#DBEAFE', borderRadius: 4 }}>{part}</span> : part)}</div>
      </div>}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
        onBlur={() => setTimeout(close, 150)}
        placeholder={placeholder}
        style={{ ...textStyle, position: 'relative', caretColor: colors.text, ...(autoGrow ? { overflowY: 'hidden', resize: 'none' } : {}) }}
      />
      {open && suggestions.length + relatedSuggestions.length > 0 && (
        <div
          role="group" aria-label="Mention suggestions"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 60,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            boxShadow: shadows.lg,
            maxHeight: 260,
            overflowY: 'auto',
            marginTop: 4,
            padding: 4,
          }}
        >
          {suggestions.map((person, i) => {
            const active = i === activeIndex
            const secondary = person.email || ''
            return (
              <ControlButton kind="row" selected={active}
                key={person.membership_id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                }}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => select(person)}
                style={{ width: '100%' }}
              >
                <span style={{ fontSize: typography.sizeBase, fontWeight: typography.weightMedium, color: colors.text }}>
                  @{displayName(person)}
                </span>
                {secondary && (
                  <span style={{ fontSize: typography.sizeXs, color: colors.textMuted, whiteSpace: 'nowrap' }}>
                    {secondary}
                  </span>
                )}
              </ControlButton>
            )
          })}
          {relatedSuggestions.map((person, index) => <ControlButton key={person.id} kind="row" selected={activeIndex === suggestions.length + index} type="button" style={{ width: '100%' }} onMouseDown={event => event.preventDefault()} onClick={() => selectRelated(person)}>@{person.name} · {person.kind === 'lead' ? 'Lead' : 'Contact'}</ControlButton>)}
        </div>
      )}
    </div>
    {showMentionButton && (renderActions ? renderActions(
      <Button type="button" variant="ghost" size="sm" onMouseDown={event => event.preventDefault()} onClick={startMention} aria-label="Mention staff">@ Mention</Button>
    ) : <Button type="button" variant="ghost" size="sm" onMouseDown={event => event.preventDefault()} onClick={startMention} aria-label="Mention staff">@ Mention</Button>)}
    </>
  )
}
