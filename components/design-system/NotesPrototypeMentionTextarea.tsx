'use client'

import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import { ControlButton } from '@/components/ui/ControlButton'
import { REVIEW_MENTIONS } from '@/lib/notes-follow-ups-prototype'
import { colors, radius, shadows, typography } from '@/lib/tokens'

/** Fictional directory only. Never invokes production mention or privacy APIs. */
export default function NotesPrototypeMentionTextarea({ value, onChange, placeholder, style, onKeyDown }: {
  value: string; onChange: (value: string) => void; placeholder?: string; style?: CSSProperties
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  mentionMembershipIds?: string[]; onMentionMembershipIdsChange?: (ids: string[]) => void
}) {
  const [cursor, setCursor] = useState(0)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const match = value.slice(0, cursor).match(/(?:^|\s)@([^@\n]*)$/)
  const suggestions = open && match ? REVIEW_MENTIONS.filter(person => person.label.toLowerCase().includes(match[1].toLowerCase())) : []
  const select = (person: typeof REVIEW_MENTIONS[number]) => {
    if (!match) return
    const start = cursor - match[1].length - 1
    onChange(`${value.slice(0, start)}@${person.label.replace(/ /g, '\u00a0')} ${value.slice(cursor)}`)
    setOpen(false)
  }
  return <div style={{ position: 'relative' }}>
    <textarea value={value} placeholder={placeholder} style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'transparent', fontFamily: typography.fontSans, color: colors.text, ...style }}
      onChange={event => { onChange(event.target.value); setCursor(event.target.selectionStart); setActive(0); setOpen(true) }}
      onBlur={() => setOpen(false)} onKeyDown={event => {
        if (suggestions.length && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
          event.preventDefault()
          if (event.key === 'Escape') setOpen(false)
          else if (event.key === 'Enter') select(suggestions[active % suggestions.length])
          else setActive(index => (index + (event.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length)
        } else onKeyDown?.(event)
      }} />
    {suggestions.length > 0 && <div role="group" aria-label="Mention suggestions" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, boxShadow: shadows.lg, padding: 4, maxHeight: 240, overflowY: 'auto' }}>
      {suggestions.map((person, index) => <ControlButton key={person.id} kind="row" type="button" selected={index === active} style={{ width: '100%' }} onMouseDown={event => event.preventDefault()} onClick={() => select(person)}>@{person.label} · {person.kind}</ControlButton>)}
    </div>}
  </div>
}