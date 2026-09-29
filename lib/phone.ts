export function formatPhoneNumber(value: string | null | undefined): string {
  if (!value) return ''

  const trimmed = value.trim()
  const extensionMatch = trimmed.match(/(?:\s*(?:ext\.?|x)\s*(\d+))$/i)
  const extension = extensionMatch ? ` ext. ${extensionMatch[1]}` : ''
  const base = extensionMatch ? trimmed.slice(0, extensionMatch.index).trim() : trimmed
  const digits = base.replace(/\D/g, '')

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}${extension}`
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}${extension}`
  }

  return trimmed
}

export function normalizePhoneNumber(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits || null
}

export function toE164PhoneNumber(value: string | null | undefined): string | null {
  const normalized = normalizePhoneNumber(value)
  if (!normalized) return null
  if (normalized.length === 10) return `+1${normalized}`
  return value?.trim() || null
}