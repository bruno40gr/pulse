import { redirect } from 'next/navigation'

export default async function AccessManagementPage() {
  redirect('/dashboard/settings')
}