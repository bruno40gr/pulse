import { notFound } from 'next/navigation'
import SettingsClient from '../SettingsClient'

const sections = ['integrations', 'brand', 'roles', 'permissions'] as const

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const match = sections.find(item => item === section)
  if (!match) notFound()
  return <SettingsClient key={match} section={match} />
}