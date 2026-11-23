'use client'

import { useState } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import TeacherEditor from '@/beta-source/app/content-studio-prototype/school-setup/TeacherEditor'
import type { SetupRecord } from '@/beta-source/app/content-studio-prototype/school-setup/setup-content'
import type { BookingContext } from '@/beta-source/lib/academy-calendar-booking'
import { staffTeachingLevels, staffWorkProfileError } from '@/beta-source/lib/staff-work-profile'
import { spacing } from '@/lib/tokens'

export default function StaffWorkProfile({ record, context, today, onSave, onClose, onAssign }: {
  record: SetupRecord; context: BookingContext; today: string
  onSave: (record: SetupRecord) => void; onClose: () => void; onAssign: (id: string) => void
}) {
  const [values, setValues] = useState(() => ({ ...record.values }))
  const [error, setError] = useState('')
  const dirty = JSON.stringify(values) !== JSON.stringify(record.values)
  const leave = () => { if (!dirty || window.confirm('Discard unsaved staff changes?')) onClose() }
  return <PageContainer>
    <PageHeader title={record.values.name || 'Add staff member'} onBack={leave} backLabel="Back to staff profile" right={<div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
      <Button variant="secondary" onClick={leave}>Cancel</Button>
      <Button type="submit" form="staff-work-profile">Save changes</Button>
    </div>} />
    {error && <Notice variant="error">{error}</Notice>}
    <form id="staff-work-profile" onSubmit={event => {
      event.preventDefault()
      const next = { ...record, values }
      const message = staffWorkProfileError(context, next, today)
      if (message) { setError(message); return }
      onSave(next)
    }}>
      <TeacherEditor values={values} services={context.setup.services} locations={context.setup.locations} levels={staffTeachingLevels(context.setup)} bookingDefaults={context.setup.policies[0]?.values} onChange={next => { setValues(next); setError('') }} />
    </form>
    {record.values.canPerformAdmin === 'yes' && <Button variant="secondary" style={{ marginTop: spacing.lg }} onClick={() => { if (dirty) { setError('Save or discard your staff changes before assigning administrative time.'); return } onAssign(record.id) }}>Assign administrative time</Button>}
  </PageContainer>
}