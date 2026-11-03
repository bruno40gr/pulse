'use client'

import { useState } from 'react'
import { SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { Button, Input, Select, Textarea, PageHeader, SlidePanel, SlidePanelHeader, Notice, FieldGrid, Badge } from '@/components/ui'
import { ResponsiveDataTable, type DataTableColumn, type DataTableSort } from '@/components/ui/DataGridTable'
import { TablePersonViewToggle } from '@/components/ui/TablePersonViewToggle'
import { TablePersonName } from '@/components/ui/TablePersonName'
import { PersonName } from '@/components/ui/PersonName'
import { TableDisplayControls } from '@/components/ui/TableDisplayControls'
import { TablePagination } from '@/components/ui/TablePagination'
import { TableDiscoveryToolbar, TableContextActionBar, TableResultCount, TableResultsSlot } from '@/components/ui/TableWorkspaceControls'
import { colors, spacing, typography } from '@/lib/tokens'
import { formatPhoneNumber } from '@/lib/phone'
import { smsDestination } from '@/lib/communication-recipients'

const filterDefinitions = [
  { key: 'service', label: 'Service type', values: ['Private lessons', 'Group classes'] },
  { key: 'band', label: 'Band / class name', values: ['None', 'Tuesday ensemble', 'Saturday band'] },
  { key: 'appointment', label: 'Appointment / class name', values: ['Piano', 'Voice', 'Guitar', 'Drums'] },
  { key: 'instructor', label: 'Instructor / staff', values: ['Alex Rivera', 'Jamie Chen', 'Taylor Reed'] },
  { key: 'plan', label: 'Plan name', values: ['Weekly', 'Fortnightly'] },
  { key: 'status', label: 'Status', values: ['Active', 'Inactive', 'Member'] },
] as const
type FilterKey = typeof filterDefinitions[number]['key']
type Filters = Partial<Record<FilterKey, string>>
type Person = { id: string; name: string; role: string; phone: string; email: string; family: number } & Record<FilterKey, string>
type SortKey = 'name' | 'status' | 'instructor'

const names = ['Olivia Morgan', 'Liam Chen', 'Ava Patel', 'Noah Williams', 'Sophia Garcia', 'Ethan Brooks', 'Mia Wilson', 'Lucas Kim', 'Isabella Reed', 'Oliver Davis', 'Amelia Hayes', 'Elijah Scott']
const people: Person[] = names.map((name, index) => ({
  id: `sample-${index}`, name, role: index % 3 === 0 ? 'Account holder' : 'Student', family: Math.floor(index / 3),
  phone: index < 3 ? '+1 (202) 555-0100' : index === 7 ? '' : `+1 (202) 555-${String(100 + index).padStart(4, '0')}`,
  email: index < 3 ? 'morgan@example.invalid' : index === 8 ? '' : `${name.split(' ')[0].toLowerCase()}@example.invalid`,
  service: index % 2 ? 'Group classes' : 'Private lessons', band: index % 2 ? 'Tuesday ensemble' : 'None',
  appointment: ['Piano', 'Voice', 'Guitar', 'Drums'][index % 4], instructor: ['Alex Rivera', 'Jamie Chen', 'Taylor Reed'][index % 3],
  plan: index % 2 ? 'Fortnightly' : 'Weekly', status: ['Active', 'Active', 'Member', 'Inactive'][index % 4],
}))
const schema = { columnIds: ['name', 'status', 'phone', 'email', 'instructor'], defaultColumns: ['name', 'status', 'phone', 'email', 'instructor'], requiredColumns: ['name'], storagePrefix: 'pulse_contacts_shell_only' }

export default function ContactsTablePrototype() {
  const [draftQuery, setDraftQuery] = useState('')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Filters>({})
  const [applied, setApplied] = useState<Filters>({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [view, setView] = useState<'students' | 'families'>('students')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<DataTableSort<SortKey>>({ key: 'name', direction: 'asc' })
  const [page, setPage] = useState(1)
  const [preferences, setPreferences] = useState<{ columns: string[]; density: 'comfortable' | 'compact' }>({ columns: [...schema.defaultColumns], density: 'comfortable' })
  const [panel, setPanel] = useState<string | null>(null)
  const [detail, setDetail] = useState<Person | null>(null)
  const [body, setBody] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const matching = people.filter(person => person.name.toLowerCase().includes(query.toLowerCase()) && filterDefinitions.every(({ key }) => !applied[key] || person[key] === applied[key]))
  const ordered = [...matching].sort((a, b) => a[sort.key].localeCompare(b[sort.key]) * (sort.direction === 'asc' ? 1 : -1))
  const groups = view === 'students'
    ? ordered.map(person => ({ id: person.id, parent: person, members: [] as Person[] }))
    : [...new Set(ordered.map(person => person.family))].map(family => {
      const members = people.filter(person => person.family === family)
      return { id: `family-${family}`, parent: members[0], members: members.slice(1) }
    })
  const pageCount = Math.max(1, Math.ceil(groups.length / 5))
  const currentPage = Math.min(page, pageCount)
  const visible = groups.slice((currentPage - 1) * 5, currentPage * 5)
  const matchingIds = new Set(matching.map(person => person.id))
  const visiblePeople = visible.flatMap(group => [group.parent, ...group.members]).filter(person => matchingIds.has(person.id))
  const chosen = people.filter(person => selected.has(person.id))
  const outside = chosen.filter(person => !matchingIds.has(person.id)).length
  const offPage = chosen.filter(person => matchingIds.has(person.id) && !visiblePeople.some(row => row.id === person.id)).length
  const toggle = (id: string) => setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const allVisible = visiblePeople.length > 0 && visiblePeople.every(person => selected.has(person.id))
  const openPanel = (name: string) => { setPanel(name); setMessage(''); setBody(''); setSubject('') }
  // Sample destinations are already account-holder-routed. Production policy is deliberately not reimplemented here.
  const recipients = (channel: 'Text' | 'Email') => [...new Set(chosen.map(person => channel === 'Text' ? smsDestination(person.phone) : person.email.trim().toLowerCase()).filter(Boolean))]
  const columns: DataTableColumn<Person, SortKey>[] = [
    { id: 'name', header: 'Name', width: 'minmax(220px, 1.4fr)', sortable: true, sortKey: 'name', render: (person: Person) => <div><TablePersonName onOpen={() => { setDetail(person); openPanel('Contact details') }}>{person.name}</TablePersonName><div style={{ color: colors.textSecondary, fontSize: typography.sizeSm }}>{person.role}</div></div> },
    { id: 'status', header: 'Status', width: '110px', sortable: true, sortKey: 'status', render: (person: Person) => <Badge size="sm">{person.status}</Badge> },
    { id: 'phone', header: 'Phone', width: '170px', render: (person: Person) => formatPhoneNumber(person.phone) || 'No phone' },
    { id: 'email', header: 'Email', width: '230px', render: (person: Person) => person.email || 'No email' },
    { id: 'instructor', header: 'Instructor', width: '170px', sortable: true, sortKey: 'instructor', render: (person: Person) => <PersonName roleVariant="instructor">{person.instructor}</PersonName> },
  ].filter(column => preferences.columns.includes(column.id)) as DataTableColumn<Person, SortKey>[]
  const channel = panel === 'Text' || panel === 'Email' ? panel : null
  const destinations = channel ? recipients(channel) : []
  const excluded = channel ? chosen.filter(person => channel === 'Text' ? !smsDestination(person.phone) : !person.email).length : 0
  return <div style={{ padding: spacing.lg, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', fontFamily: typography.fontSans }}>
    <PageHeader title="Contacts" right={<div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}><Button variant="secondary" size="toolbar" onClick={() => openPanel('Import Contacts')}>Import Contacts</Button><Button variant="secondary" size="toolbar" onClick={() => openPanel('Sync')}>Sync</Button><Button size="toolbar" onClick={() => openPanel('Enroll new student')}>Enroll new student</Button></div>} />
    <TableDiscoveryToolbar
      search={<form onSubmit={event => { event.preventDefault(); setQuery(draftQuery.trim()); setPage(1) }} style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', padding: spacing.sm, border: `1px solid ${colors.textSecondary}`, borderRadius: 8, background: colors.surface }}><Sparkles size={20} color={colors.tealDark} aria-hidden="true" style={{ flexShrink: 0 }} /><Input aria-label="Search contacts" placeholder="Ask AI or search contacts…" style={{ border: 0, background: colors.surface, color: colors.text, fontSize: typography.sizeMd }} value={draftQuery} onChange={event => setDraftQuery(event.target.value)} /><Button variant="secondary" size="toolbar" type="submit">Search</Button></form>}
      filters={<Button variant="secondary" size="toolbar" onClick={() => { setDraft({ ...applied }); setFiltersOpen(true) }}><SlidersHorizontal size={16} />Filters{Object.keys(applied).length ? ` (${Object.keys(applied).length})` : ''}</Button>}
      view={<TablePersonViewToggle variant="segmented" ariaLabel="Contact view" value={view === 'families' ? 'family' : 'none'} onChange={next => { setView(next === 'family' ? 'families' : 'students'); setPage(1) }} />}
      preferences={<TableDisplayControls label="Table Preferences" columns={schema.columnIds.map(id => ({ id, label: id[0].toUpperCase() + id.slice(1) }))} schema={schema} preferences={preferences} onChange={setPreferences} />}
      chips={(query || Object.keys(applied).length > 0) ? <>{query && <Button variant="secondary" size="sm" onClick={() => { setQuery(''); setDraftQuery(''); setPage(1) }}>Search: {query}<X size={12} /></Button>}{filterDefinitions.filter(({ key }) => applied[key]).map(({ key, label }) => <Button key={key} variant="secondary" size="sm" aria-label={`Remove ${label} filter`} onClick={() => { setApplied(previous => { const next = { ...previous }; delete next[key]; return next }); setPage(1) }}>{label}: {applied[key]}<X size={12} /></Button>)}</> : undefined}
    />
    <TableResultsSlot result={<TableResultCount>{matching.length} {matching.length === 1 ? 'contact' : 'contacts'}</TableResultCount>} contextual={selected.size > 0 ? <TableContextActionBar resultLabel={`${matching.length} ${matching.length === 1 ? 'contact' : 'contacts'}`} selectedCount={selected.size} selectionHint={outside || offPage ? `${outside} selected outside current results · ${offPage} selected on other pages` : undefined} onClear={() => setSelected(new Set())} actions={[
      ...(['Text', 'Email'] as const).map(name => ({ id: name, label: name, disabledReason: (!recipients(name).length ? `Selected contacts have no eligible ${name === 'Text' ? 'phone numbers' : 'email addresses'}.` : undefined), onClick: () => openPanel(name) })),
    ]} /> : undefined} />
    <ResponsiveDataTable<typeof groups[number], SortKey> ariaLabel="Contacts prototype" rows={visible} groupedRows={view === 'families'} density={preferences.density} minDesktopWidth={columns.reduce((sum, column) => sum + Number(column.width.match(/\d+/)?.[0] || 100), 48)} columns={columns.map(column => ({ ...column, render: group => column.render(group.parent, 0) }))} getRowKey={group => group.parent.id} sort={sort} onSortChange={setSort}
      selection={{ selectedKeys: selected, isSelectable: group => matchingIds.has(group.parent.id), onToggle: group => toggle(group.parent.id), onToggleAll: () => setSelected(previous => { const next = new Set(previous); visiblePeople.forEach(person => { if (allVisible) next.delete(person.id); else next.add(person.id) }); return next }), allSelected: allVisible, someSelected: visiblePeople.some(person => selected.has(person.id)) && !allVisible, selectAllLabel: 'Select all visible contacts', getRowLabel: group => group.parent.name }}
      getDetailRows={group => group.members.map(person => ({ key: person.id, style: { background: selected.has(person.id) ? colors.surfaceSelected : colors.surface }, selection: { checked: selected.has(person.id), disabled: !matchingIds.has(person.id), label: `Select ${person.name}`, onChange: () => toggle(person.id) }, cells: columns.map(column => column.render(person, 0)) }))}
      getRowStyle={group => ({ background: selected.has(group.parent.id) ? colors.surfaceSelected : colors.surface })} emptyContent={<p>No matching contacts. Remove a filter or change your search.</p>} />
    <TablePagination page={currentPage} pageCount={pageCount} onPageChange={setPage} ariaLabel="Contacts prototype pagination" />
    <details style={{ marginTop: spacing.xl, color: colors.textSecondary, fontSize: typography.sizeSm }}><summary>Component review: reused, improved, and new</summary><p>Reused: PageHeader, Button, Input, Select, TablePersonViewToggle, SlidePanel, FieldGrid, DataGridTable, TableDisplayControls, TablePagination, and design tokens.</p><p>Improved: optional Table Preferences label; toolbar-sized segmented view controls. Proposed follow-up: visible keyboard-accessible disabled explanations.</p><p>New: composable discovery toolbar and horizontal contextual action bar. Filters are AND-combined and applied only on Submit search. Selection persists across filtering, sorting, views, and pagination.</p><p>Shell boundary: sample family relationships and destinations, local search, no AI requests, no production enrollment/edit/composer integration. Existing Contacts and messaging policy are unchanged.</p></details>
    <SlidePanel isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} width="min(100vw, 380px)">
      <SlidePanelHeader title="Filters" onClose={() => setFiltersOpen(false)} />
      <form onSubmit={event => { event.preventDefault(); setApplied({ ...draft }); setPage(1); setFiltersOpen(false) }} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ padding: spacing.lg, overflowY: 'auto', flex: 1 }}><FieldGrid columns={1}>{filterDefinitions.map(({ key, label, values }) => <Select key={key} label={label} value={draft[key] || ''} onChange={event => setDraft(previous => { const next = { ...previous }; if (event.target.value) next[key] = event.target.value; else delete next[key]; return next })}><option value="">Any</option>{values.map(value => <option key={value}>{value}</option>)}</Select>)}</FieldGrid></div>
        <div style={{ padding: spacing.lg, borderTop: `1px solid ${colors.border}`, display: 'flex', gap: spacing.sm }}><Button type="submit">Submit search</Button><Button type="button" variant="secondary" onClick={() => setDraft({})}>Clear filters</Button></div>
      </form>
    </SlidePanel>
    <SlidePanel isOpen={!!panel} onClose={() => setPanel(null)} width="min(100vw, 480px)">
      <SlidePanelHeader title={panel || 'Preview'} onClose={() => setPanel(null)} />
      <div style={{ padding: spacing.lg, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
        <Notice>Shell preview only. No messages are sent and no records are changed.</Notice>
        {channel ? <><div><strong>{destinations.length} unique {channel === 'Text' ? 'phone numbers' : 'email addresses'}</strong><p>{selected.size} contacts selected · {excluded} without a destination. Shared destinations appear once.</p>{destinations.map(destination => <div key={destination}>{destination}</div>)}</div>{channel === 'Email' && <Input label="Subject" value={subject} onChange={event => setSubject(event.target.value)} />}<Textarea label="Message" rows={6} value={body} onChange={event => setBody(event.target.value)} /><Button disabled={!body.trim() || !destinations.length || (channel === 'Email' && !subject.trim())} onClick={() => setMessage('Preview reviewed. Nothing was sent.')}>Review preview</Button></> : panel === 'Contact details' && detail ? <><h3>{detail.name}</h3><p>{detail.role} · {detail.appointment} · {detail.status}</p><p>{detail.phone || 'No phone'}<br />{detail.email || 'No email'}</p></> : <p>{panel === 'Enroll new student' ? 'Enroll is the primary page action. The production enrollment workflow will be connected after this shell is approved.' : `${panel} will use the existing workflow after shell approval.`}</p>}
        {message && <p role="status">{message}</p>}
      </div>
    </SlidePanel>
  </div>
}