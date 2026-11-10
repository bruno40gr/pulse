import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import SchoolSetup from './SchoolSetup'

export const metadata = { title: 'School Setup · Odeon preview', robots: { index: false, follow: false } }

export default async function SchoolSetupPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { tenant } = await searchParams
  const url = new URL('http://school-setup.internal/content-studio-prototype/school-setup')
  if (tenant) url.searchParams.set('tenant', tenant)
  const access = await authorizeTenantRequest(new Request(url, { headers: await headers() }))
  if (!access.ok || !access.context || !['owner', 'admin'].includes(access.context.roleKey)) redirect('/dashboard/settings')
  return <SchoolSetup key={`${access.tenantId}:${access.context.personId}`} />
}