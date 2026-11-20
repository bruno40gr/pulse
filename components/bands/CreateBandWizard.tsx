'use client'

import { useEffect, useState } from 'react'
import { EnrollmentLayout } from '@/components/ui/EnrollmentLayout'
import { SurfacePanel } from '@/components/ui/SurfacePanel'
import { RadioOptionGroup } from '@/components/ui/RadioOptionGroup'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { ResponsiveDataTable } from '@/components/ui/DataGridTable'
import { PersonName } from '@/components/ui/PersonName'
import { colors, spacing, typography } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'

const STEPS = ['Band details', 'Review'] as const
const GROUP_TYPES = [{ id: 'band', label: 'Band', description: 'Enrolled students rehearse together on a recurring schedule, building a shared repertoire.' }]

type Candidate = { id: string; name: string; account: string }

export function CreateBandWizard({ initialName = '', onClose, onCreated }: {
  initialName?: string
  onClose: () => void
  onCreated: (name: string) => void
}) {
  const [step, setStep] = useState(0)
  const [typeId, setTypeId] = useState('band')
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState('')
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/contacts?tenant=${encodeURIComponent(getActiveTenantId())}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const rows = response.ok ? await response.json() : null
        if (!Array.isArray(rows)) throw new Error('Could not load students.')
        // Candidates are students: parents and account holders are not members.
        setPeople(rows.filter((person: { is_student?: boolean }) => person.is_student === true)
          .map((person: { id: string; first_name?: string; last_name?: string; account_holder_name?: string }) => ({
            id: person.id,
            name: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
            account: person.account_holder_name || '',
          })).filter((person: Candidate) => person.name))
      })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load students.') })
    return () => controller.abort()
  }, [])

  const matches = people.filter(person => `${person.name} ${person.account}`.toLowerCase().includes(query.trim().toLowerCase()))
  const chosen = people.filter(person => selected.includes(person.id))

  const create = async () => {
    const bandName = name.trim()
    if (!bandName) { setStep(0); setError('Enter a band name.'); return }
    setSaving(true); setError('')
    try {
      const tenant = `tenant=${encodeURIComponent(getActiveTenantId())}`
      const profile = await fetch(`/api/bands/profile?${tenant}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ band: bandName, name: bandName, status: 'active' }),
      })
      if (!profile.ok) throw new Error((await profile.json().catch(() => null))?.error || 'Could not create that band.')
      for (const person of chosen) {
        const response = await fetch(`/api/bands/members?${tenant}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ band: bandName, person_id: person.id, membership: 'prospect' }),
        })
        if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `Could not add ${person.name}.`)
      }
      onCreated(bandName)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create that band.')
    } finally { setSaving(false) }
  }

  return <EnrollmentLayout title="Create band" actions={<Button variant="secondary" onClick={onClose} disabled={saving}>Save &amp; close</Button>} steps={STEPS} currentStep={step} onStepChange={setStep} completedSteps={name.trim() ? [0] : []}>
    <SurfacePanel padding={spacing.xl}>
      {error && <Notice variant="error" style={{ marginBottom: spacing.lg }}>{error}</Notice>}
      {step === 0 ? <div style={{ display: 'grid', gap: spacing.lg }}>
        <RadioOptionGroup label="Group type" value={typeId} options={GROUP_TYPES} onChange={setTypeId} />
        <Input label="Band name" required value={name} onChange={event => setName(event.target.value)} />
        <Textarea label="Band description" value={description} onChange={event => setDescription(event.target.value)} />
        <Input label="Find candidates (optional)" value={query} onChange={event => setQuery(event.target.value)} />
        <ResponsiveDataTable rows={matches} getRowKey={person => person.id} ariaLabel="Band candidates" minDesktopWidth={460} emptyContent="No students match that search."
          selection={{
            selectedKeys: new Set(selected),
            allSelected: matches.length > 0 && matches.every(person => selected.includes(person.id)),
            onToggle: person => setSelected(current => current.includes(person.id) ? current.filter(id => id !== person.id) : [...current, person.id]),
            onToggleAll: () => setSelected(current => matches.every(person => current.includes(person.id)) ? current.filter(id => !matches.some(person => person.id === id)) : [...new Set([...current, ...matches.map(person => person.id)])]),
            selectAllLabel: 'Select all candidates',
            getRowLabel: person => person.name,
          }}
          columns={[
            { id: 'name', header: 'Student', width: '1fr', render: person => <PersonName>{person.name}</PersonName> },
            { id: 'account', header: 'Account', width: '1fr', render: person => <span style={{ color: colors.textSecondary }}>{person.account || '—'}</span> },
          ]} />
      </div> : <dl style={{ display: 'grid', gap: spacing.md, margin: 0 }}>
        {[
          { label: 'Group type', value: GROUP_TYPES.find(type => type.id === typeId)?.label || '' },
          { label: 'Band name', value: name.trim() },
          { label: 'Description', value: description.trim() },
          { label: 'Candidates', value: chosen.length ? chosen.map(person => person.name).join(', ') : 'None selected' },
        ].map(row => <div key={row.label} style={{ display: 'grid', gap: spacing.xs }}>
          <dt style={{ ...typography.label, color: colors.textMuted }}>{row.label}</dt>
          <dd style={{ margin: 0, ...typography.bodySmall, color: colors.text }}>{row.value || '—'}</dd>
        </div>)}
      </dl>}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xl }}>
        {step > 0 ? <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={saving}>Back</Button> : <span />}
        {step < STEPS.length - 1
          ? <Button onClick={() => { if (!name.trim()) { setError('Enter a band name.'); return } setError(''); setStep(step + 1) }}>Continue</Button>
          : <Button onClick={() => void create()} disabled={saving}>{saving ? 'Creating…' : 'Create band'}</Button>}
      </div>
    </SurfacePanel>
  </EnrollmentLayout>
}
