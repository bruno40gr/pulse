'use client'

import { useState } from 'react'
import { FileText, ClipboardCheck } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import styles from './school-setup.module.css'
import { Button } from '@/components/ui/Button'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { spacing } from '@/lib/tokens'
import type { SetupRecord } from './setup-content'

type Version = { scope: string; service: string; version: number; title: string; content: string; effective: string; audience: string }
type Agreement = { id: string; title: string; scope: string; service: string; content: string; effective: string; audience: string; revisions: Version[] }
export default function AgreementsPanel({ value, services, onSave, onDirty }: { value: string; services: SetupRecord[]; onSave: (value: string) => void; onDirty: (dirty: boolean) => void }) {
  const agreements: Agreement[] = value ? JSON.parse(value) : []
  const [draft, setDraft] = useState<Agreement | null>(null)
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const layout = { display: 'grid', gap: spacing.lg }
  const close = () => { setDraft(null); setPreview(false); setError(''); onDirty(false) }
  const update = (next: Agreement) => { setDraft(next); setPreview(false); onDirty(true) }
  const save = (publish: boolean) => {
    if (!draft) return
    if (!draft.title.trim() || !draft.content.trim() || (draft.scope === 'Special offering' && !services.some(item => item.id === draft.service))) { setError('Enter a title, agreement text and an applicable offering.'); return }
    if (publish && (!draft.effective || !Number.isFinite(Date.parse(draft.effective)))) { setError('Choose an effective date before publishing.'); return }
    const next = publish ? { ...draft, revisions: [...draft.revisions, { scope: draft.scope, service: draft.service, version: draft.revisions.length + 1, title: draft.title, content: draft.content, effective: draft.effective, audience: draft.audience }] } : draft
    onSave(JSON.stringify([...agreements.filter(item => item.id !== next.id), next])); close(); setMessage(publish ? 'Version saved. No acceptance requests or notifications have been sent.' : 'Agreement draft saved.')
  }
  const add = () => { setMessage(''); setDraft({ id: crypto.randomUUID(), title: '', scope: agreements.some(item => item.scope === 'School-wide') ? 'Special offering' : 'School-wide', service: '', content: '', effective: '', audience: 'New enrollments only', revisions: [] }); onDirty(true) }
  return <DenseSectionPanel title="Agreements & acceptance" headingLevel="h2" contentStyle={layout} actions={!draft && agreements.length ? <Button type="button" variant="secondary" onClick={add}>Add agreement</Button> : undefined}>
    <p>Use a school-wide enrollment agreement, with separate agreements or waivers for camps and special events. Keep accepted versions unchanged.</p>
    {message && <p role="status">{message}</p>}
    {draft ? <DenseSectionPanel title={draft.title || 'New agreement'} contentStyle={layout} actions={<div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}><Button type="button" variant="secondary" onClick={close}>Cancel agreement</Button><Button type="button" variant="secondary" onClick={() => save(false)}>Save draft</Button><Button type="button" onClick={() => { setPreview(true); setError('') }}>Preview agreement</Button></div>}>
      <FieldGrid><Input label="Agreement title" value={draft.title} onChange={event => update({ ...draft, title: event.target.value })} /><Select label="Agreement scope" value={draft.scope} onChange={event => update({ ...draft, scope: event.target.value })}><option>School-wide</option><option>Special offering</option></Select>{draft.scope === 'Special offering' && <Select label="Applicable offering" value={draft.service} onChange={event => update({ ...draft, service: event.target.value })}><option value="">Choose…</option>{services.map(service => <option key={service.id} value={service.id}>{service.values.name}</option>)}</Select>}</FieldGrid>
      <Textarea label="Agreement text" rows={9} value={draft.content} onChange={event => update({ ...draft, content: event.target.value })} />
      <FieldGrid><Input label="Effective date" type="date" value={draft.effective} onChange={event => update({ ...draft, effective: event.target.value })} /><Select label="Publish to" value={draft.audience} onChange={event => update({ ...draft, audience: event.target.value })}><option>New enrollments only</option><option>New and existing families; request acceptance</option></Select></FieldGrid>
      {preview && <DenseSectionPanel title="Agreement preview" actions={<Button type="button" onClick={() => save(true)}>Publish version</Button>}><h3>{draft.title || 'Untitled agreement'}</h3><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{draft.content || 'Add agreement text before publishing.'}</p><p>{draft.audience} · {draft.effective || 'Effective date not selected'}</p><p>Publishing keeps prior versions. It does not change existing billing or bookings.</p></DenseSectionPanel>}
      {error && <p role="alert">{error}</p>}
    </DenseSectionPanel> : agreements.length ? agreements.map(agreement => <DenseSectionPanel key={agreement.id} title={agreement.title} contentStyle={layout} actions={<Button type="button" variant="secondary" onClick={() => { setDraft(structuredClone(agreement)); setMessage('') }}>Edit agreement</Button>}><p className={styles.agreementMeta}>{agreement.scope}{agreement.scope === 'Special offering' ? ` · ${services.find(item => item.id === agreement.service)?.values.name || 'Offering unavailable'}` : ''} · {agreement.revisions.length ? `${agreement.revisions.length} published version(s)` : 'Draft'}</p><details><summary>Version history</summary>{agreement.revisions.length ? agreement.revisions.map(revision => <div key={revision.version}><h3>Version {revision.version}: {revision.title}</h3><p>{revision.scope} · {revision.effective} · {revision.audience}</p><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{revision.content}</p></div>) : <p>No published versions.</p>}</details><EmptyState variant="embedded" density="compact" icon={<ClipboardCheck size={24} aria-hidden="true" />} title="No acceptances recorded" description="Acceptance history will appear here when families accept a published version." /></DenseSectionPanel>) : <EmptyState variant="embedded" icon={<FileText size={32} aria-hidden="true" />} title="Create your enrollment agreement" description="Start with school-wide terms. Add separate agreements or waivers for camps, parties and one-off events when needed." action={<Button type="button" onClick={add}>Create school-wide agreement</Button>} />}
  </DenseSectionPanel>
}