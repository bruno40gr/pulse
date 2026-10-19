import { Suspense } from 'react'
import Conversations from '@/components/inbox/Conversations'
import { isConversationEmailPreview } from '@/lib/conversations-preview'

export default function InboxPage() {
  const emailPreview = isConversationEmailPreview({ databaseUrl: process.env.CRM_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, deployment: process.env.VERCEL_ENV })
  return <Suspense fallback={<p>Loading conversations…</p>}><Conversations emailPreview={emailPreview} /></Suspense>
}
