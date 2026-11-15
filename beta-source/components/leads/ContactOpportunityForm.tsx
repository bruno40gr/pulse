'use client'

import { useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Notice } from '@/components/ui/Notice'
import { spacing } from '@/lib/tokens'

/** Existing-contact intent only; selected identities are owned by the caller. */
export default function ContactOpportunityForm({ services, bands, students = [], onCreateBand, onClose, onSave }: {
  students?: string[]; onCreateBand?: () => void;
  services: { id: string; name: string }[]; bands: { id: string; name: string }[];
  onClose: () => void; onSave: (value: { type: 'lesson' | 'band' | 'service'; serviceId: string; bandId: string }) => void;
}) {
  const [type, setType] = useState<'lesson' | 'band' | 'service'>('lesson')
  const [serviceId, setServiceId] = useState('')
  const [bandId, setBandId] = useState('')
  const [error, setError] = useState('')
  const [bandAction, setBandAction] = useState('later')
  const bandService = services.find(service => /band|ensemble/i.test(service.name))
  const isBand = type === 'lesson' && serviceId === (bandService?.id || 'band')
  return <Modal isOpen onClose={onClose} ariaLabel="Create opportunities">
    <ModalHeader title="Create opportunities" onClose={onClose} />
    <ModalBody style={{ display: 'grid', gap: spacing.lg }}>
      {error && <Notice variant="error">{error}</Notice>}
      {students.length > 0 && <p>{students.join(', ')}</p>}
      <Select label="Inquiry type" value={type} onChange={event => { setType(event.target.value as typeof type); setServiceId(''); setError('') }}><option value="lesson">Lesson inquiry</option><option value="service">Service inquiry</option></Select>
      <Select label={type === 'lesson' ? 'Program' : 'Service'} value={serviceId} onChange={event => { setServiceId(event.target.value); setBandId(''); setBandAction('later'); setError('') }}><option value="">Choose a {type === 'lesson' ? 'program' : 'service'}</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}{type === 'lesson' && !bandService && <option value="band">Band</option>}</Select>
      {isBand && <Select label="Band placement" value={bandAction} onChange={event => { setBandAction(event.target.value); setBandId(''); setError('') }}><option value="later">Find a band later</option><option value="existing">Assign to an existing band</option>{onCreateBand && <option value="new">Create a new band</option>}</Select>}
      {isBand && bandAction === 'existing' && <Select label="Band" value={bandId} onChange={event => setBandId(event.target.value)}><option value="">Choose a band</option>{bands.map(band => <option key={band.id} value={band.id}>{band.name}</option>)}</Select>}
    </ModalBody>
    <ModalFooter><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => { try { if (!serviceId) throw new Error('Choose a service.'); if (isBand && bandAction === 'existing' && !bandId) throw new Error('Choose a band.'); if (isBand && bandAction === 'new') { onCreateBand?.(); return }; onSave({ type: isBand ? 'band' : type, serviceId, bandId: isBand && bandAction === 'existing' ? bandId : '' }) } catch (cause) { setError((cause as Error).message) } }}>{isBand && bandAction === 'new' ? 'Continue to create band' : 'Create opportunities'}</Button></ModalFooter>
  </Modal>
}