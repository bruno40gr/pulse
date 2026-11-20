'use client'

import { useState, type FormEvent } from 'react'
import { Tabs } from '@/components/ui/Tabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { ResponsiveDataTable } from '@/components/ui/DataGridTable'
import { PersonName } from '@/components/ui/PersonName'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { Checkbox } from '@/components/ui/Checkbox'
import { Notice } from '@/components/ui/Notice'
import { EmptyState } from '@/components/ui/EmptyState'
import { Disclosure } from '@/components/ui/Disclosure'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { assembleGroup, safeResourceUrl, type AcademyGroup, type AcademySettings, type GroupResource } from '@/beta-source/lib/academy-explorer'
import type { ExplorerEvent, ExplorerPerson } from '@/beta-source/lib/event-explorer'
import type { SetupRecord } from '../school-setup/setup-content'
import styles from './explorer.module.css'
import BandReview from './BandReview'
import type { BandReviewData } from '@/lib/band-review-data'

export default function GroupsWorkspace({ academy, people, events, staff, onChange, onOpenEvent, onCreate, onOpenBand, matchingQueue, creationDrafts, review }: {
  academy: AcademySettings; people: ExplorerPerson[]; staff: SetupRecord[]; events: ExplorerEvent[];
  onChange: (value: AcademySettings) => void; onOpenEvent: (id: string) => void; onCreate: () => void;
  onOpenBand?: (id: string) => void;
  matchingQueue?: React.ReactNode;
  creationDrafts?: React.ReactNode;
  review?: BandReviewData;
}) {
  const [view, setView] = useState<'bands' | 'matching'>('bands')
  const [draft, setDraft] = useState<AcademyGroup | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [resourceName, setResourceName] = useState('')
  const [resourceUrl, setResourceUrl] = useState('')
  const [resourceKind, setResourceKind] = useState<GroupResource['kind']>('Document')
  if (review) return <>
    <PageHeader title="Bands & ensembles" />
    <Tabs ariaLabel="Bands workspace" items={[{ key: 'bands', label: 'Bands & ensembles' }, { key: 'matching', label: 'Students seeking a band' }]} activeKey={view} onChange={setView} />
    <BandReview data={review} view={view} />
  </>
  const update = (change: Partial<AcademyGroup>) => { setDraft(current => current ? { ...current, ...change } : current); setError('') }
  const back = () => {
    const original = academy.groups.find(group => group.id === draft?.id)
    if (draft && JSON.stringify(draft) !== JSON.stringify(original) && !window.confirm('Discard unsaved group changes?')) return
    setDraft(null)
    setError(''); setNotice('')
  }
  function save(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    try {
      const group = assembleGroup(draft, people, staff.map(person => person.id))
      onChange({ ...academy, groups: [...academy.groups.filter(item => item.id !== group.id), group] })
      setError(''); setNotice('Group saved.')
      setDraft(null)
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Check the group details.') }
  }
  if (!draft) return <>
    <PageHeader title={academy.kind === 'music' ? 'Bands & ensembles' : academy.kind === 'martial' ? 'Practice teams' : 'Study groups'} right={<Button onClick={onCreate}>{academy.kind === 'music' ? 'Create new band' : 'Create new group'}</Button>} />
    {matchingQueue && <Tabs ariaLabel="Bands workspace" items={[{ key: 'bands', label: 'Bands & ensembles' }, { key: 'matching', label: 'Students seeking a band' }]} activeKey={view} onChange={setView} />}
    {view === 'matching' ? matchingQueue : <>
    {notice && <Notice variant="success" onDismiss={() => setNotice('')}>{notice}</Notice>}
    {creationDrafts}
    <ResponsiveDataTable rows={academy.groups} getRowKey={row => row.id} ariaLabel="Groups" minDesktopWidth={650} emptyContent={<EmptyState title="No groups yet" />} columns={[
      { id: 'name', header: 'Group', width: '1.5fr', render: row => <PersonName as="button" onClick={() => onOpenBand ? onOpenBand(row.id) : setDraft({ ...row, memberIds: [...row.memberIds] })}>{row.name}</PersonName> },
      { id: 'type', header: 'Type', width: '1fr', render: row => academy.groupTypes.find(item => item.id === row.typeId)?.name || 'Unassigned' },
      { id: 'members', header: 'Members', width: '.7fr', render: row => academy.kind === 'music' ? `${row.memberIds.length} confirmed · ${(row.pendingMemberIds || []).length} pending` : row.formation ? row.memberIds.length : `${row.memberIds.length} / ${row.capacity}` },
      { id: 'staff', header: 'Teacher / staff', width: '1fr', render: row => staff.find(person => person.id === row.leader)?.values.name || 'Unassigned' },
    ]} />
    </>}
  </>
  const existing = academy.groups.some(group => group.id === draft.id)
  const students = people.filter(person => person.enrolled || (draft.formation && person.roles.includes('Student')))
  return <>
    <PageHeader title={draft.name} onBack={back} right={<Button type="submit" form="group-enrollment">{draft.formation ? 'Save band' : 'Save group'}</Button>} />
    {error && <Notice variant="error">{error}</Notice>}
    <form id="group-enrollment" onSubmit={save} noValidate className={styles.stack}>
      <section className={styles.stack} aria-label="Group details">
        <SectionTitle>{draft.formation ? 'Band details' : 'Group details'}</SectionTitle>
        <FieldGrid columns={1}><Input label={draft.formation ? 'Band name' : 'Group name'} required value={draft.name} onChange={event => update({ name: event.target.value })} />
          <Select label="Group type" value={draft.typeId} onChange={event => update({ typeId: event.target.value })}>{academy.groupTypes.filter(type => type.enabled || type.id === draft.typeId).map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</Select>
          <Select label="Teacher / staff" required value={draft.leader} onChange={event => update({ leader: event.target.value })}><option value="">Choose teacher or staff</option>{staff.map(person => <option key={person.id} value={person.id}>{person.values.name}</option>)}</Select>
        </FieldGrid>
      </section>
      <section className={styles.stack} aria-label="Group members"><SectionTitle>Students</SectionTitle>
        <ResponsiveDataTable rows={students} getRowKey={row => row.id} ariaLabel="Group students" minDesktopWidth={500} emptyContent={<EmptyState title="No enrolled students" />} selection={{
          selectedKeys: new Set(draft.memberIds), allSelected: students.length > 0 && students.every(person => draft.memberIds.includes(person.id)),
          onToggle: row => update({ memberIds: draft.memberIds.includes(row.id) ? draft.memberIds.filter(id => id !== row.id) : [...draft.memberIds, row.id] }),
          onToggleAll: () => update({ memberIds: students.every(person => draft.memberIds.includes(person.id)) ? [] : students.map(person => person.id) }),
          selectAllLabel: 'Select all students', getRowLabel: row => row.name,
        }} columns={[
          { id: 'name', header: 'Student', width: '1fr', render: row => <PersonName>{row.name}</PersonName> },
          { id: 'family', header: 'Account', width: '1.5fr', render: row => row.family },
        ]} />
      </section>
      {!draft.formation && <section className={styles.stack} aria-label="Group schedule"><SectionTitle>Schedule & capacity</SectionTitle>
        <Textarea label="Recurring schedule" value={draft.schedule} onChange={event => update({ schedule: event.target.value })} />
        <FieldGrid><Input label="Total capacity" type="number" min={1} value={draft.capacity} onChange={event => update({ capacity: Number(event.target.value) })} /><Input label="Trial limit per session" type="number" min={0} value={draft.trialMax} onChange={event => update({ trialMax: Number(event.target.value) })} /></FieldGrid>
      </section>}
      {draft.formation && <Textarea label="Band description" value={draft.description ?? draft.goals ?? ''} onChange={event => update({ description: event.target.value })} />}
      {existing && <>
        <Disclosure summary="Shared library"><div className={styles.stack}>
          <DenseSectionPanel title="Resources" headingLevel="h3" actions={<Button type="button" variant="secondary" onClick={() => {
            if (!resourceName.trim() || !safeResourceUrl(resourceUrl)) { setError('Enter a resource name and a valid HTTPS link.'); return }
            update({ resources: [...draft.resources, { id: `resource-${Date.now()}`, name: resourceName.trim(), url: resourceUrl.trim(), kind: resourceKind }] }); setResourceName(''); setResourceUrl(''); setError('')
          }}>Add resource</Button>}><div className={styles.stack}>
            <Input label="Resource name" value={resourceName} onChange={event => setResourceName(event.target.value)} />
            <Select label="Resource type" value={resourceKind} onChange={event => setResourceKind(event.target.value as GroupResource['kind'])}>{['Document', 'Video', 'Exercise', 'Link'].map(value => <option key={value}>{value}</option>)}</Select>
            <Input label="Resource link (optional)" type="url" value={resourceUrl} onChange={event => setResourceUrl(event.target.value)} />
            {draft.resources.map(resource => <div key={resource.id} className={styles.toolbar}><div>{resource.url ? <a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.name}</a> : <strong>{resource.name}</strong>}<p className={styles.muted}>{resource.kind}</p></div><Button type="button" variant="ghost" onClick={() => update({ resources: draft.resources.filter(item => item.id !== resource.id) })}>Remove resource</Button></div>)}
          </div></DenseSectionPanel>
        </div></Disclosure>
        <Disclosure summary="Communication"><Textarea label="Announcement draft" value={draft.message} onChange={event => update({ message: event.target.value })} /></Disclosure>
        <Disclosure summary="Related events"><div className={styles.stack}>{events.map(event => <div key={event.id} className={styles.toolbar}><Checkbox label={event.name} checked={draft.eventIds.includes(event.id)} onChange={change => update({ eventIds: change.target.checked ? [...draft.eventIds, event.id] : draft.eventIds.filter(id => id !== event.id) })} /><Button type="button" variant="secondary" onClick={() => { if (JSON.stringify(draft) === JSON.stringify(academy.groups.find(group => group.id === draft.id)) || window.confirm('Discard unsaved group changes?')) onOpenEvent(event.id) }}>Open event</Button></div>)}</div></Disclosure>
      </>}
    </form>
  </>
}