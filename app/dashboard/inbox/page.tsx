import { Suspense } from 'react'
import Conversations from '@/components/inbox/Conversations'
import { isConversationEmailPreview } from '@/lib/conversations-preview'
import { CommunicationsSkeleton } from '@/components/inbox/CommunicationsSkeleton'

export default function InboxPage() {
  const emailPreview = isConversationEmailPreview({ databaseUrl: process.env.CRM_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, deployment: process.env.VERCEL_ENV })
  return <Suspense fallback={<CommunicationsSkeleton />}><Conversations emailPreview={emailPreview} /></Suspense>
}
