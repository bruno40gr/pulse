import { notFound } from 'next/navigation'
import ContentStudio from '@/app/content-studio-prototype/ContentStudio'
import { websiteViews } from '@/lib/work-area-navigation'

export const metadata = { title: 'Website Content', robots: { index: false, follow: false } }

export default async function WebsiteContentViewPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params
  const match = websiteViews.find(item => item.slug === view)
  if (!match) notFound()
  return <ContentStudio key={match.kind} connected contentKind={match.kind} />
}