'use client'

import { colors, spacing, typography } from '@/lib/tokens'

export default function PrototypeSmsPreview({ name, body }: { name: string; body: string }) {
  return <section aria-label={`SMS phone preview for ${name}`} style={{ width: 240, height: 520, flexShrink: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', margin: '0 auto', border: `6px solid ${colors.text}`, borderRadius: 30, overflow: 'hidden', background: colors.surface, fontFamily: typography.fontSans }}>
    <div aria-hidden="true" style={{ width: 70, height: 12, flexShrink: 0, margin: '0 auto', background: colors.text, borderRadius: '0 0 10px 10px' }} />
    <div style={{ textAlign: 'center', padding: spacing.md, flexShrink: 0, borderBottom: `1px solid ${colors.border}`, overflowWrap: 'anywhere' }}><strong>{name}</strong><div style={{ ...typography.bodySmall, color: colors.textSecondary }}>Text message · SMS</div></div>
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: spacing.lg }}>
      <div style={{ padding: spacing.md, borderRadius: '16px 16px 4px 16px', background: body.trim() ? '#34A853' : colors.surfaceMuted, color: body.trim() ? 'white' : colors.textSecondary, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', ...typography.bodySmall }}>{body || 'Your message will appear here.'}</div>
    </div>
    <div aria-hidden="true" style={{ width: 80, height: 4, flexShrink: 0, background: colors.text, borderRadius: 4, margin: '10px auto' }} />
  </section>
}