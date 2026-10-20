import { prototypeEmailTemplates, type PrototypeChannel, type PrototypeThread } from '@/lib/conversations-prototype'
import { fillOutreachTemplate } from '@/lib/headliner-email-templates'

export type MockRecipient = { id: string; name: string; email: string; phone: string; student: string }
export type MockEmailRecipients = { to: string[]; cc: string[]; bcc: string[] }
export type MockTemplate = { id: string; channel: PrototypeChannel; name: string; subject: string; body: string; html?: string; category?: string; outreachStep?: number }
export const emptyEmailRecipients = (): MockEmailRecipients => ({ to: [], cc: [], bcc: [] })
export function initialMockTemplates(): MockTemplate[] {
  return [
    { id: 'sms-follow-up', channel: 'sms', name: 'Friendly follow-up', subject: '', body: 'Hi {{firstName}}, just checking in about lessons for {{student}}. Any questions we can help with? — Headliner' },
    { id: 'sms-reminder', channel: 'sms', name: 'Lesson reminder', subject: '', body: 'Hi {{firstName}}, a quick reminder about {{student}}’s upcoming lesson. Reply here if you need anything. — Headliner' },
    ...prototypeEmailTemplates.map(template => ({ ...template, category: 'Outreach', outreachStep: template.id === 'availability' ? 2 : 3, id: `email-${template.id}`, channel: 'email' as const, body: template.html.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]*>/g, '').trim() })),
    { id: 'email-welcome', channel: 'email', category: 'Outreach', outreachStep: 1, name: 'First introduction', subject: 'Welcome to Headliner', body: 'Hi {{firstName}},\n\nThank you for your interest in lessons for {{student}}. We would love to hear what they enjoy and help you find the right teacher.\n\nWhat would you like to know about getting started?' },
    { id: 'email-first-visit', channel: 'email', category: 'Getting started', name: 'Your first visit', subject: 'Getting ready for your first lesson', body: 'Hi {{firstName}},\n\nWe look forward to welcoming {{student}}. Bring any questions and let us know if there is anything that would help make the first visit comfortable.' },
    { id: 'email-practice', channel: 'email', category: 'Lesson support', name: 'Practice at home', subject: 'A little practice goes a long way', body: 'Hi {{firstName}},\n\nShort, regular practice can help {{student}} build confidence. Ask your teacher which activities would be most useful this week.' },
    { id: 'email-reschedule', channel: 'email', category: 'Lesson support', name: 'Find another time', subject: 'Let’s find another lesson time', body: 'Hi {{firstName}},\n\nLet us know which days might work for {{student}} and we can explore another time together.' },
    { id: 'email-check-in', channel: 'email', category: 'Lesson support', name: 'How are lessons going?', subject: 'Checking in on lessons', body: 'Hi {{firstName}},\n\nHow has {{student}} been finding lessons so far? We would love to hear what is going well and where we can help.' },
    { id: 'email-return', channel: 'email', category: 'Getting started', name: 'Welcome back', subject: 'Ready to pick up where we left off?', body: 'Hi {{firstName}},\n\nIf {{student}} is thinking about returning to lessons, we would be happy to explore options. Let us know what would work for you.' },

  ]
}
export function fillMockTemplate(value: string, person?: Pick<MockRecipient, 'name' | 'student'>) {
  return fillOutreachTemplate(value.replaceAll('{{firstName}}', person?.name.split(' ')[0] || 'there').replaceAll('{{student}}', person?.student.split(' ')[0] || 'your student'), person)
}
export function mockTextHtml(text: string) {
  return text.split('\n\n').map(paragraph => `<p>${paragraph.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;').replaceAll('\n', '<br>')}</p>`).join('')
}
export function emailRecipientIds(recipients: MockEmailRecipients) {
  return [...new Set([...recipients.to, ...recipients.cc, ...recipients.bcc])]
}
export function validMockEmailRecipients(recipients: MockEmailRecipients, people: MockRecipient[]) {
  const ids = [...recipients.to, ...recipients.cc, ...recipients.bcc]
  return recipients.to.length > 0 && ids.length === new Set(ids).size && ids.every(id => people.some(person => person.id === id && person.email))
}


/** Count outbound email records across all threads, not inbox rows or SMS. */
export function countMockEmailOutreach(threads: PrototypeThread[], contactId: string) {
  return new Set(threads.filter(thread => thread.contactId === contactId && thread.channel === 'email')
    .flatMap(thread => thread.messages.filter(message => message.direction === 'outbound').map(message => message.id))).size
}

/** Only explicitly numbered outreach templates participate; never loop after the final step. */
export function nextMockEmailTemplate(templates: MockTemplate[], previousEmails: number) {
  return templates.find(template => template.channel === 'email' && template.outreachStep === previousEmails + 1)
}
