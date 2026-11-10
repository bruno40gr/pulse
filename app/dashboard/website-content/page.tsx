import ContentStudio from '@/app/content-studio-prototype/ContentStudio'

export const metadata = { title: 'Website Content', robots: { index: false, follow: false } }

export default function WebsiteContentPage() {
  return <ContentStudio connected />
}