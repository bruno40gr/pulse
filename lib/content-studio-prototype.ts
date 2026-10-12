import { canonicalCommunityUrl } from './community-posts'

export type ContentKind = 'event' | 'deadline' | 'announcement' | 'article' | 'social'
export type StudioDraft = {
  id: string
  kind: ContentKind
  status: 'draft' | 'published' | 'archived'
  title: string
  summary: string
  body: string
  date: string
  time: string
  location: string
  expires: string
  category: string
  credit: string
  image: string
  imageAlt: string
  artworkImage?: string
  artworkAlt?: string
  imageLayout?: 'separate' | 'overlay'
  artwork: 'template' | 'upload'
  output: 'digital' | 'print'
  template: 'crimson' | 'teal' | 'yellow'
  ctaLabel: string
  ctaUrl: string
  socialUrl: string
  permission: boolean
  featured: boolean
  publishedAt: string
  includeLogo?: boolean
  eventTheme?: EventTheme | 'auto'
  posterLayout?: 'stage' | 'instruments' | 'portrait' | 'ensemble' | 'workshop'
  designId?: EventTheme
  styleReferences?: { name: string; image: string }[]
}

export type EventTheme = 'showcase' | 'camp' | 'open-mic' | 'concert' | 'songwriting'
export const eventThemes: { id: EventTheme; label: string; layout: NonNullable<StudioDraft['posterLayout']>; background: string; foreground: string }[] = [
  { id: 'showcase', label: 'Student showcase', layout: 'stage', background: '#171717', foreground: '#FFFFFF' },
  { id: 'camp', label: 'Band camp', layout: 'instruments', background: '#DCFA38', foreground: '#111111' },
  { id: 'open-mic', label: 'Open mic', layout: 'portrait', background: '#111111', foreground: '#FFFFFF' },
  { id: 'concert', label: 'Community concert', layout: 'ensemble', background: '#FF701C', foreground: '#111111' },
  { id: 'songwriting', label: 'Songwriting workshop', layout: 'workshop', background: '#8CD8FA', foreground: '#111111' },
]

export function suggestedEventTheme(title: string, summary = ''): EventTheme {
  const text = `${title} ${summary}`.toLowerCase()
  if (/songwrit|compos|lyric/.test(text)) return 'songwriting'
  if (/open[ -]?mic|jam session/.test(text)) return 'open-mic'
  if (/camp/.test(text)) return 'camp'
  if (/concert|rocklin|community show/.test(text)) return 'concert'
  return 'showcase'
}

export function eventTreatment(draft: StudioDraft) {
  const theme = draft.designId || (!draft.eventTheme || draft.eventTheme === 'auto' ? suggestedEventTheme(draft.title, draft.summary) : draft.eventTheme)
  return eventThemes.find(item => item.id === theme) || eventThemes[0]
}

export const eventTimes = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2)
  const minute = index % 2 ? '30' : '00'
  return { value: `${String(hour).padStart(2, '0')}:${minute}`, label: `${hour % 12 || 12}:${minute} ${hour < 12 ? 'AM' : 'PM'}` }
})

export function posterLogoFilter(foreground: string) {
  return foreground === '#FFFFFF' ? 'brightness(0) invert(1)' : 'brightness(0)'
}

export const contentKinds: { kind: ContentKind; label: string; description: string }[] = [
  { kind: 'event', label: 'Event', description: 'Recitals, concerts, and academy gatherings.' },
  { kind: 'deadline', label: 'Deadline', description: 'Registration dates and things families need to act on.' },
  { kind: 'announcement', label: 'Announcement', description: 'A front-desk notice or news for our families.' },
  { kind: 'article', label: 'Article', description: 'An image-led story from around Headliner.' },
  { kind: 'social', label: 'Social post', description: 'Curate an Instagram or TikTok post.' },
]

export function newStudioDraft(kind: ContentKind): StudioDraft {
  return { id: crypto.randomUUID(), kind, status: 'draft', title: '', summary: '', body: '', date: '', time: '', location: '', expires: '', category: '', credit: '', image: '', imageAlt: '', artwork: 'template', output: 'digital', template: 'crimson', ctaLabel: '', ctaUrl: '', socialUrl: '', permission: false, featured: false, publishedAt: '', includeLogo: true, imageLayout: 'separate' }
}

export function studioSteps(kind: ContentKind) {
  return [`${contentKinds.find(item => item.kind === kind)!.label} Details`, 'Design', 'Publish']
}

export function studioStepErrors(draft: StudioDraft, step: number): string[] {
  const banner = ['event', 'deadline', 'announcement'].includes(draft.kind)
  if (step === 0) {
    const details = { ...draft, artwork: 'template' as const, image: '', artworkImage: '' }
    return publishErrors(details).filter(error => error !== 'Supply an article image; articles do not use templates.')
  }
  if (banner && draft.artwork === 'upload') {
    if (!(draft.artworkImage ?? draft.image)) return ['Upload artwork or choose a template.']
    return (draft.artworkAlt ?? draft.imageAlt).trim() ? [] : ['Describe the image for accessibility.']
  }
  if (draft.kind === 'article' && !draft.image) return ['Supply an article image; articles do not use templates.']
  return draft.image && !draft.imageAlt.trim() ? ['Describe the image for accessibility.'] : []
}

export function placements(draft: StudioDraft): string[] {
  if (draft.kind === 'article') return ['Around Headliner', 'Full story page']
  if (draft.kind === 'social') return draft.featured ? ['From Our Community'] : ['Community library']
  return draft.kind === 'announcement' ? ['Bulletin Board'] : ['Calendar', 'Bulletin Board']
}

export function safeCta(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch { return false }
}

export function publishErrors(draft: StudioDraft, featuredCount = 0): string[] {
  const errors: string[] = []
  if (!draft.title.trim()) errors.push('Add a title.')
  if (draft.kind === 'event' || draft.kind === 'deadline') {
    const date = new Date(`${draft.date}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== draft.date) errors.push('Add a valid calendar date.')
    if (draft.kind === 'event' && !eventTimes.some(option => option.value === draft.time)) errors.push('Choose an event time.')
  }
  if (draft.kind === 'article') {
    if (!draft.body.trim()) errors.push('Write the article body.')
    if (!draft.image) errors.push('Supply an article image; articles do not use templates.')
  }
  const banner = ['event', 'deadline', 'announcement'].includes(draft.kind)
  const image = banner && draft.artwork === 'upload' ? draft.artworkImage ?? draft.image : draft.image
  const imageAlt = banner && draft.artwork === 'upload' ? draft.artworkAlt ?? draft.imageAlt : draft.imageAlt
  if (draft.artwork === 'upload' && !image && banner) errors.push('Upload artwork or choose a template.')
  if (image && !imageAlt.trim()) errors.push('Describe the image for accessibility.')
  if (draft.kind === 'article' && (draft.ctaLabel.trim() || draft.ctaUrl.trim())) {
    if (!draft.ctaLabel.trim() || !safeCta(draft.ctaUrl)) errors.push('Provide both CTA text and a full HTTPS destination.')
  }
  if (draft.kind === 'social') {
    try { canonicalCommunityUrl(draft.socialUrl) } catch (error) { errors.push((error as Error).message) }
    if (!draft.permission) errors.push('Confirm permission to feature this social post.')
    if (draft.featured && featuredCount >= 4) errors.push('The homepage has four social selections. Remove one first.')
  }
  return errors
}