export type LeadContactFields = { fullName: string; email: string; phone: string }

/** Basic address syntax, not a deliverability or identity check. */
export function isLeadEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/** Missing required values become errors only after an attempted save. */
export function leadContactErrors(fields: LeadContactFields, submitted: boolean) {
  return {
    fullName: submitted && !fields.fullName.trim() ? 'Enter a contact name.' : undefined,
    email: !submitted ? undefined : !fields.email.trim() ? 'Enter an email address.' : !isLeadEmailValid(fields.email) ? 'Enter a valid email address, such as name@example.com.' : undefined,
  }
}