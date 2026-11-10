import DemoWorkspace from './DemoWorkspace'
import { Suspense } from 'react'

export const metadata = { title: 'Odeon · Sample school', description: 'Fictional school sandbox. No live records or payments.', robots: { index: false, follow: false } }

export default function Page() { return <Suspense fallback={null}><DemoWorkspace /></Suspense> }