import ContentStudio from './ContentStudio'
import { Oswald } from 'next/font/google'

const posterFont = Oswald({ subsets: ['latin'], weight: ['700'], variable: '--font-poster' })

export const metadata = { title: 'Content Studio · Pulse prototype', robots: { index: false, follow: false } }

export default function ContentStudioPrototypePage() {
  return <div className={posterFont.variable}><ContentStudio /></div>
}