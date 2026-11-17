'use client'

import { useMemo, useState } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PersonName } from '@/beta-source/components/ui/PersonName'
import { DenseSectionPanel } from '@/beta-source/components/ui/DenseSectionPanel'
import { SurfacePanel } from '@/beta-source/components/ui/SurfacePanel'
import { StatusBadge } from '@/beta-source/components/ui/StatusBadge'
import { DetailField } from '@/beta-source/components/ui/DetailField'
import { FieldGrid } from '@/beta-source/components/ui/FieldGrid'
import { EmptyState } from '@/beta-source/components/ui/EmptyState'
import { ResponsiveDataTable, type DataTableColumn } from '@/components/ui/DataGridTable'
import { colors, spacing, typography } from '@/lib/tokens'
import { formatScheduleDate, formatScheduleTime } from '@/beta-source/lib/academy-enrollment-schedule'
import { previewStudentName } from '@/beta-source/lib/academy-student-preview'
import type { FamilyPreviewData } from '@/beta-source/lib/academy-family-preview'

/**
 * Prototype skeleton only. Contacts as the page you work in, search as the filter,
 * and the contact record as a full page instead of a slide panel. Actions report
 * where they would go; nothing is wired and nothing is saved.
 */
type Row = { id: string; name: string; family: string; programs: string; next: string; teacher: string; room: string; lessonId: string }

export default function ContactPagePrototype({ data }: { data: FamilyPreviewData }) {
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const rows = useMemo<Row[]>(() => data.students.map(student => {
    const account = data.accounts.find(item => item.studentIds.includes(student.id))
    const lesson = data.lessons
      .filter(item => student.enrollments.some(enrollment => enrollment.id === item.enrollmentId))
      .sort((left, right) => `${left.date}${left.time}`.localeCompare(`${right.date}${right.time}`))[0]
    return {
      id: student.id,
      name: previewStudentName(student),
      family: account?.holderName || 'No account',
      programs: student.enrollments.map(item => item.program).filter(Boolean).slice(0, 2).join(' · ') || 'No program',
      next: lesson ? `${formatScheduleDate(lesson.date)} · ${formatScheduleTime(lesson.time)}` : 'Nothing scheduled',
      teacher: lesson?.teacher || student.enrollments[0]?.teacher || 'Not assigned',
      room: lesson?.room || 'Not assigned',
      lessonId: lesson?.id || '',
    }
  }), [data])

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(row => `${row.name} ${row.family} ${row.programs}`.toLowerCase().includes(term))
  }, [query, rows])

  const open = rows.find(row => row.id === openId)
  const student = data.students.find(item => item.id === openId)

  if (open && student) return <PageContainer>
    <PageHeader
      title={open.name}
      subtitle={`${open.family} · ${open.programs}`}
      onBack={() => { setOpenId(null); setNote('') }}
      right={<div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={() => setNote(`Would open ?screen=calendar&student=${open.id}`)}>Open calendar</Button>
        <Button onClick={() => setNote(`Would open a message to ${open.family}`)}>Message family</Button>
      </div>} />
    {note && <p role="status" style={{ ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.lg }}>{note}</p>}
    <div style={{ display: 'grid', gap: spacing.lg, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start' }}>
      <DenseSectionPanel title="Next lesson" headingLevel="h2" actions={<div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button size="sm" variant="secondary" onClick={() => setNote(`Would open ?screen=calendar&reschedule=${open.lessonId || '<lesson>'}`)}>Reschedule</Button>
        <Button size="sm" variant="destructive" onClick={() => setNote(`Would open the cancel dialog for ${open.name}: reason, make-up credit, charge`)}>Cancel</Button>
      </div>}>
        <div style={{ marginBottom: spacing.md }}>
          <FieldGrid>
            <DetailField label="When" value={open.next} />
            <DetailField label="Teacher" value={open.teacher} />
            <DetailField label="Room" value={open.room} />
            <DetailField label="Program" value={open.programs} />
          </FieldGrid>
        </div>
        <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: 0 }}>
          No calendar is embedded here. Both actions hand off to the calendar page.
        </p>
      </DenseSectionPanel>
      <DenseSectionPanel title="Recent notes" headingLevel="h2">
        <div style={{ display: 'grid', gap: spacing.sm }}>
          {student.notes.length
            ? student.notes.slice(0, 3).map(item => <p key={item.id} style={{ ...typography.bodySmall, margin: 0 }}>{item.text}</p>)
            : <EmptyState variant="embedded" density="compact" title="No notes yet" description="Notes belong on the record, not in a panel." />}
        </div>
      </DenseSectionPanel>
    </div>
  </PageContainer>

  const columns: DataTableColumn<Row, string>[] = [
    { id: 'name', header: 'Person', width: '1.4fr', render: row => <PersonName as="button" onClick={() => { setOpenId(row.id); setNote('') }}>{row.name}</PersonName> },
    { id: 'family', header: 'Family', width: '1.1fr', render: row => row.family },
    { id: 'programs', header: 'Programs', width: '1.2fr', render: row => row.programs },
    { id: 'next', header: 'Next lesson', width: '1.1fr', render: row => row.next },
    { id: 'status', header: 'Status', width: '0.7fr', render: () => <StatusBadge status="active" label="Active" /> },
  ]

  return <PageContainer>
    <PageHeader title="Contacts" subtitle={`${matches.length} of ${rows.length} people · prototype`} />
    <div style={{ display: 'grid', gap: spacing.lg }}>
      <div style={{ maxWidth: 420 }}>
        <Input label="Search people" placeholder="Name, family or program" value={query} onChange={event => setQuery(event.target.value)} />
      </div>
      <ResponsiveDataTable
        rows={matches}
        columns={columns}
        getRowKey={row => row.id}
        ariaLabel="Contacts"
        minDesktopWidth={720}
        emptyContent={<EmptyState title="No match" description="Search by name, family or program." />} />
      <SurfacePanel appearance="flat">
        <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: 0 }}>
          Prototype: the page is the list and search is the filter. Opening a person leaves this page entirely.
          Where to next — does the record need billing, messages or attendance before it earns being a page?
        </p>
      </SurfacePanel>
    </div>
  </PageContainer>
}

