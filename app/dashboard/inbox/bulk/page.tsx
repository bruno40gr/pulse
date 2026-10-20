import { Suspense } from 'react'
import BulkMessageWorkspace from '@/components/inbox/BulkMessageWorkspace'

export default function BulkMessagePage() {
  return <Suspense fallback={<p>Loading conversations…</p>}><BulkMessageWorkspace /></Suspense>
}