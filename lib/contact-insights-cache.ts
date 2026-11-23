/** Remove only retired private insights, including their timestamp keys. */
export function clearLegacyContactInsights(): void {
  if (typeof window === 'undefined') return
  try {
    const storage = window.localStorage
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index)
      if (key?.startsWith('pulse_contact_insights_')) storage.removeItem(key)
    }
  } catch {
    // Restricted storage must not break account navigation or sign-out.
  }
}