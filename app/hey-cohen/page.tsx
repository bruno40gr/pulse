import { redirect } from 'next/navigation'

export default function HeyCohenRedirectPage() {
  redirect('/dashboard')
}