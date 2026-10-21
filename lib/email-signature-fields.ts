/** Ten local digits, displayed in the format requested by the business. */
export function formatSignaturePhone(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits
}

export function validSignatureLogoUrl(value: string) {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch { return false }
}