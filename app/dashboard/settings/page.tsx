import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  const section = typeof query.tab === 'string' ? query.tab : ''
  if (['integrations', 'brand', 'roles', 'permissions'].includes(section)) {
    const retained = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (key === 'tab' || value === undefined) continue
      for (const item of Array.isArray(value) ? value : [value]) retained.append(key, item)
    }
    redirect(`/dashboard/settings/${section}${retained.size ? `?${retained}` : ''}`)
  }
  return <SettingsClient section="account" />
}