'use client'

import { useState } from 'react'
import { Button, DenseSectionPanel, Input, Notice, Select, Textarea } from '@/components/ui'
import { Checkbox } from '@/components/ui/Checkbox'
import { TableResultCount, TableSearchControl } from '@/components/ui/TableWorkspaceControls'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { spacing } from '@/lib/tokens'
import type { ExplorerEvent, ExplorerPerson } from '@/beta-source/lib/event-explorer'
import { confirmPerformer, matchesPerformanceSearch, movePerformer, recordPerformanceMail, recordPerformanceResponse, type PerformancePreview, type Performer } from '@/beta-source/lib/performance-preview'
import styles from './explorer.module.css'

const empty: PerformancePreview = { performers: [], mail: [] }
const rowStyle = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm } as const

export default function PerformanceWorkspace({ event, people, onChange }: { event: ExplorerEvent; people: ExplorerPerson[]; onChange: (value: PerformancePreview) => void }) {
  const state = event.performancePreview ?? empty
  const names = new Map(people.map(person => [person.id, person.name]))
  const name = (id: string) => names.get(id) ?? 'Student unavailable'
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [instrument, setInstrument] = useState('')
  const [audience, setAudience] = useState('Interested')
  const [draft, setDraft] = useState<{ kind: 'invitation' | 'follow-up'; subject: string; body: string; studentIds: string[] } | null>(null)
  const [emailPreview, setEmailPreview] = useState(false)
  const [responding, setResponding] = useState<string | null>(null)
  const [response, setResponse] = useState<'Interested' | 'Declined' | null>(null)
  const [notice, setNotice] = useState('')
  const lineup = state.performers.filter(item => item.confirmed)
  const interested = state.performers.filter(item => item.response === 'Interested')
  const waiting = state.performers.filter(item => item.response === 'No response')
  const eligible = people.filter(person => person.enrolled && person.email && !state.performers.some(item => item.id === person.id))
  const inviteIds = selected.filter(id => eligible.some(person => person.id === id))
  const instruments = [...new Set(eligible.flatMap(person => person.instruments ?? []))].sort()
  const matching = eligible.filter(person => (!instrument || person.instruments?.includes(instrument)) && matchesPerformanceSearch(person, query))
  const allMatchingSelected = matching.length > 0 && matching.every(person => inviteIds.includes(person.id))
  const followUp = audience === 'Confirmed' ? lineup : audience === 'No response' ? waiting : interested
  const patch = (id: string, fields: Partial<Performer>) => onChange({ ...state, performers: state.performers.map(item => item.id === id ? { ...item, ...fields } : item) })
  const title = event.name || 'Performance'

  function openDraft(kind: 'invitation' | 'follow-up', studentIds: string[]) {
    setEmailPreview(false)
    const details = [event.start, event.schedule, event.location].filter(Boolean).join(' · ')
    setDraft({ kind, studentIds, subject: kind === 'invitation' ? `Invitation to perform: ${title}` : `An update about ${title}`,
      body: kind === 'invitation' ? `Hi! We’d love to invite your student to perform at ${title}.\n\n${details}\n\nPlease let us know if they’re interested. We’ll confirm the lineup separately.` : `Hi! A quick update about ${title}.\n\n${details}\n\n` })
  }

  return <section aria-label="Performance workflow" className={styles.stack}>
    <Notice>Sample workflow. Invitations, follow-ups and responses stay in this Beta preview. No email is sent.</Notice>
    <DenseSectionPanel title="Invite students" contentStyle={{ display: 'grid', gap: spacing.md }} actions={<Button disabled={!inviteIds.length} onClick={() => openDraft('invitation', inviteIds)}>Draft invitation ({inviteIds.length})</Button>}>
      <TableSearchControl label="Search students" placeholder="Name, family, email, or e.g. drum players" value={search} onChange={setSearch} onSearch={() => setQuery(search)} onClear={() => { setSearch(''); setQuery('') }} />
      <div style={rowStyle}>
        <Select label="Instrument" value={instrument} onChange={event => setInstrument(event.target.value)}><option value="">All instruments</option>{instruments.map(value => <option key={value}>{value}</option>)}</Select>
        <Button variant="secondary" disabled={!matching.length} onClick={() => setSelected(current => allMatchingSelected ? current.filter(id => !matching.some(person => person.id === id)) : [...new Set([...current, ...matching.map(person => person.id)])])}>{allMatchingSelected ? 'Deselect matching' : 'Select all matching'} ({matching.length})</Button>
      </div>
      <TableResultCount>{matching.length} matching · {inviteIds.length} selected</TableResultCount>
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {matching.map(person => <Checkbox key={person.id} label={person.name} description={[person.family, person.instruments?.join(', ')].filter(Boolean).join(' · ') || undefined} checked={inviteIds.includes(person.id)}
          onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, person.id])] : current.filter(id => id !== person.id))} />)}
        {!matching.length && <p className={styles.muted}>No matching students available to invite.</p>}
      </div>
    </DenseSectionPanel>
    <DenseSectionPanel title="Responses" contentStyle={{ display: 'grid', gap: spacing.md }}>
      <div className={styles.stats} aria-label="Response counts"><span>Invited <strong>{state.performers.length}</strong></span><span>Interested <strong>{interested.length}</strong></span><span>No response <strong>{waiting.length}</strong></span></div>
      <div style={rowStyle}>
        <div><Select label="Follow-up audience" value={audience} onChange={event => setAudience(event.target.value)}><option>Interested</option><option>Confirmed</option><option>No response</option></Select></div>
        <Button variant="secondary" disabled={!followUp.length} onClick={() => openDraft('follow-up', followUp.map(item => item.id))}>Draft follow-up ({followUp.length})</Button>
      </div>
      {state.performers.map(item => <div key={item.id} style={rowStyle}>
        <strong>{name(item.id)}</strong><span>{item.response}{item.confirmed ? ' · Confirmed' : ''}</span>
        <Button size="sm" variant="secondary" onClick={() => { setResponding(item.id); setResponse(null) }} aria-label={`Preview response for ${name(item.id)}`}>Preview family response</Button>
        {item.response === 'Interested' && <Button size="sm" variant="secondary" onClick={() => onChange(confirmPerformer(state, item.id, !item.confirmed))}>{item.confirmed ? 'Remove from lineup' : 'Confirm performer'}</Button>}
      </div>)}
      {!state.performers.length && <p className={styles.muted}>No invitations yet.</p>}
    </DenseSectionPanel>
    <DenseSectionPanel title="Running order" contentStyle={{ display: 'grid', gap: spacing.lg }}>
      {!lineup.length && <p className={styles.muted}>Confirm an interested student to add them to the lineup.</p>}
      {lineup.map((item, index) => <section key={item.id} aria-label={`Running order: ${name(item.id)}`} style={{ display: 'grid', gap: spacing.sm }}>
        <div style={rowStyle}><strong>{index + 1}. {name(item.id)}</strong>
          <Button size="sm" variant="secondary" aria-label={`Move ${name(item.id)} up`} disabled={!index} onClick={() => onChange(movePerformer(state, item.id, -1))}>Move up</Button>
          <Button size="sm" variant="secondary" aria-label={`Move ${name(item.id)} down`} disabled={index === lineup.length - 1} onClick={() => onChange(movePerformer(state, item.id, 1))}>Move down</Button>
        </div>
        <Input label="Piece title" value={item.piece ?? ''} onChange={event => patch(item.id, { piece: event.target.value })} />
        <Input label="Estimated minutes" type="number" min="1" max="120" value={item.minutes ?? ''} onChange={event => {
          const value = event.target.valueAsNumber
          patch(item.id, { minutes: Number.isInteger(value) && value > 0 && value <= 120 ? value : undefined })
        }} />
      </section>)}
      {lineup.some(item => item.minutes) && <p className={styles.muted}>Estimated playing time: {lineup.reduce((sum, item) => sum + (item.minutes ?? 0), 0)} minutes</p>}
    </DenseSectionPanel>
    <DenseSectionPanel title="Email activity" contentStyle={{ display: 'grid', gap: spacing.md }}>
      {!state.mail.length && <p className={styles.muted}>No preview emails recorded.</p>}
      {[...state.mail].reverse().map(mail => <div key={mail.id}><strong>{mail.subject}</strong><div className={styles.muted}>{mail.kind === 'invitation' ? 'Invitation' : 'Follow-up'} · {mail.studentIds.map(name).join(', ')} · Preview only</div></div>)}
      {notice && <p role="status">{notice}</p>}
    </DenseSectionPanel>

    {draft && <Modal isOpen onClose={() => setDraft(null)} size="lg" ariaLabel="Performance email">
      <ModalHeader title={draft.kind === 'invitation' ? 'Performance invitation' : 'Performance follow-up'} onClose={() => setDraft(null)} />
      <ModalBody><div className={styles.stack}>
        <p className={styles.muted}>To the families of {draft.studentIds.map(name).join(', ')}</p>
        {emailPreview ? <><strong>{draft.subject}</strong><p style={{ whiteSpace: 'pre-wrap' }}>{draft.body}</p></> : <>
          <Input label="Subject" value={draft.subject} onChange={event => setDraft({ ...draft, subject: event.target.value })} />
          <Textarea label="Message" rows={7} value={draft.body} onChange={event => setDraft({ ...draft, body: event.target.value })} />
        </>}
        {draft.kind === 'invitation' && <div><Button size="sm" disabled>Yes, I’m interested in participating</Button></div>}
      </div></ModalBody>
      <ModalFooter><Button variant="secondary" onClick={() => setEmailPreview(!emailPreview)}>{emailPreview ? 'Back to draft' : 'Preview email'}</Button><Button disabled={!draft.subject.trim() || !draft.body.trim()} onClick={() => {
        onChange(recordPerformanceMail(state, { ...draft, id: crypto.randomUUID() }))
        if (draft.kind === 'invitation') setSelected([])
        setDraft(null); setNotice('Preview email recorded. Nothing was sent.')
      }}>Simulate send</Button></ModalFooter>
    </Modal>}
    {responding && <Modal isOpen onClose={() => setResponding(null)} ariaLabel="Family response preview">
      <ModalHeader title={title} onClose={() => setResponding(null)} />
      <ModalBody><div className={styles.stack}><strong>{name(responding)}</strong><p className={styles.muted}>No login is needed. This tells us you’re interested; staff will confirm the lineup separately.</p>
        <Button variant={response === 'Interested' ? 'primary' : 'secondary'} aria-pressed={response === 'Interested'} onClick={() => setResponse('Interested')}>Yes, I’m interested in participating</Button>
        <Button variant={response === 'Declined' ? 'primary' : 'secondary'} aria-pressed={response === 'Declined'} onClick={() => setResponse('Declined')}>Not this time</Button></div></ModalBody>
      <ModalFooter><Button disabled={!response} onClick={() => { if (response) onChange(recordPerformanceResponse(state, responding, response)); setResponding(null); setNotice('Preview response recorded.') }}>Submit response</Button></ModalFooter>
    </Modal>}
  </section>
}