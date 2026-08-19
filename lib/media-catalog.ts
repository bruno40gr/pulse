import { DEFAULT_TENANT } from '@/lib/tenant'

export type MediaKind = 'approved_image' | 'gif'

export interface MediaAsset {
  id: string
  tenantId: string
  kind: MediaKind
  title: string
  url: string
  thumbnailUrl?: string
  category: string
  tags: string[]
  source: 'seeded'
  lightweight?: boolean
  schoolAppropriate?: boolean
}

export interface MediaSuggestionResponse {
  approvedImages: MediaAsset[]
  suggestedGifs: MediaAsset[]
  detectedVibes: string[]
  shouldAutoShowMedia: boolean
  shouldShowThumbnails: boolean
}

export type MessageIntent = 'risk' | 'opportunity' | 'milestone' | 'nudge' | 'neutral'

const SACRAMENTO_MARTIAL_ARTS = '00000000-0000-0000-0000-000000000002'
const KUMON = '00000000-0000-0000-0000-000000000003'

const APPROVED_IMAGES: MediaAsset[] = [
  {
    id: 'kumon-classroom-progress',
    tenantId: KUMON,
    kind: 'approved_image',
    title: 'Worksheet progress moment',
    url: 'https://res.cloudinary.com/diy08lj9x/image/upload/v1787090428/Screenshot_2026-08-18_at_2.58.08_PM_cspt5h.png',
    category: 'progress',
    tags: ['kumon', 'progress', 'worksheet', 'student'],
    source: 'seeded',
    schoolAppropriate: true,
  },
  {
    id: 'kumon-study-table',
    tenantId: KUMON,
    kind: 'approved_image',
    title: 'Focused study session',
    url: 'https://res.cloudinary.com/diy08lj9x/image/upload/v1787090428/Screenshot_2026-08-18_at_2.58.19_PM_b4bwcx.png',
    category: 'study',
    tags: ['math', 'study', 'worksheet', 'progress'],
    source: 'seeded',
    schoolAppropriate: true,
  },
  {
    id: 'martial-arts-mat-lineup',
    tenantId: SACRAMENTO_MARTIAL_ARTS,
    kind: 'approved_image',
    title: 'Mat lineup',
    url: 'https://res.cloudinary.com/diy08lj9x/image/upload/v1787090429/Screenshot_2026-08-18_at_2.57.24_PM_cciacq.png',
    category: 'milestone',
    tags: ['karate', 'belt', 'celebration', 'discipline'],
    source: 'seeded',
    schoolAppropriate: true,
  },
  {
    id: 'martial-arts-training-floor',
    tenantId: SACRAMENTO_MARTIAL_ARTS,
    kind: 'approved_image',
    title: 'Training floor',
    url: 'https://res.cloudinary.com/diy08lj9x/image/upload/v1787090428/Screenshot_2026-08-18_at_2.57.36_PM_gj6gie.png',
    category: 'training',
    tags: ['karate', 'dojo', 'training', 'encouragement'],
    source: 'seeded',
    schoolAppropriate: true,
  },
  {
    id: 'martial-arts-belt-focus',
    tenantId: SACRAMENTO_MARTIAL_ARTS,
    kind: 'approved_image',
    title: 'Belt focus',
    url: 'https://res.cloudinary.com/diy08lj9x/image/upload/v1787090428/Screenshot_2026-08-18_at_2.57.51_PM_l0bnpl.png',
    category: 'achievement',
    tags: ['karate', 'belt', 'promotion', 'student'],
    source: 'seeded',
    schoolAppropriate: true,
  },
  {
    id: 'headliner-recital-stage',
    tenantId: DEFAULT_TENANT,
    kind: 'approved_image',
    title: 'Recital stage moment',
    url: 'https://res.cloudinary.com/diy08lj9x/image/upload/v1787090429/Screenshot_2026-08-18_at_2.59.41_PM_exk6f3.png',
    category: 'progress',
    tags: ['headliner', 'music', 'recital', 'progress'],
    source: 'seeded',
    schoolAppropriate: true,
  },
  {
    id: 'headliner-lesson-moment',
    tenantId: DEFAULT_TENANT,
    kind: 'approved_image',
    title: 'Lesson room moment',
    url: 'https://res.cloudinary.com/diy08lj9x/image/upload/v1787090428/Screenshot_2026-08-18_at_2.59.10_PM_l6lvnz.png',
    category: 'encouragement',
    tags: ['headliner', 'music', 'lesson', 'student'],
    source: 'seeded',
    schoolAppropriate: true,
  },
]

const GIFS: MediaAsset[] = [
  {
    id: 'gif-celebrate-confetti',
    tenantId: DEFAULT_TENANT,
    kind: 'gif',
    title: 'Soft confetti celebration',
    url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    category: 'celebration',
    tags: ['celebration', 'win', 'birthday', 'milestone'],
    source: 'seeded',
    lightweight: true,
    schoolAppropriate: true,
  },
  {
    id: 'gif-encouragement-thumbs-up',
    tenantId: DEFAULT_TENANT,
    kind: 'gif',
    title: 'Encouraging thumbs up',
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
    category: 'encouragement',
    tags: ['encouragement', 'progress', 'support'],
    source: 'seeded',
    lightweight: true,
    schoolAppropriate: true,
  },
  {
    id: 'gif-promo-sparkle',
    tenantId: DEFAULT_TENANT,
    kind: 'gif',
    title: 'Simple sparkle',
    url: 'https://media.giphy.com/media/3o7TKtnuHOHHUjR38Y/giphy.gif',
    category: 'promotional',
    tags: ['promo', 'special', 'announcement'],
    source: 'seeded',
    lightweight: true,
    schoolAppropriate: true,
  },
]

const VIBE_KEYWORDS: Record<string, string[]> = {
  celebration: ['celebrate', 'congrats', 'congratulations', 'birthday', 'milestone', 'belt', 'recital', 'great job'],
  encouragement: ['missed', 'come back', 'support', 'progress', 'keep going', 'we noticed', 'attendance'],
  reminder: ['reminder', 'today', 'tomorrow', 'upcoming', 'class', 'lesson'],
  promotional: ['offer', 'special', 'enroll', 'signup', 'promo', 'summer', 'trial'],
}

function scoreAsset(asset: MediaAsset, context: string) {
  const haystack = context.toLowerCase()
  return asset.tags.reduce((score, tag) => score + (haystack.includes(tag) ? 2 : 0), 0) + (haystack.includes(asset.category) ? 3 : 0)
}

export function detectVibes(input: string): string[] {
  const haystack = input.toLowerCase()
  const matches = Object.entries(VIBE_KEYWORDS)
    .map(([vibe, keywords]) => ({
      vibe,
      score: keywords.reduce((sum, keyword) => sum + (haystack.includes(keyword) ? 1 : 0), 0),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.vibe)

  return matches.length ? matches.slice(0, 2) : ['encouragement']
}

export function getApprovedImagesForTenant(tenantId: string): MediaAsset[] {
  const tenantMatches = APPROVED_IMAGES.filter(asset => asset.tenantId === tenantId)
  return tenantMatches.length ? tenantMatches : APPROVED_IMAGES.filter(asset => asset.tenantId === DEFAULT_TENANT)
}

export function getMediaSuggestions(params: {
  tenantId: string
  message?: string
  context?: string
  source?: 'insight' | 'scratch' | 'manual'
  intent?: MessageIntent
}): MediaSuggestionResponse {
  const combined = [params.context, params.message, params.source].filter(Boolean).join(' · ')
  const detectedVibes = detectVibes(combined)
  const intent = params.intent || 'neutral'
  const shouldAutoShowMedia = intent === 'milestone' || intent === 'opportunity'
  const shouldShowThumbnails = shouldAutoShowMedia

  const approvedImages = getApprovedImagesForTenant(params.tenantId)
    .sort((a, b) => scoreAsset(b, combined) - scoreAsset(a, combined))

  const suggestedGifs = GIFS
    .filter(asset => asset.schoolAppropriate && asset.lightweight)
    .sort((a, b) => {
      const vibeBoostA = detectedVibes.includes(a.category) ? 4 : 0
      const vibeBoostB = detectedVibes.includes(b.category) ? 4 : 0
      return scoreAsset(b, combined) + vibeBoostB - scoreAsset(a, combined) - vibeBoostA
    })

  return {
    approvedImages,
    suggestedGifs,
    detectedVibes,
    shouldAutoShowMedia,
    shouldShowThumbnails,
  }
}