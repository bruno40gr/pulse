import type { BandPrice } from './academy-band-pricing'
import type { AcademyGroup } from './academy-explorer'
import type { ExplorerPerson } from './event-explorer'
import { availableBandSubscriptions, type BandEnrollment } from './academy-band-enrollment'

/** Local simulation: the email and portal action reference this same request. */
export type BandEnrollmentRequest = {
  id: string; bandId: string; bandName: string; studentId: string; accountId: string;
  recipientName: string; recipientEmail: string; monthlyPrice: string;
  policies: { id: string; values: Record<string, string> }[];
  pricing?: BandPrice;
  message?: { subject: string; html: string };
  sentAt: string; completedAt?: string;
}

export function bandRequestRecipient(student: ExplorerPerson, people: ExplorerPerson[]) {
  return people.find(person => (person.accountId || person.id) === (student.accountId || student.id) && person.roles.some(role => ['Parent', 'Account holder'].includes(role))) || student
}

export function sendBandEnrollmentRequests(requests: BandEnrollmentRequest[], band: AcademyGroup, studentIds: string[], people: ExplorerPerson[], enrollments: BandEnrollment[], monthlyPrice: string, policies: BandEnrollmentRequest['policies'], message?: { subject: string; html: string }, pricing?: BandPrice) {
  if (!studentIds.length) throw new Error('Select candidates who have agreed to enroll.')
  if (!Number.isFinite(Number(monthlyPrice)) || Number(monthlyPrice) <= 0) throw new Error('Enter a monthly subscription price.')
  if (message && (!message.subject.trim() || !message.html.replace(/<[^>]*>/g, '').trim())) throw new Error('Enter an email subject and message.')
  const additions = [...new Set(studentIds)].map(studentId => {
    const student = people.find(person => person.id === studentId)
    if (!student || !(band.pendingMemberIds || []).includes(studentId) || band.memberIds.includes(studentId)) throw new Error('Choose pending candidates in this band.')
    if (availableBandSubscriptions(enrollments, studentId).length) throw new Error(`Assign ${student.name}’s available paid subscription instead of requesting another payment.`)
    const recipient = bandRequestRecipient(student, people)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)) throw new Error(`Add a valid account-holder email for ${student.name}.`)
    return { id: crypto.randomUUID(), bandId: band.id, bandName: band.name, studentId, accountId: student.accountId || student.id, recipientName: recipient.name, recipientEmail: recipient.email, monthlyPrice: Number(monthlyPrice).toFixed(2), policies: policies.map(policy => ({ id: policy.id, values: { ...policy.values } })), pricing: pricing ? { ...pricing, discountIds: [...pricing.discountIds] } : undefined, message: message ? { ...message } : undefined, sentAt: new Date().toISOString() }
  })
  return [...requests, ...additions.filter(next => !requests.some(existing => existing.bandId === next.bandId && existing.studentId === next.studentId && !existing.completedAt))]
}

export function openBandEnrollmentRequest(requests: BandEnrollmentRequest[], id: string, accountId: string, groups: AcademyGroup[]) {
  const request = requests.find(item => item.id === id && item.accountId === accountId && !item.completedAt)
  if (!request) throw new Error('Enrollment request unavailable for this family.')
  const band = groups.find(group => group.id === request.bandId)
  if (!band || band.memberIds.includes(request.studentId) || !(band.pendingMemberIds || []).includes(request.studentId)) throw new Error('This placement is no longer available. Contact the academy.')
  return request
}

export function resolveBandEnrollmentRequests(requests: BandEnrollmentRequest[], studentId: string, bandId: string) {
  return requests.map(request => request.studentId === studentId && request.bandId === bandId && !request.completedAt ? { ...request, completedAt: new Date().toISOString() } : request)
}

export function bandEnrollmentRequestEmail(request: BandEnrollmentRequest, studentName: string) {
  return { subject: request.message?.subject || `Complete enrollment in ${request.bandName}`, body: `Hello ${request.recipientName},\n\nPlease complete ${studentName}’s enrollment in ${request.bandName}. Your price is $${request.monthlyPrice}${request.pricing ? ` · ${request.pricing.unit}` : ' per month'}. Review the academy policies and complete payment to confirm the placement.`, cta: `Complete enrollment in ${request.bandName}`, href: `#band-enrollment-request=${encodeURIComponent(request.id)}` }
}