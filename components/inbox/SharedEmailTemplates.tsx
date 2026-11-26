'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Notice } from '@/components/ui'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import PrototypeEmailTemplates from './PrototypeEmailTemplates'
import type { TemplateProps } from './PrototypeTemplates'
import type { SharedEmailTemplate } from '@/lib/shared-email-template'

/** Every opening reads the same server library; preview/sample composers never mount this component. */
export default function SharedEmailTemplates({ tenantId, ...props }: Omit<TemplateProps, 'templates' | 'onCreate'> & { tenantId: string }) {
  const [templates, setTemplates] = useState<SharedEmailTemplate[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [canManage, setCanManage] = useState(false)
  const [revision, setRevision] = useState(0)
  const mounted = useRef(true)
  const endpoint = `/api/conversations/templates?tenant=${encodeURIComponent(tenantId)}`
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function load(signal?: AbortSignal) {
    const response = await fetch(endpoint, { signal, cache: 'no-store' })
    const result = await response.json()
    if (!response.ok || !Array.isArray(result.templates)) throw new Error(result.error || 'Could not load shared templates.')
    if (!mounted.current || signal?.aborted) return
    setTemplates(result.templates); setCanManage(result.can_manage === true); setError(''); setReady(true)
  }
  useEffect(() => {
    const controller = new AbortController()
    setReady(false); setError(''); setTemplates([])
    void load(controller.signal).catch(cause => { if (!controller.signal.aborted) { setError(cause.message); setReady(true) } })
    return () => controller.abort()
    // Each tenant or explicit retry gets an independently cancellable request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, revision])
  async function save(method: string, template: { id: string; name?: string; subject?: string; body?: string }) {
    const current = templates.find(row => row.id === template.id)
    const response = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...template, version: current?.version ?? 0 }) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Could not save shared template.')
    try { await load() } catch { setError('Saved. Reload templates to continue.'); setCanManage(false) }
  }
  if (!ready) return <LoadingSkeleton label="Loading shared email templates" rows={2} />
  if (error && templates.length === 0) return <Notice variant="error">{error}<Button variant="secondary" onClick={() => setRevision(value => value + 1)}>Retry</Button></Notice>
  return <>
    {error && <Notice variant="error">{error}<Button variant="secondary" onClick={() => setRevision(value => value + 1)}>Reload library</Button></Notice>}
    <PrototypeEmailTemplates {...props} channel="email" templates={templates} canManage={canManage}
      onOpen={async () => { await load() }}
      onCreate={template => save('POST', template)} onEdit={template => save('PUT', template)} onRemove={template => save('DELETE', template)} />
  </>
}