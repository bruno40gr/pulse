import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import StudentPreview from './StudentPreview'

export const metadata = { title: 'Students · Odeon preview', robots: { index: false, follow: false } }

export default async function StudentPreviewPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { tenant } = await searchParams
  const url = new URL('http://student-preview.internal/content-studio-prototype/students')
  if (tenant) url.searchParams.set('tenant', tenant)
  const access = await authorizeTenantRequest(new Request(url, { headers: await headers() }))
  if (!access.ok || !access.context || !['owner', 'admin'].includes(access.context.roleKey)) redirect('/dashboard/settings')
  return <StudentPreview key={`${access.tenantId}:${access.context.personId}`} />
}