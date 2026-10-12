export type CommunityPost = {
  id: string
  platform: 'Instagram' | 'TikTok'
  original_url: string
  status: 'inbox' | 'approved' | 'archived'
  permission_notes: string
  permission_confirmed: boolean
  homepage_order: number | null
  created_at: string
}

export type CommunityWorkspace = { revision: number; posts: CommunityPost[] }

export function canonicalCommunityUrl(value: unknown): { platform: CommunityPost['platform']; url: string } {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Enter a valid Instagram or TikTok post URL.')
  let url: URL
  try { url = new URL(value.trim()) } catch { throw new Error('Enter a full HTTPS post URL.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Only HTTPS social post URLs are accepted.')
  const host = url.hostname.toLowerCase()
  if (['instagram.com', 'www.instagram.com'].includes(host)) {
    const match = url.pathname.match(/^\/(p|reel)\/([A-Za-z0-9_-]+)\/?$/)
    if (match) return { platform: 'Instagram', url: `https://www.instagram.com/${match[1]}/${match[2]}/` }
  }
  if (['tiktok.com', 'www.tiktok.com'].includes(host)) {
    const match = url.pathname.match(/^\/@([A-Za-z0-9_.]+)\/video\/(\d{15,25})\/?$/)
    if (match) return { platform: 'TikTok', url: `https://www.tiktok.com/@${match[1]}/video/${match[2]}` }
  }
  throw new Error('Use a direct Instagram post/reel or TikTok video URL, not a profile or short link.')
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function communityCommand(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid request.')
  const input = body as Record<string, unknown>
  if (!Number.isSafeInteger(input.revision) || (input.revision as number) < 0) throw new Error('Reload the workspace before saving.')
  if (input.action === 'add') {
    const post = canonicalCommunityUrl(input.url)
    return { action: 'add', revision: input.revision as number, data: { platform: post.platform, original_url: post.url } }
  }
  if (input.action === 'review') {
    if (typeof input.id !== 'string' || !uuid.test(input.id) || !['inbox', 'approved', 'archived'].includes(String(input.status))) throw new Error('Invalid post review.')
    if (typeof input.permission_notes !== 'string' || input.permission_notes.length > 4000 || typeof input.permission_confirmed !== 'boolean') throw new Error('Invalid permission review.')
    if (input.status === 'approved' && (!input.permission_confirmed || !input.permission_notes.trim())) throw new Error('Approval requires confirmed permission and review notes.')
    return { action: 'review', revision: input.revision as number, data: { id: input.id, status: input.status, permission_notes: input.permission_notes.trim(), permission_confirmed: input.permission_confirmed } }
  }
  if (input.action === 'homepage') {
    if (!Array.isArray(input.ids) || input.ids.length > 4 || input.ids.some(id => typeof id !== 'string' || !uuid.test(id)) || new Set(input.ids).size !== input.ids.length) throw new Error('Select up to four different approved posts.')
    return { action: 'homepage', revision: input.revision as number, data: { ids: input.ids } }
  }
  throw new Error('Unsupported community action.')
}