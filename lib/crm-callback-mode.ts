// Explicit opt-in only. Never silently fall back after a failed durable capture.
export function crmCallbackCaptureEnabled(): boolean {
  const mode = process.env.ODEON_CRM_CALLBACK_MODE?.trim() || 'legacy'
  if (mode !== 'legacy' && mode !== 'capture') throw new Error('Invalid CRM callback mode')
  return mode === 'capture'
}