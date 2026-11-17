'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/Input'
import { colors, radius, shadows, spacing, typography } from '@/lib/tokens'
import { previewStudentName } from '@/beta-source/lib/academy-student-preview'
import type { FamilyPreviewData } from '@/beta-source/lib/academy-family-preview'

/**
 * Jump to a person, not to a filter: admin works from the calendar, so finding a
 * contact should be a search here rather than a trip to the contacts list.
 */
export default function CalendarJumpTo({ data }: { data: FamilyPreviewData }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (term.length < 2) return []
    return data.students
      .filter(student => `${student.firstName} ${student.lastName}`.toLowerCase().includes(term) || (student.email || '').toLowerCase().includes(term))
      .slice(0, 6)
      .flatMap(student => {
        const account = data.accounts.find(item => item.studentIds.includes(student.id))
        if (!account) return []
        return [{ id: student.id, name: previewStudentName(student), accountId: account.id, programs: student.enrollments.map(item => item.program).filter(Boolean).slice(0, 2).join(' · ') }]
      })
  }, [data, query])
  const go = (studentId: string, accountId: string) => {
    window.location.assign(`/odeon-demo?view=quick&account=${encodeURIComponent(accountId)}&student=${encodeURIComponent(studentId)}`)
  }
  return <div style={{ position: 'relative', minWidth: 220 }}>
    <Input label="Jump to a person" aria-label="Jump to a person" placeholder="Student or contact" value={query}
      onChange={event => { setQuery(event.target.value); setOpen(true) }}
      onFocus={() => setOpen(true)}
      onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); setQuery('') } }} />
    {open && matches.length > 0 && <div role="listbox" aria-label="People" style={{ position: 'absolute', zIndex: 40, top: '100%', left: 0, right: 0, marginTop: 4, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, boxShadow: shadows.md, maxHeight: 260, overflowY: 'auto' }}>
      {matches.map(match => <button key={match.id} type="button" role="option" aria-selected={false} onClick={() => go(match.id, match.accountId)}
        style={{ display: 'grid', gap: 2, width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: `${spacing.sm} ${spacing.md}`, cursor: 'pointer', font: 'inherit' }}>
        <strong style={{ ...typography.bodySmall, color: colors.text }}>{match.name}</strong>
        {match.programs && <span style={{ ...typography.helper, color: colors.textSecondary }}>{match.programs}</span>}
      </button>)}
    </div>}
    {open && query.trim().length >= 2 && matches.length === 0 && <p role="status" style={{ position: 'absolute', zIndex: 40, top: '100%', left: 0, marginTop: 4, padding: `${spacing.sm} ${spacing.md}`, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, ...typography.helper, color: colors.textSecondary }}>No match</p>}
  </div>
}
