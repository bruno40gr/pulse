import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { authorizeTenantRequest } from '@/lib/tenant-request'

export const metadata = { title: 'Odeon preview', robots: { index: false, follow: false } }

export default async function Page({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { tenant } = await searchParams
  const url = new URL('http://odeon-preview.internal/content-studio-prototype/odeon')
  if (tenant) url.searchParams.set('tenant', tenant)
  const access = await authorizeTenantRequest(new Request(url, { headers: await headers() }))
  if (!access.ok || !access.context || !['owner', 'admin'].includes(access.context.roleKey)) redirect('/dashboard/settings')
  const destination = new URL('/dashboard/contacts', url)
  if (tenant) destination.searchParams.set('tenant', tenant)
  redirect(destination.pathname + destination.search)
}