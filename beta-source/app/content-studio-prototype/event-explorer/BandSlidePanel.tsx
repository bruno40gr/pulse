'use client'

import { useState } from 'react'
import { SlidePanel } from '@/components/ui/SlidePanel'
import { SlidePanelHeader } from '@/components/ui/SlidePanelHeader'
import { OverflowMenu } from '@/components/ui/OverflowMenu'
import type { BandEnrollmentRequest } from '@/beta-source/lib/academy-band-requests'
import { ControlButton } from '@/components/ui/ControlButton'
import { Tabs } from '@/components/ui/Tabs'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Notice } from '@/components/ui/Notice'
import { EmptyState } from '@/components/ui/EmptyState'
import { PersonName } from '@/components/ui/PersonName'
import { ResponsiveDataTable } from '@/components/ui/DataGridTable'
import { Disclosure } from '@/components/ui/Disclosure'
import { NotesSection } from '@/components/ui/NotesSection'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { useIsMobile } from '@/lib/useMediaQuery'
import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'
import { LESSON_INSTRUMENT_OPTIONS } from '@/lib/lead-lesson-details'
import { colors, spacing } from '@/lib/tokens'
import { safeResourceUrl, type AcademyGroup, type GroupResource } from '@/beta-source/lib/academy-explorer'
import { availableBandSubscriptions, defaultBandInstrument, bandAvailabilityOverlap, type BandEnrollment } from '@/beta-source/lib/academy-band-enrollment'
import { type ProgramTask, type AvailabilityBlock } from '@/beta-source/lib/academy-program-proposals'
import type { ExplorerPerson } from '@/beta-source/lib/event-explorer'
import type { SetupRecord } from '../school-setup/setup-content'
import ProgramAvailability from './ProgramAvailability'
import ContactBulkComposer from '@/components/inbox/ContactBulkComposer'
import { SaveStatusNotice } from '@/components/ui/SaveStatusNotice'
import styles from './explorer.module.css'

type Tab = 'details' | 'members' | 'scheduling' | 'notes' | 'curriculum' | 'communications'
export default function BandSlidePanel({ band, people, staff, tasks, enrollments, onChange, onClose, onEnroll, onRemove, onAdd, onStudent, onRequest, onResponse, onPortal, onBook, requests, onEnrollmentRequest }: {
  band: AcademyGroup; people: ExplorerPerson[]; staff: SetupRecord[]; tasks: ProgramTask[]; enrollments: BandEnrollment[];
  onRemove: (studentId: string) => void; onChange: (band: AcademyGroup) => void; onClose: () => void; onEnroll: (studentId: string, bandId: string) => void;
  onAdd: (bandId: string, ids: string[], subscriptions: Record<string, string>) => void; onStudent: (id: string) => void;
  onRequest: (band: AcademyGroup, week: string) => void; onResponse: (id: string, allowed: string[], blocks: AvailabilityBlock[]) => void; onPortal: () => void;
  onBook: (band: AcademyGroup) => void;
  requests: BandEnrollmentRequest[]; onEnrollmentRequest: (ids: string[]) => void;
}) {
  const [tab, setTab] = useState<Tab>('members')
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [subscriptions, setSubscriptions] = useState<Record<string, string>>({})
  const [week, setWeek] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')
  const [resource, setResource] = useState({ name: '', url: '', kind: 'Exercise' as GroupResource['kind'] })
  const [schedule, setSchedule] = useState(band.schedule)
  const [description, setDescription] = useState(band.description ?? band.goals ?? '')
  const [automaticSave, setAutomaticSave] = useState(false)
  const [saved, setSaved] = useState(false)
  const [channel, setChannel] = useState<'sms' | 'email'>('sms')
  const mobile = useIsMobile()
  const ids = [...band.memberIds, ...(band.pendingMemberIds || [])]
  const members = ids.flatMap(id => { const person = people.find(person => person.id === id); return person ? [person] : [] })
  const candidates = people.filter(person => !ids.includes(person.id) && !person.roles.some(role => ['Parent', 'Account holder'].includes(role)) && `${person.name} ${person.email} ${person.instruments?.join(' ') || ''}`.toLowerCase().includes(search.toLowerCase()))
  const bandTasks = tasks.filter(task => task.proposalId === `band:${band.id}`)
  const currentTasks = bandTasks.filter(task => task.week === week)
  const overlap = bandAvailabilityOverlap(currentTasks, ids)
  const run = (action: () => void) => { try { action(); setError(''); setAutomaticSave(false); setSaved(true) } catch (cause) { setError((cause as Error).message) } }
  return <SlidePanel isOpen onClose={onClose} fullScreen={mobile} width={PROFILE_PANEL_WIDTH}>
    <SlidePanelHeader title={band.name} subtitle={`${band.memberIds.length} confirmed · ${(band.pendingMemberIds || []).length} pending`} onClose={onClose} />
    <div style={{ overflowX: 'auto', flexShrink: 0 }}><Tabs ariaLabel="Band sections" items={[{ key: 'details', label: 'Details' }, { key: 'members', label: 'Members' }, { key: 'scheduling', label: 'Scheduling' }, { key: 'notes', label: 'Notes' }, { key: 'curriculum', label: 'Curriculum' }, { key: 'communications', label: 'Communications' }]} activeKey={tab} onChange={next => { setTab(next); setSaved(false) }} style={{ minWidth: 'max-content' }} /></div>
    <div style={{ padding: mobile ? spacing.md : spacing.lg, overflowY: 'auto', flex: 1, minHeight: 0, '--explore-gap': spacing.lg } as React.CSSProperties} className={styles.stack}>
      {saved && <SaveStatusNotice status="saved" automatic={automaticSave} onDismiss={() => setSaved(false)} />}
      {error && <Notice variant="error">{error}</Notice>}
      {tab === 'members' && <>
        <DenseSectionPanel title="Members" actions={<div className={styles.inlineActions}><Button onClick={() => { setAdding(!adding); setSelected([]) }}>{adding ? 'Cancel' : 'Add students'}</Button></div>}>
          <ResponsiveDataTable rows={members} getRowKey={row => row.id} ariaLabel="Band members" minDesktopWidth={580} emptyContent={<EmptyState title="No members yet" />} columns={[
            { id: 'name', header: 'Student', width: '1fr', render: person => <PersonName as="button" onClick={() => onStudent(person.id)}>{person.name}</PersonName> },
            { id: 'instrument', header: 'Instrument', width: '1fr', render: person => <Select aria-label={`Instrument for ${person.name}`} value={band.memberInstruments?.[person.id] ?? defaultBandInstrument(person)} onChange={event => { onChange({ ...band, memberInstruments: { ...band.memberInstruments, [person.id]: event.target.value } }); setAutomaticSave(true); setSaved(true) }}><option value="">Choose instrument</option>{[...new Set([...LESSON_INSTRUMENT_OPTIONS, ...(person.instruments || []), ...Object.values(band.memberInstruments || {})])].map(instrument => <option key={instrument}>{instrument}</option>)}</Select> },
            { id: 'status', header: 'Membership', width: '1fr', render: person => band.memberIds.includes(person.id) ? 'Confirmed' : 'Pending' },
            { id: 'actions', header: '', width: '48px', render: person => <OverflowMenu label={`Actions for ${person.name}`} items={[
              { label: 'Enroll student', onSelect: () => run(() => { if (band.memberIds.includes(person.id)) throw new Error('This student is already enrolled in this band.'); const coverage = availableBandSubscriptions(enrollments, person.id)[0]; if (coverage) onAdd(band.id, [person.id], { [person.id]: coverage.id }); else onEnroll(person.id, band.id) }) },
              { label: 'Request enrollment', onSelect: () => run(() => { if (band.memberIds.includes(person.id)) throw new Error('This student is already enrolled in this band.'); if (requests.some(request => request.bandId === band.id && request.studentId === person.id && !request.completedAt)) throw new Error('An enrollment request has already been sent.'); onEnrollmentRequest([person.id]) }) },
              { label: 'Remove', onSelect: () => run(() => onRemove(person.id)) },
            ]} /> },
          ]} />
        </DenseSectionPanel>
        {adding && <DenseSectionPanel title="Add students" actions={<Button disabled={!selected.length} onClick={() => run(() => { onAdd(band.id, selected, subscriptions); setSelected([]); setSubscriptions({}); setAdding(false) })}>Add band candidates</Button>}><div className={styles.stack}><Input label="Find a student" type="search" value={search} onChange={event => setSearch(event.target.value)} /><p role="status">{selected.length} {selected.length === 1 ? 'student' : 'students'} selected</p><ResponsiveDataTable rows={candidates} getRowKey={row => row.id} ariaLabel="Band candidates" emptyContent={<EmptyState title="No matching students" />} minDesktopWidth={450} selection={{ selectedKeys: new Set(selected), onToggle: row => setSelected(selected.includes(row.id) ? selected.filter(id => id !== row.id) : [...selected, row.id]), allSelected: candidates.length > 0 && candidates.every(person => selected.includes(person.id)), onToggleAll: () => setSelected(candidates.every(person => selected.includes(person.id)) ? [] : candidates.map(person => person.id)), selectAllLabel: 'Select all candidates', getRowLabel: row => row.name }} columns={[{ id: 'name', header: 'Student', width: '1fr', render: row => <PersonName>{row.name}</PersonName> }, { id: 'instrument', header: 'Instrument', width: '1fr', render: row => row.instruments?.join(', ') || '—' }, { id: 'subscription', header: 'Paid coverage', width: '1fr', render: row => availableBandSubscriptions(enrollments, row.id).length ? <Select label={`Paid coverage for ${row.name}`} value={subscriptions[row.id] || ''} onChange={event => setSubscriptions(current => ({ ...current, [row.id]: event.target.value }))}><option value="">Assign later</option>{availableBandSubscriptions(enrollments, row.id).map(record => <option key={record.id} value={record.id}>Use subscription · ${Number(record.monthlyPrice).toFixed(2)} / month</option>)}</Select> : '—' }]} /></div></DenseSectionPanel>}
      </>}
      {tab === 'details' && <>
        <DenseSectionPanel title="Details" actions={<Button variant="secondary" onClick={() => run(() => onChange({ ...band, description }))}>Save description</Button>}><div className={styles.stack}><p>{staff.find(person => person.id === band.leader)?.values.name || 'Staff not assigned'}</p><p>{band.stage || 'Just Created'}</p><Textarea label="Band description" value={description} onChange={event => setDescription(event.target.value)} /></div></DenseSectionPanel>
      </>}
      {tab === 'scheduling' && <>
        <DenseSectionPanel title="Availability" actions={<Button disabled={!ids.length} onClick={() => run(() => onRequest(band, week))}>Request availability</Button>}><div className={styles.stack}><Input label="Week starting" type="date" value={week} onChange={event => setWeek(event.target.value)} /><Button variant="secondary" onClick={onPortal}>Open family portal</Button>{currentTasks.map(task => <Disclosure key={task.id} summary={`${people.find(person => person.id === task.studentId)?.name} · ${task.submitted ? 'Submitted' : 'Pending'}`}><ProgramAvailability key={`${task.id}:${task.submitted}`} task={task} onSubmit={blocks => run(() => onResponse(task.id, [task.studentId], blocks))} /></Disclosure>)}{!currentTasks.length && <EmptyState title="No availability requested for this week" />}</div></DenseSectionPanel>
        <DenseSectionPanel title="Shared availability">{overlap.length ? overlap.map(block => <p key={block.id}>{block.date} · {block.from}–{block.to}</p>) : <EmptyState title="No shared times yet" />}</DenseSectionPanel>
        <DenseSectionPanel title="Rehearsal schedule" actions={<div className={styles.inlineActions}><Button variant="secondary" onClick={() => run(() => onChange({ ...band, schedule }))}>Save schedule</Button><Button onClick={() => onBook(band)}>Book rehearsal</Button></div>}><Textarea label="Rehearsal schedule" value={schedule} onChange={event => setSchedule(event.target.value)} /></DenseSectionPanel>
      </>}
      {tab === 'notes' && <NotesSection title="Band notes" notes={band.bandNotes || []} avatarInitial="B" avatarBg={colors.teal} cardBg={colors.surface} onSave={text => onChange({ ...band, bandNotes: [...(band.bandNotes || []), { id: crypto.randomUUID(), text, timestamp: new Date().toISOString() }] })} />}
      {tab === 'curriculum' && <>
        <DenseSectionPanel title="Curriculum & setlists" actions={<Button onClick={() => run(() => { if (!resource.name.trim() || !safeResourceUrl(resource.url)) throw new Error('Enter a resource name and a valid HTTPS link.'); onChange({ ...band, resources: [...band.resources, { ...resource, id: crypto.randomUUID(), name: resource.name.trim() }] }); setResource({ name: '', url: '', kind: 'Exercise' }) })}>Add resource</Button>}><div className={styles.stack}><FieldGrid><Input label="Resource name" value={resource.name} onChange={event => setResource({ ...resource, name: event.target.value })} /><Select label="Resource type" value={resource.kind} onChange={event => setResource({ ...resource, kind: event.target.value as GroupResource['kind'] })}>{['Document', 'Video', 'Exercise', 'Link'].map(kind => <option key={kind}>{kind}</option>)}</Select></FieldGrid><Input label="Resource link (optional)" type="url" value={resource.url} onChange={event => setResource({ ...resource, url: event.target.value })} />{band.resources.map(item => <div key={item.id} className={styles.toolbar}>{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.name}</a> : <strong>{item.name}</strong>}<span>{item.kind}</span><Button variant="ghost" onClick={() => onChange({ ...band, resources: band.resources.filter(resource => resource.id !== item.id) })}>Remove resource</Button></div>)}</div></DenseSectionPanel>
      </>}
      {tab === 'communications' && <DenseSectionPanel title="Communications" actions={<div className={styles.inlineActions}><ControlButton kind="toggle" aria-pressed={channel === 'sms'} onClick={() => setChannel('sms')}>SMS</ControlButton><ControlButton kind="toggle" aria-pressed={channel === 'email'} onClick={() => setChannel('email')}>Email</ControlButton></div>}>
        <ContactBulkComposer key={`${band.id}:${channel}`} tenantId={`explorer-band:${band.id}`} contactIds={ids} channel={channel} onClose={() => {}} />
      </DenseSectionPanel>}
    </div>
  </SlidePanel>
}