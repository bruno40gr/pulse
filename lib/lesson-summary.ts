/** One service identity across subscriptions, lesson lists and move summaries. */
export type LessonSummaryProps = { instrument?: string | null; format?: string | null; duration?: number | string | null; plan?: string | null; level?: number | string | null; part?: 'full' | 'identity' | 'details' }
export function lessonSummary({ instrument, format, duration, plan, level, part = 'full' }: LessonSummaryProps) {
  const normalized = (format || '').trim().toLowerCase().replace(/[_-]/g, ' ')
  const classify = (source: string) => /\bsemi[ -]?(private)?\b/.test(source) ? 'Semi-private'
    : /\bprivate\b/.test(source) ? 'Private'
      : /\bgroup\b/.test(source) ? 'Group' : null
  const label = classify(normalized) || classify(plan?.toLowerCase() || '')
  const minutes = duration ?? plan?.match(/\b(\d+)\s*min(?:ute)?s?\b/i)?.[1]
  const explicitLevel = String(level ?? '').trim().match(/^(?:level\s*)?([1-9]\d*)$/i)?.[1]
  const knownLevel = explicitLevel || plan?.match(/\blevel\s+([1-9]\d*)\b/i)?.[1]
  if (part === 'identity') return [instrument?.trim() || 'Subscription', knownLevel ? `Level ${knownLevel}` : null].filter(Boolean).join(' • ')
  if (part === 'details') return [label, Number(minutes) > 0 ? `${Number(minutes)} min` : null].filter(Boolean).join(' • ')
  return [instrument?.trim() || 'Subscription', label, Number(minutes) > 0 ? `${Number(minutes)} min` : null].filter(Boolean).join(' • ')
}
