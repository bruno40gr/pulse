import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { Suspense } from 'react'
import BulkMessageWorkspace from '@/components/inbox/BulkMessageWorkspace'

export default function BulkMessagePage() {
  return <Suspense fallback={<LoadingSkeleton label="Loading conversations" />}><BulkMessageWorkspace /></Suspense>
}