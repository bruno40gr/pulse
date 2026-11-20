import DemoWorkspace from '@/beta-source/app/odeon-demo/DemoWorkspace'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import LocalBandReview from '@/beta-source/app/content-studio-prototype/event-explorer/LocalBandReview'

export const metadata = { title: 'Odeon · Sample school', description: 'Fictional school sandbox. No live records or payments.', robots: { index: false, follow: false } }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  if (params.bandReview === '1') {
    if (process.env.NODE_ENV !== 'development' || !process.env.LOCAL_BAND_REVIEW_DIR || params.tenant || params.screen !== 'groups') notFound()
    const host = (await headers()).get('host') || ''
    if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(host)) notFound()
    return <Suspense fallback={null}><LocalBandReview /></Suspense>
  }
  return <Suspense fallback={null}><DemoWorkspace /></Suspense>
}