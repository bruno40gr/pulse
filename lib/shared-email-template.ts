import type { MockTemplate } from '@/lib/prototype-messaging'

export type SharedEmailTemplate = MockTemplate & { version: number }

/** Templates deliberately store plain text; insertion uses the existing escaped-text renderer. */
export function parseSharedEmailTemplate(value: unknown): Pick<MockTemplate, 'name' | 'subject' | 'body'> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  for (const [key, max] of [['name', 200], ['subject', 500], ['body', 20000]] as const) {
    if (typeof row[key] !== 'string' || !row[key].trim() || row[key].length > max || row[key].includes('\u0000')) return null
  }
  if (/[\r\n]/.test(row.subject as string)) return null
  return { name: (row.name as string).trim(), subject: (row.subject as string).trim(), body: (row.body as string).trim() }
}