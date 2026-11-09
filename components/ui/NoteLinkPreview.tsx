'use client'

import { useState } from 'react'
import { FileText, Film, Link2, Play } from 'lucide-react'
import { colors, radius, spacing, typography } from '@/lib/tokens'
import { noteAttachmentKindLabel, noteAttachmentLabel, youtubeVideoId, type NoteAttachment } from '@/lib/note-links'

/** Rich preview for a link attached to a note: video thumbnail, PDF card, media or generic link. */
export function NoteLinkPreview({ link }: { link: NoteAttachment }) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  const kind = link.kind || 'link'
  const label = noteAttachmentLabel(link)
  const youtubeId = kind === 'youtube' ? youtubeVideoId(link.url) : null
  const iconColor = kind === 'pdf' ? colors.error : kind === 'media' ? colors.teal : colors.textSecondary
  return <a href={link.url} target="_blank" rel="noopener noreferrer"
    style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radius.lg, border: `1px solid ${colors.border}`, background: colors.surface, textDecoration: 'none', color: colors.text, minWidth: 0 }}>
    {kind === 'youtube' ? (
      <span style={{ position: 'relative', display: 'block', width: 104, height: 58, borderRadius: radius.md, overflow: 'hidden', flexShrink: 0, background: `linear-gradient(135deg, ${colors.crimson}, ${colors.crimsonDark})` }}>
        {youtubeId && !thumbnailFailed && (
          // eslint-disable-next-line @next/next/no-img-element -- remote video thumbnail; falls back to the gradient when blocked
          <img src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`} alt="" onError={() => setThumbnailFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><Play size={18} fill={colors.surface} color={colors.surface} aria-hidden="true" /></span>
      </span>
    ) : (
      <span style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: radius.md, flexShrink: 0, background: colors.surfaceMuted, color: iconColor }}>
        {kind === 'pdf' ? <FileText size={20} aria-hidden="true" /> : kind === 'media' ? <Film size={20} aria-hidden="true" /> : <Link2 size={20} aria-hidden="true" />}
      </span>
    )}
    <span style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, minWidth: 0 }}>
      <span style={{ ...typography.bodySmall, fontWeight: typography.weightSemibold, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ ...typography.helper, color: colors.textMuted, display: 'inline-flex', alignItems: 'center', gap: spacing.xs }}>
        {kind === 'youtube' && <Play size={12} aria-hidden="true" />}
        {noteAttachmentKindLabel(link)}
      </span>
    </span>
  </a>
}
