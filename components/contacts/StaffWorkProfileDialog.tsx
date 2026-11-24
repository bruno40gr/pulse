'use client'

import { useEffect, useId, useState } from 'react'
import { Modal, ModalHeader, ModalBody } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import TeacherEditor from '@/beta-source/app/content-studio-prototype/school-setup/TeacherEditor'
import type { SetupRecord } from '@/beta-source/app/content-studio-prototype/school-setup/setup-content'
import { staffTeachingLevels } from '@/beta-source/lib/staff-work-profile'
import { spacing } from '@/lib/tokens'

type Profile = { revision: number; record: SetupRecord; setup: Record<string, SetupRecord[]> }

export default function StaffWorkProfileDialog({ tenantId, personId, onClose }: { tenantId: string; personId: string; onClose: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [conflict, setConflict] = useState(false)
  const formId = useId()
  const dirty = profile && JSON.stringify(values) !== JSON.stringify(profile.record.values)
  const endpoint = `/api/staff/work-profile?tenant=${encodeURIComponent(tenantId)}&person=${encodeURIComponent(personId)}`
  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const response = await fetch(endpoint, { signal: controller.signal, cache: 'no-store' })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Staff work profile could not be loaded.')
        if (!controller.signal.aborted) { setProfile(body); setValues(body.record.values) }
      } catch (cause) { if (!controller.signal.aborted) setError((cause as Error).message) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [endpoint])
  const close = () => { if (saving) return; if (dirty) setDiscard(true); else onClose() }
  return <>
    <Modal isOpen onClose={close} size="wide">
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <div style={{ flex: 1, minWidth: 0 }}><ModalHeader title={profile ? `${profile.record.values.name} · Qualifications & availability` : 'Qualifications & availability'} onClose={saving ? undefined : close} /></div>
        {profile && <Button type="submit" form={formId} style={{ marginRight: spacing.lg }} disabled={saving || conflict || !dirty}>{saving ? 'Saving…' : 'Save changes'}</Button>}
      </div>
      <ModalBody>
        {loading ? <LoadingSkeleton label="Loading staff work profile" /> : <>
          {error && <Notice variant="error">{error}</Notice>}
          {saved && <Notice variant="success">Staff work profile saved.</Notice>}
          {profile && <form id={formId} onSubmit={async event => {
            event.preventDefault()
            if (saving || conflict) return
            setSaving(true); setError(''); setSaved(false)
            try {
              const response = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: profile.revision, values }) })
              const body = await response.json()
              if (!response.ok) { if (response.status === 409) setConflict(true); throw new Error(body.error || 'Staff changes were not saved.') }
              if (!Number.isSafeInteger(body?.revision) || body.revision !== profile.revision + 1) throw new Error('The server did not confirm the saved revision. Close and reopen this profile before retrying.')
              setProfile({ ...profile, revision: body.revision, record: { ...profile.record, values } }); setSaved(true)
            } catch (cause) { setError((cause as Error).message) }
            finally { setSaving(false) }
          }}>
            {!profile.setup.services.length && <Notice>No teaching services are configured for this school. You can save availability now; no qualifications will be assumed.</Notice>}
            {!profile.setup.locations.length && <Notice>No school locations are configured. Availability can be saved, but location-based bookings require School Setup.</Notice>}
            <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
              <TeacherEditor workOnly values={values} services={profile.setup.services} locations={profile.setup.locations} levels={staffTeachingLevels(profile.setup)} bookingDefaults={profile.setup.policies[0]?.values} onChange={next => { setValues(next); setSaved(false) }} />
            </fieldset>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xl }}>
              <Button type="button" variant="secondary" onClick={close} disabled={saving}>Close</Button>
            </div>
          </form>}
        </>}
      </ModalBody>
    </Modal>
    <Modal isOpen={discard} onClose={() => setDiscard(false)} size="sm">
      <ModalHeader title="Discard staff changes?" onClose={() => setDiscard(false)} />
      <ModalBody><p>Your unsaved changes will be discarded.</p><div style={{ display: 'flex', gap: spacing.sm }}><Button onClick={() => setDiscard(false)}>Keep editing</Button><Button variant="secondary" onClick={onClose}>Discard changes</Button></div></ModalBody>
    </Modal>
  </>
}