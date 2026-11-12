import DemoWorkspace from '@/beta-source/app/odeon-demo/DemoWorkspace'
import { Suspense } from 'react'

export const metadata = { title: 'Odeon · School onboarding sandbox', robots: { index: false, follow: false } }

export default function Page() { return <Suspense fallback={null}><DemoWorkspace onboarding /></Suspense> }