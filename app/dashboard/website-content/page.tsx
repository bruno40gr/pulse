import ContentStudio from '@/app/content-studio-prototype/ContentStudio'
import { Oswald } from 'next/font/google'

const posterFont = Oswald({ subsets: ['latin'], weight: ['700'], variable: '--font-poster' })

export const metadata = { title: 'Website Content', robots: { index: false, follow: false } }

export default function WebsiteContentPage() {
  return <div className={posterFont.variable}><ContentStudio connected /></div>
}