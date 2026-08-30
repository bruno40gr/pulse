import { redirect } from 'next/navigation'

export default async function LeadRedirectPage(
  { params }: { params: Promise<{ id: string }> }
) {
  await params
  redirect('/leads')
}
