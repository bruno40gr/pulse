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
    id: 'kumon-achievement-stars',
    tenantId: KUMON,
    kind: 'approved_image',
    title: 'Achievement stars',
    url: '/brand-assets/kumon-achievement-stars.svg',
    category: 'achievement',
    tags: ['math', 'achievement', 'celebration', 'student'],
    source: 'seeded',
    schoolAppropriate: true,
  },
  {
    id: 'kumon-study-session',
    tenantId: KUMON,
    kind: 'approved_image',
    title: 'Study session',
    url: '/brand-assets/kumon-study-session.svg',
    category: 'study',
    tags: ['math', 'study', 'worksheet', 'progress'],
    source: 'seeded',
    schoolAppropriate: true,
  },
  {
    id: 'martial-arts-belt-pride',
    tenantId: SACRAMENTO_MARTIAL_ARTS,
    kind: 'approved_image',
    title: 'Belt pride',
    url: '/brand-assets/martial-arts-belt-pride.svg',
    category: 'milestone',
    tags: ['karate', 'belt', 'celebration', 'discipline'],
    source: 'seeded',
    schoolAppropriate: true,
  },
  {
    id: 'martial-arts-dojo-night',
    tenantId: SACRAMENTO_MARTIAL_ARTS,
    kind: 'approved_image',
    title: 'Dojo night',
    url: '/brand-assets/martial-arts-dojo-night.svg',
    category: 'training',
    tags: ['karate', 'dojo', 'training', 'encouragement'],
    source: 'seeded',
    schoolAppropriate: true,
  },
  {
    id: 'generic-academy-progress',
    tenantId: DEFAULT_TENANT,
    kind: 'approved_image',
    title: 'Student progress moment',
    url: '/brand-assets/generic-academy-progress.svg',
    category: 'progress',
    tags: ['school', 'progress', 'student', 'encouragement'],
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

  const approvedImages = shouldShowThumbnails
    ? getApprovedImagesForTenant(params.tenantId)
        .sort((a, b) => scoreAsset(b, combined) - scoreAsset(a, combined))
    : []

  const suggestedGifs = shouldShowThumbnails
    ? GIFS
        .filter(asset => asset.schoolAppropriate && asset.lightweight)
        .sort((a, b) => {
          const vibeBoostA = detectedVibes.includes(a.category) ? 4 : 0
          const vibeBoostB = detectedVibes.includes(b.category) ? 4 : 0
          return scoreAsset(b, combined) + vibeBoostB - scoreAsset(a, combined) - vibeBoostA
        })
    : []

  return {
    approvedImages,
    suggestedGifs,
    detectedVibes,
    shouldAutoShowMedia,
    shouldShowThumbnails,
  }
}