'use client'

import { useState } from 'react'
import { Avatar, Button, PageHeader, Input, ResponsiveDataTable, StatusBadge, type DataTableColumn } from '@/components/ui'
import { ControlButton } from '@/components/ui/ControlButton'
import { accountStudents, type FamilyPreviewData } from '@/lib/academy-family-preview'
import { previewStudentName } from '@/lib/academy-student-preview'
import { colors, spacing, typography } from '@/lib/tokens'

type ContactRow = { id: string; accountId: string; name: string; child: boolean; email: string; programs: string; instructors: string; status: string }

export function ContactsTable({ data, search, onSearch, onOpen, onParent }: { data: FamilyPreviewData; search: string; onSearch: (value: string) => void; onOpen: (accountId: string, studentId?: string) => void; onParent: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const rows: ContactRow[] = data.accounts.flatMap(account => {
    const students = accountStudents(data, account)
    return [{ id: account.id, accountId: account.id, name: account.holderName, child: false, email: account.email, programs: students.flatMap(student => student.enrollments.map(enrollment => enrollment.program)).join(', '), instructors: [...new Set(students.flatMap(student => student.enrollments.map(enrollment => enrollment.teacher)))].join(', '), status: students.some(student => student.enrollments.length) ? 'Active' : 'Inactive' }, ...students.filter(student => student.id !== account.holderId).map(student => ({ id: student.id, accountId: account.id, name: previewStudentName(student), child: true, email: student.email || account.email, programs: student.enrollments.map(enrollment => enrollment.program).join(', '), instructors: [...new Set(student.enrollments.map(enrollment => enrollment.teacher))].join(', '), status: student.enrollments.length ? 'Active' : 'Inactive' }))]
  }).filter(row => `${row.name} ${row.email} ${row.programs}`.toLowerCase().includes(search.toLowerCase()))
  const columns: DataTableColumn<ContactRow, string>[] = [
    { id: 'name', header: 'Name', width: 'minmax(220px, 1.4fr)', render: row => <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, paddingLeft: row.child ? spacing.lg : 0 }}><Avatar firstName={row.name.split(' ')[0]} lastName={row.name.split(' ').slice(1).join(' ')} size={32} /><div><ControlButton kind="name" aria-label={row.child ? `Open ${row.name} family` : `Open ${data.accounts.find(account => account.id === row.accountId)?.name}`} onClick={() => onOpen(row.accountId, row.child ? row.id : undefined)}>{row.name}</ControlButton><div style={{ ...typography.bodySmall, color: colors.textSecondary }}>{row.child ? 'Student' : 'Account holder'}</div></div></div> },
    { id: 'status', header: 'Status', width: '120px', render: row => <StatusBadge status={row.status} /> },
    { id: 'contact', header: 'Contact', width: 'minmax(220px, 1.2fr)', render: row => row.email || '—' },
    { id: 'programs', header: 'Enrollments', width: 'minmax(180px, 1fr)', render: row => row.programs || '—' },
    { id: 'instructor', header: 'Instructor', width: 'minmax(180px, 1fr)', render: row => row.instructors || '—' },
  ]
  return <>
    <PageHeader title="Contacts" right={<Button variant="secondary" onClick={onParent}>Preview parent portal</Button>} />
    <div style={{ marginBottom: spacing.lg, maxWidth: 420 }}><Input type="search" aria-label="Search contacts" placeholder="Search contacts" value={search} onChange={event => onSearch(event.target.value)} /></div>
    <ResponsiveDataTable rows={rows} columns={columns} getRowKey={row => row.id} minDesktopWidth={1100} ariaLabel="Contacts" emptyContent="No contacts found." selection={{ selectedKeys: selected, allSelected: rows.length > 0 && rows.every(row => selected.has(row.id)), selectAllLabel: 'Select all contacts', getRowLabel: row => row.name, onToggle: row => setSelected(current => { const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next }), onToggleAll: () => setSelected(rows.every(row => selected.has(row.id)) ? new Set() : new Set(rows.map(row => row.id))) }} onRowClick={row => onOpen(row.accountId, row.child ? row.id : undefined)} />
  </>
}