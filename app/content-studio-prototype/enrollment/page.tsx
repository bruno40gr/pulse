import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import EnrollmentHub from './EnrollmentHub'

export const metadata = { title: 'Enrollment · Odeon', robots: { index: false, follow: false } }

export default async function EnrollmentPage({ searchParams }: { searchParams: Promise<{ tenant?: string; mock?: string }> }) {
  const { tenant, mock: mockParam } = await searchParams
  const mock = process.env.NODE_ENV === 'development' && mockParam !== '0'
  const url = new URL('http://enrollment.internal/content-studio-prototype/enrollment')
  if (tenant) url.searchParams.set('tenant', tenant)
  const access = await authorizeTenantRequest(new Request(url, { headers: await headers() }))
  if (!access.ok || !access.context || !['owner', 'admin'].includes(access.context.roleKey)) redirect('/dashboard/settings')
  return <EnrollmentHub key={`${access.tenantId}:${access.context.personId}:${mock}`} storageScope={`${access.tenantId}:${access.context.personId}`} tenantId={access.tenantId} mock={mock} />
}