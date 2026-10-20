import type { MockTemplate } from '@/lib/prototype-messaging'

/** Approved workspace-wide copy. Never expose another school's branded templates. */
export const HEADLINER_TEMPLATE_TENANT = '00000000-0000-0000-0000-000000000001'

// Admin name/title are supplied once by the automatic signature, not duplicated in the body.
export const headlinerEmailTemplates: MockTemplate[] = [
  {
    id: 'headliner-2-day-contact', channel: 'email', category: 'Outreach', name: '2-Day Contact', subject: 'Following up about music lessons',
    body: `Hello [MEMBER’S NAME],

I just left a voicemail for you. I am following up with you about [INSTRUMENT] lessons for [CHILD’S NAME]. We would love to get your child’s space reserved with one of our talented teachers, and with a bit more information about your family’s current schedule and musical needs, we can determine which program and timeslot would work best for you. So give us a call at (916) 435-1300, or email us at admin@headlinermusicacademy.com, and we'll get back to you as soon as possible. We are open from 12 PM - 9 PM Monday through Thursday, 12 PM - 8 PM on Fridays, and 9 AM - 3 PM on Saturdays.

Warm regards,`,
  },
  {
    id: 'headliner-5-day-contact', channel: 'email', category: 'Outreach', name: '5-Day Contact', subject: 'Checking in about music lessons',
    body: `Hello [MEMBER’S NAME],

I just left a voicemail for you. I am following up with you again about [INSTRUMENT] lessons for [CHILD’S NAME]. I’m sorry we haven’t been able to connect yet. We would love to get your [SON/DAUGHTER]’s space reserved with one of our talented teachers. We currently offer both in-person and online options for private lessons.

With a bit more information about your family’s current schedule and musical needs, we can determine which program and timeslot would work best for you, so call us at (916) 435-1300. We are open from 12 PM - 9 PM Monday through Thursday, 12 PM - 8 PM on Fridays, and 9 AM - 3 PM on Saturdays.

We look forward to hearing back from you soon.

All my best,`,
  },
  {
    id: 'headliner-one-week-contact', channel: 'email', category: 'Outreach', name: 'One Week Contact', subject: 'Let’s connect about music lessons',
    body: `Hello [MEMBER’S NAME],

I just reached out to you by phone regarding how we can best contribute to [CHILD’S NAME]’s musical education. We would love to get your [SON/DAUGHTER]’s space reserved with one of our talented teachers, so give us a call at (916) 435-1300, or email us at admin@headlinermusicacademy.com. We are open from 12 PM - 9 PM Monday through Thursday, 12 PM - 8 PM on Fridays, and 9 AM - 3 PM on Saturdays.

Thank you again for your interest in Headliner Music Academy. We look forward to talking with you soon.

Sincerely,`,
  },
  {
    id: 'headliner-meta-generic', channel: 'email', category: 'Outreach', name: 'META Lead / Generic Email', subject: 'Music lessons for your family',
    body: `Hello [MEMBER’S NAME],

I just left a voicemail for you. I am following up with you again about music lessons for your family. I’m sorry we haven’t been able to connect yet. We would love to get your space reserved with one of our talented teachers for early childhood, private lessons, band program, summer camp, birthday parties or one of the other music offerings we have at our school.

With a bit more information from you, we can determine how to best meet your musical needs, so please give us a call back at 916-435-1300. We are open from 12 pm to 9 pm Monday through Thursday, 12 pm to 8 pm on Friday, and 9 am to 3 pm on Saturday. We look forward to hearing back from you and meeting your family soon.

Warm Regards,`,
  },
]

export function fillOutreachTemplate(value: string, person?: { name: string; student: string }) {
  return value.replace(/\[MEMBER[’']S NAME\]/g, () => person?.name.trim() || '[MEMBER’S NAME]')
    .replace(/\[CHILD[’']S NAME\]/g, () => person?.student.trim() || '[CHILD’S NAME]')
}

export function unresolvedEmailPlaceholders(value: string): string[] {
  return [...new Set(value.match(/\[[A-Z][A-Z’' /_-]*\]|\{\{[^{}]+\}\}/g) || [])]
}