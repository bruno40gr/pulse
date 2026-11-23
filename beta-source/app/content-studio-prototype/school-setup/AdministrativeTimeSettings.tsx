'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ControlButton } from '@/components/ui/ControlButton'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { ResponsiveDataTable } from '@/components/ui/DataGridTable'
import { Input } from '@/components/ui/Input'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Notice } from '@/components/ui/Notice'
import { EmptyState } from '@/beta-source/components/ui/EmptyState'
import { spacing, typography, colors } from '@/lib/tokens'
import { administrativeTimeDescription, saveAdministrativeDuties } from '@/beta-source/lib/administrative-time-duties'
import type { SetupRecord } from './setup-content'

export default function AdministrativeTimeSettings({ duties, onDutiesSave }: {
  duties: SetupRecord[]; onDutiesSave: (records: SetupRecord[]) => void
}) {
  const [draft, setDraft] = useState<SetupRecord[] | null>(null)
  const [error, setError] = useState('')
  const active = duties.filter(item => item.values.enabled !== 'No')
  const original = JSON.stringify(active)
  const dirty = draft !== null && JSON.stringify(draft) !== original
  const close = () => { if (dirty && !window.confirm('Discard unsaved duty changes?')) return; setDraft(null); setError('') }
  const save = () => {
    if (!draft) return
    try { onDutiesSave(saveAdministrativeDuties(duties, draft)); setDraft(null); setError('') }
    catch (error) { setError((error as Error).message) }
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'] }}>
    <DenseSectionPanel title="Administrative time" headingLevel="h2" actions={<Button variant="secondary" aria-label="Configure administrative time" onClick={() => { setDraft(active.map(item => ({ ...item, values: { ...item.values } }))); setError('') }}>Configure<ChevronRight size={16} aria-hidden="true" /></Button>} contentStyle={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      <p style={{ ...typography.body, color: colors.textSecondary, margin: 0 }}>{administrativeTimeDescription}</p>
      <ResponsiveDataTable ariaLabel="Administrative time duties" rows={active} getRowKey={item => item.id} minDesktopWidth={0} mobileBreakpoint={600}
        emptyContent={<EmptyState variant="embedded" density="compact" title="No administrative duties yet" description="Choose Configure to add the duties you want to schedule." />}
        columns={[
          { id: 'name', header: 'Duty', width: 'minmax(160px, 1fr)', render: duty => duty.values.name },
        ]} />
    </DenseSectionPanel>
    {draft !== null && <Modal isOpen onClose={close} size="md" ariaLabel="Configure administrative time">
      <ModalHeader title="Configure administrative time" onClose={close} />
      <ModalBody style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
        <p style={{ margin: 0 }}>{administrativeTimeDescription}</p>
        <p style={{ ...typography.helper, color: colors.textSecondary, margin: 0 }}>Removing a duty stops new bookings for it. Existing assignments keep their original duty.</p>
        {draft.map((item, index) => <div key={item.id} style={{ display: 'flex', alignItems: 'flex-end', gap: spacing.sm }}>
          <Input label={`Duty ${index + 1}`} value={item.values.name} onChange={event => { setDraft(current => current!.map(row => row.id === item.id ? { ...row, values: { ...row.values, name: event.target.value } } : row)); setError('') }} />
          <ControlButton kind="icon" aria-label={`Remove duty ${index + 1}`} onClick={() => { setDraft(current => current!.filter(row => row.id !== item.id)); setError('') }}><Trash2 size={17} /></ControlButton>
        </div>)}
        {!draft.length && <p>No duties configured. Add a duty to get started.</p>}
        {error && <Notice variant="error">{error}</Notice>}
      </ModalBody>
      <ModalFooter leading={<Button variant="secondary" onClick={() => setDraft(current => [...current!, { id: crypto.randomUUID(), values: { name: '', enabled: 'Yes' } }])}><Plus size={16} />Add duty</Button>}>
        <Button variant="secondary" onClick={close}>Cancel</Button><Button onClick={save}>Save changes</Button>
      </ModalFooter>
    </Modal>}
  </div>
}