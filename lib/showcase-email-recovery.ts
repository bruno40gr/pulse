export const SHOWCASE_OPERATION = 'ff1e9aef-4a04-4f37-ac5b-9ada34092017'
export const SHOWCASE_RECOVERY_OPERATION = 'b8397a41-931e-4a15-b228-1975ef45b382'
export const SHOWCASE_SENDER = 'admin@headlinermusicacademy.com'
export const SHOWCASE_SUBJECT = 'Holiday Student Showcase | Sign Up to Perform'
const dates = [
  ['November', 'Saturday, November 28', 'Sunday, November 29'],
  ['December', 'Friday, December 4', 'Saturday, December 5', 'Sunday, December 6', 'Friday, December 11', 'Saturday, December 12', 'Sunday, December 13', 'Friday, December 18', 'Saturday, December 19', 'Sunday, December 20', 'Monday, December 21', 'Tuesday, December 22', 'Wednesday, December 23'],
]
export const SHOWCASE_DRAFT = { senderEmail: SHOWCASE_SENDER, subject: SHOWCASE_SUBJECT, html:
  '<p>Hello Headliner families,</p><p>We’d love to have your student perform in our Holiday Student Showcase! It’s a chance for them to share what they’ve been working on and build confidence in front of a supportive audience.</p><p>This year, we’re teaming up with Fusion Elite, the martial arts academy next door, for the first time to host a series of holiday performances at Headliner and around the studio.</p><p>If your student would like to perform, please tell their teacher which dates work for your family. Feel free to share more than one date.</p>' +
  dates.map(([month, ...days]) => `<p><strong>${month}</strong></p><ul>${days.map(day => `<li>${day}</li>`).join('')}</ul>`).join('') +
  '<p>We’re looking forward to celebrating the holidays with you!</p><p>Lorena Rudha<br>The Headliner Music Academy Team</p>',
}

export function isShowcaseRecovery(tenant: string, operation: unknown) {
  return tenant === '00000000-0000-0000-0000-000000000001' && operation === SHOWCASE_OPERATION
}

export function showcaseRecoveryOpen(now = Date.now()) {
  // Do not offer a saved signup invitation once its first performance day starts in Pacific time.
  return now < Date.parse('2026-11-28T00:00:00-08:00')
}

export function unattemptedRecipients<T extends { destination: string }>(recipients: T[], attempted: ReadonlySet<string>) {
  return recipients.filter(row => !attempted.has(row.destination))
}

/** Resolve the exact reviewed subset against server-owned addresses, in stable order. */
export function showcaseSendSelection<T extends { destination: string }>(recipients: T[], selected: unknown): T[] | null {
  if (!Array.isArray(selected) || !selected.length || selected.length > 5000 || selected.some(value => typeof value !== 'string' || !value || value.length > 254)) return null
  const requested = new Set<string>(selected)
  const result = recipients.filter(row => requested.has(row.destination))
  return requested.size === selected.length && result.length === requested.size ? result : null
}