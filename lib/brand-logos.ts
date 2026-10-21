import { validSignatureLogoUrl } from '@/lib/email-signature-fields'

export function brandLogos(settings: { logo_on_white_url?: unknown; logo_on_dark_url?: unknown } | null | undefined) {
  const clean = (value: unknown) => typeof value === 'string' && value.trim() && value.length <= 2048 && validSignatureLogoUrl(value.trim()) ? value.trim() : ''
  const onWhite = clean(settings?.logo_on_white_url)
  const onDark = clean(settings?.logo_on_dark_url)
  return { onWhite, onDark, ready: Boolean(onWhite && onDark) }
}