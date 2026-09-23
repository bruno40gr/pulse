'use client'

import { useEffect, useRef, useState } from 'react'
import { colors, radius, shadows, spacing, typography } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'

interface Person {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
}

const NBSP = '\u00A0'

function displayName(p: Person): string {
  return `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unnamed'
}

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: React.CSSProperties
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

export default function MentionTextarea({ value, onChange, placeholder, style, onKeyDown }: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const cursorRef = useRef(0)
  const [tenantId] = useState<string>(() => getActiveTenantId())
  const [open, setOpen] = useState(false)
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Person[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  const close = () => {
    setOpen(false)
    setMentionStart(null)
    setQuery('')
    setSuggestions([])
    setActiveIndex(0)
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const qs = query ? `?q=${encodeURIComponent(query)}&tenant=${tenantId}` : `?tenant=${tenantId}`
        const res = await fetch(`/api/recipient-search${qs}`)
        const data = await res.json()
        if (!cancelled) {
          setSuggestions((Array.isArray(data) ? data : []).slice(0, 8))
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
  }, [open, query, tenantId])

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

  const select = (person: Person) => {
    const start = mentionStart ?? 0
    const name = displayName(person).replace(/ /g, NBSP)
    const before = value.slice(0, start)
    const after = value.slice(cursorRef.current)
    const next = `${before}@${name} ${after}`
    onChange(next)
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

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target
    const val = el.value
    const cursor = el.selectionStart ?? val.length
    cursorRef.current = cursor
    onChange(val)
    detectMention(val, cursor)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % suggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault()
        select(suggestions[activeIndex])
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

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(close, 150)}
        placeholder={placeholder}
        style={{
          width: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: typography.fontSans,
          color: colors.text,
          ...style,
        }}
      />
      {open && suggestions.length > 0 && (
        <div
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
            const secondary = person.phone || person.email || ''
            return (
              <button
                key={person.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  select(person)
                }}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing.md,
                  width: '100%',
                  textAlign: 'left',
                  padding: `${spacing.sm} ${spacing.md}`,
                  border: 'none',
                  borderRadius: radius.md,
                  background: active ? colors.surfaceMuted : 'transparent',
                  cursor: 'pointer',
                  fontFamily: typography.fontSans,
                }}
              >
                <span style={{ fontSize: typography.sizeBase, fontWeight: typography.weightMedium, color: colors.text }}>
                  @{displayName(person)}
                </span>
                {secondary && (
                  <span style={{ fontSize: typography.sizeXs, color: colors.textMuted, whiteSpace: 'nowrap' }}>
                    {secondary}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
