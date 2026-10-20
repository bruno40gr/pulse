'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Notice, PageContainer, PageHeader, SurfacePanel } from '@/components/ui'
import { getActiveTenantId } from '@/lib/tenant'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { spacing } from '@/lib/tokens'
import ContactBulkComposer from './ContactBulkComposer'

type Selection = { tenantId: string; contactIds: string[]; channel: 'sms' | 'email' }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function BulkMessageWorkspace() {
  const router = useRouter()
  const mobile = useMediaQuery('(max-width: 760px)')
  const params = useSearchParams()
  const id = params.get('selection') || ''
  const [selection, setSelection] = useState<Selection | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setSelection(null); setError('')
    try {
      const value = JSON.parse(sessionStorage.getItem(`pulse:bulk-selection:${id}`) || 'null')
      if (!uuid.test(id) || !value || value.tenantId !== getActiveTenantId() || !uuid.test(value.tenantId) || !['sms', 'email'].includes(value.channel) || !Array.isArray(value.contactIds) || !value.contactIds.length || !value.contactIds.every((item: unknown) => typeof item === 'string' && uuid.test(item))) throw new Error('Invalid selection')
      setSelection(value)
    } catch { setError('This contact selection is unavailable. Return to Contacts and select the recipients again.') }
  }, [id])
  const close = () => router.push('/dashboard/inbox')
  return <PageContainer style={{ padding: mobile ? spacing.md : spacing['3xl'] }}>
    <PageHeader title={selection?.channel === 'email' ? 'Write an email' : 'Write a text message'} onBack={close} backLabel="Back to Conversations" />
    {error ? <><Notice variant="error">{error}</Notice><Button onClick={() => router.push('/dashboard/contacts')}>Back to Contacts</Button></> : selection ? <section aria-label="Bulk message composer" style={{ minWidth: 0 }}>
      <SurfacePanel padding="0" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, height: 'max(440px, calc(100dvh - 160px))', overflow: 'hidden' }}>
        <ContactBulkComposer key={id} {...selection} onClose={close} />
      </SurfacePanel>
    </section> : <p role="status">Loading selected contacts…</p>}
  </PageContainer>
}