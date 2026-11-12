/** Link attachments for student notes: video, document, media or generic links. */
export type NoteLinkKind = 'youtube' | 'pdf' | 'media' | 'link'

export type NoteAttachment = {
  url: string
  title?: string
  kind?: NoteLinkKind
}

/** Stand-in for the academy's hosted curriculum PDF (swap for the real hosted asset when available). */
export const CURRICULUM_LINK: NoteAttachment = {
  url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  title: 'Piano Foundations · Curriculum',
  kind: 'pdf',
}

export function noteLinkKind(url: string): NoteLinkKind {
  const value = url.toLowerCase()
  if (/youtube\.com|youtu\.be/.test(value)) return 'youtube'
  if (/\.pdf(\?|#|$)/.test(value)) return 'pdf'
  if (/\.(png|jpe?g|gif|webp|avif|svg|mp4|mov|webm|mp3|wav)(\?|#|$)/.test(value) || /vimeo\.com|loom\.com|soundcloud\.com/.test(value)) return 'media'
  return 'link'
}

export function youtubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/)
  return match ? match[1] : null
}

export function toNoteAttachment(url: string): NoteAttachment {
  const trimmed = url.trim()
  return { url: trimmed, kind: noteLinkKind(trimmed) }
}

export function noteAttachmentLabel(link: NoteAttachment): string {
  if (link.title) return link.title
  return noteAttachmentSource(link)
}

export function noteAttachmentSource(link: NoteAttachment): string {
  try { return new URL(link.url).hostname.replace(/^www\./, '') } catch { return link.url }
}

export function noteAttachmentKindLabel(link: NoteAttachment): string {
  const kind = link.kind || noteLinkKind(link.url)
  return kind === 'youtube' ? 'YouTube' : kind === 'pdf' ? 'PDF' : kind === 'media' ? 'Media' : noteAttachmentSource(link)
}
