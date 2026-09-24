import { supabaseAdmin } from '@/lib/supabase/admin'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'

const COBRA_KAI_TENANT_ID = '00000000-0000-0000-0000-000000000002'
const KUMON_TENANT_ID = '00000000-0000-0000-0000-000000000003'

const CRM_DEMO_TENANTS: Record<string, { name: string; is_demo: boolean }> = {
  [COBRA_KAI_TENANT_ID]: { name: 'Sacramento Martial Arts', is_demo: true },
  [KUMON_TENANT_ID]: { name: 'Kumon Learning Center', is_demo: true },
}

type DemoLead = {
  firstName: string
  lastName: string
  programLabel: string | null
  serviceLabel: string | null
  category: string
  status: string
  priority: string
  temperature: string
  sourceForm: string
  sourcePage: string
  followUpNote: string
  activityNote: string
}

type DemoNote = {
  title: string
  body: string
  color: string
  pinned: boolean
}

type FixtureSet = { leads: DemoLead[]; notes: DemoNote[] }

type DemoLeadRow = [
  string, string, string | null, string | null, string, string,
  string, string, string, string, string, string,
]

type DemoNoteRow = [string, string, string, boolean]

const cobraLeads = ([
  ['Avery', 'Santos', 'Kids Karate (Ages 7–9)', null, 'lessons', 'new', 'high', 'hot', 'website-trial-class', '/trial-class', 'Call after school to choose a trial class time.', 'Parent is looking for a confidence-building activity. This is fictional demo data.'],
  ['Jordan', 'Lee', 'Adult Kickboxing', null, 'lessons', 'contacted', 'medium', 'warm', 'community-open-house', '/open-house', 'Send the evening class schedule and first-week offer.', 'Enjoyed the open-house demonstration and asked about evening kickboxing. Fictional demo lead.'],
  ['Morgan', 'Patel', null, 'Birthday Party', 'services', 'booked', 'medium', 'warm', 'website-birthday-party', '/birthday-parties', 'Confirm guest count and preferred Saturday time slot.', 'Interested in a martial-arts birthday party for twelve children. Fictional demo lead.'],
  ['Riley', 'Chen', 'Teen Karate', null, 'lessons', 'new', 'high', 'hot', 'parent-referral', '/programs/teens', 'Text the parent with trial options after 4 PM.', 'Referral from a current family; asked about the teen confidence program. Fictional demo lead.'],
  ['Taylor', 'Morgan', 'Little Ninjas (Ages 4–6)', null, 'lessons', 'contacted', 'medium', 'warm', 'website-trial-class', '/little-ninjas', 'Share the beginner class schedule and uniform details.', 'Looking for a structured after-school activity. Fictional demo lead.'],
  ['Cameron', 'Wells', 'Adult Karate', null, 'lessons', 'new', 'low', 'cool', 'local-fitness-fair', '/programs/adults', 'Follow up with the introductory class calendar.', 'Met the team at a local fitness fair. Fictional demo lead.'],
  ['Quinn', 'Davis', null, 'Private Lesson', 'services', 'contacted', 'high', 'hot', 'website-private-training', '/private-lessons', 'Offer two private lesson openings next week.', 'Asked about focused one-on-one preparation before a tournament. Fictional demo lead.'],
  ['Harper', 'Reed', 'Kids Karate (Ages 10–12)', null, 'lessons', 'new', 'medium', 'warm', 'website-trial-class', '/trial-class', 'Call to discuss sibling enrollment discount.', 'Two siblings may enroll together after the trial. Fictional demo lead.'],
  ['Drew', 'Kim', 'Adult Kickboxing', null, 'lessons', 'contacted', 'low', 'cool', 'instagram-campaign', '/kickboxing', 'Send the early-morning class schedule.', 'Interested in morning workouts before work. Fictional demo lead.'],
  ['Parker', 'Adams', null, 'Self-Defense Workshop', 'services', 'booked', 'high', 'hot', 'community-partner', '/workshops', 'Confirm the workshop headcount with the organizer.', 'Community group requested a private self-defense workshop. Fictional demo lead.'],
  ['Skyler', 'Flores', 'Teen Karate', null, 'lessons', 'new', 'medium', 'warm', 'website-trial-class', '/programs/teens', 'Follow up after the school day about the trial waiver.', 'Parent wants help improving focus and discipline. Fictional demo lead.'],
  ['Emerson', 'Price', 'Little Ninjas (Ages 4–6)', null, 'lessons', 'contacted', 'medium', 'warm', 'neighborhood-event', '/little-ninjas', 'Email the Saturday beginner class availability.', 'Met at a neighborhood event and requested Saturday options. Fictional demo lead.'],
] satisfies DemoLeadRow[]).map(([firstName, lastName, programLabel, serviceLabel, category, status, priority, temperature, sourceForm, sourcePage, followUpNote, activityNote]) => ({ firstName, lastName, programLabel, serviceLabel, category, status, priority, temperature, sourceForm, sourcePage, followUpNote, activityNote }))

const kumonLeads = ([
  ['Priya', 'Nguyen', 'Math Program', null, 'lessons', 'new', 'high', 'hot', 'website-assessment', '/free-assessment', 'Confirm the free assessment appointment and current grade level.', 'Parent requested an assessment to rebuild math confidence. This is fictional demo data.'],
  ['Elliot', 'Brooks', 'Reading Program', null, 'lessons', 'contacted', 'medium', 'warm', 'parent-referral', '/programs/reading', 'Email the reading placement overview before the visit.', 'Referred by another family and interested in a reading evaluation. Fictional demo lead.'],
  ['Casey', 'Rivera', null, 'Study Skills Consultation', 'services', 'contacted', 'low', 'cool', 'website-tutoring', '/programs', 'Share the consultation outline and weekday times.', 'Asked how Kumon routines support independent homework habits. Fictional demo lead.'],
  ['Noah', 'Bennett', 'Math Program', null, 'lessons', 'new', 'high', 'hot', 'website-assessment', '/free-assessment', 'Call after school to schedule a placement assessment.', 'Family wants support ahead of the next math unit. Fictional demo lead.'],
  ['Mia', 'Wallace', 'Reading Program', null, 'lessons', 'contacted', 'medium', 'warm', 'school-community-night', '/programs/reading', 'Send the program brochure and Tuesday availability.', 'Met at a school community night and asked about reading fluency. Fictional demo lead.'],
  ['Owen', 'Foster', 'Math Program', null, 'lessons', 'new', 'medium', 'warm', 'parent-referral', '/programs/math', 'Follow up with the family’s preferred assessment day.', 'A current parent referred this family for foundational math support. Fictional demo lead.'],
  ['Zoe', 'Mitchell', null, 'Enrollment Consultation', 'services', 'booked', 'high', 'hot', 'website-consultation', '/enrollment', 'Confirm the enrollment consultation for next week.', 'Family wants to compare math and reading enrollment options. Fictional demo lead.'],
  ['Leo', 'Turner', 'Reading Program', null, 'lessons', 'new', 'medium', 'warm', 'website-assessment', '/free-assessment', 'Text the parent with the available reading assessments.', 'Parent mentioned a goal of more confident independent reading. Fictional demo lead.'],
  ['Sofia', 'Ramirez', 'Math Program', null, 'lessons', 'contacted', 'low', 'cool', 'local-library-event', '/programs/math', 'Email the after-school center hours.', 'Connected at a local library event. Fictional demo lead.'],
  ['Isaac', 'Cooper', null, 'Progress Review', 'services', 'booked', 'medium', 'warm', 'former-family-referral', '/progress-review', 'Prepare the progress review overview before the meeting.', 'Returning family wants a fresh plan for the school year. Fictional demo lead.'],
  ['Grace', 'Hughes', 'Reading Program', null, 'lessons', 'new', 'high', 'hot', 'website-assessment', '/free-assessment', 'Call to discuss the placement assessment and goals.', 'Family is seeking reading comprehension support. Fictional demo lead.'],
  ['Miles', 'Perry', 'Math Program', null, 'lessons', 'contacted', 'medium', 'warm', 'neighborhood-flyer', '/programs/math', 'Send the enrollment packet and Saturday hours.', 'Responded to a neighborhood flyer about the math program. Fictional demo lead.'],
] satisfies DemoLeadRow[]).map(([firstName, lastName, programLabel, serviceLabel, category, status, priority, temperature, sourceForm, sourcePage, followUpNote, activityNote]) => ({ firstName, lastName, programLabel, serviceLabel, category, status, priority, temperature, sourceForm, sourcePage, followUpNote, activityNote }))

const FIXTURES: Record<string, FixtureSet> = {
  [COBRA_KAI_TENANT_ID]: {
    leads: cobraLeads,
    notes: ([
      ['Trial class follow-up', 'Call Avery Santos’s family after school Friday. Confirm the Kids Karate trial class and send the waiver link.', 'yellow', true],
      ['Open house recap', 'Jordan Lee responded well to the adult kickboxing demo. Share Tuesday and Thursday evening options.', 'blue', false],
      ['Birthday party checklist', 'Prepare the party packet: guest count, food policy, and two available Saturday time slots.', 'orange', false],
      ['September workshop', 'Confirm the community self-defense workshop roster and room setup by Wednesday.', 'green', false],
      ['New family welcome', 'Have a uniform sizing guide ready for the next group of Little Ninjas trial families.', 'purple', false],
    ] satisfies DemoNoteRow[]).map(([title, body, color, pinned]) => ({ title, body, color, pinned })),
  },
  [KUMON_TENANT_ID]: {
    leads: kumonLeads,
    notes: ([
      ['Assessment reminder', 'Confirm Priya Nguyen’s math assessment and bring the grade-level intake sheet.', 'yellow', true],
      ['Reading program visit', 'Send Elliot Brooks’s family the reading placement overview before their center visit.', 'green', false],
      ['Study skills consult', 'Casey Rivera asked about independent homework routines. Offer the weekday consultation slots.', 'purple', false],
      ['Parent orientation', 'Prepare the short parent orientation handout for new assessment families.', 'blue', false],
      ['Saturday enrollment', 'Review Saturday assessment availability before returning calls from the neighborhood flyer.', 'orange', false],
    ] satisfies DemoNoteRow[]).map(([title, body, color, pinned]) => ({ title, body, color, pinned })),
  },
}

export async function ensureDemoFixtures(tenantId: string): Promise<void> {
  const fixtures = FIXTURES[tenantId]
  if (!fixtures) return

  await ensureCrmDemoTenant(tenantId)
  await Promise.all([
    ensureLeads(tenantId, fixtures.leads),
    ensureNotes(tenantId, fixtures.notes),
  ])
}

async function ensureCrmDemoTenant(tenantId: string) {
  const tenant = CRM_DEMO_TENANTS[tenantId]
  if (!tenant) return

  const { data: existingTenant, error: lookupError } = await crmSupabaseAdmin
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (existingTenant) return

  const { error } = await crmSupabaseAdmin
    .from('tenants')
    .insert({ id: tenantId, ...tenant })
  if (error) throw error
}

function fixtureId(prefix: '1' | '2' | '3' | '4', tenantId: string, index: number) {
  const tenantSuffix = tenantId.endsWith('0002') ? '2' : '3'
  return `${prefix}0000000-0000-4000-8000-${tenantSuffix}${String(index + 1).padStart(11, '0')}`
}

async function ensureLeads(tenantId: string, leads: DemoLead[]) {
  for (const [index, lead] of leads.entries()) {
    const contactId = fixtureId('2', tenantId, index)
    const leadId = fixtureId('1', tenantId, index)
    const eventId = fixtureId('4', tenantId, index)
    const fullName = `${lead.firstName} ${lead.lastName}`

    const { data: existingContact, error: contactLookupError } = await crmSupabaseAdmin
      .from('crm_contacts').select('id').eq('tenant_id', tenantId).eq('id', contactId).maybeSingle()
    if (contactLookupError) throw contactLookupError
    if (!existingContact) {
      const { error } = await crmSupabaseAdmin.from('crm_contacts').insert({
        id: contactId, tenant_id: tenantId, first_name: lead.firstName, last_name: lead.lastName,
        full_name: fullName, email: `${lead.firstName.toLowerCase()}.${lead.lastName.toLowerCase()}@example.invalid`,
        phone: `(555) 01${tenantId.endsWith('0002') ? '2' : '3'}-${String(index + 1).padStart(4, '0')}`,
        notes: 'Fictional demo contact.', contact_kind: 'lead', lifecycle_stage: 'new',
      })
      if (error) throw error
    }

    const { data: existingLead, error: leadLookupError } = await crmSupabaseAdmin
      .from('lead_intakes').select('id').eq('tenant_id', tenantId).eq('id', leadId).maybeSingle()
    if (leadLookupError) throw leadLookupError
    if (!existingLead) {
      const { error } = await crmSupabaseAdmin.from('lead_intakes').insert({
        id: leadId, tenant_id: tenantId, contact_id: contactId, intake_type: lead.serviceLabel ? 'service_inquiry' : 'lesson_inquiry',
        source_system: 'pulse-demo', source_form: lead.sourceForm, source_page: lead.sourcePage,
        program_label: lead.programLabel, service_label: lead.serviceLabel, category: lead.category,
        status: lead.status, priority: lead.priority, temperature: lead.temperature,
        payload: {
          source: 'website', follow_up_at: `2026-10-${String(index + 1).padStart(2, '0')}T16:00:00.000Z`,
          follow_up_note: lead.followUpNote, is_fictional_demo_data: true,
        },
      })
      if (error) throw error
    }

    const { data: existingEvent, error: eventLookupError } = await crmSupabaseAdmin
      .from('lead_events').select('id').eq('tenant_id', tenantId).eq('id', eventId).maybeSingle()
    if (eventLookupError) throw eventLookupError
    if (!existingEvent) {
      const { error } = await crmSupabaseAdmin.from('lead_events').insert({
        id: eventId, tenant_id: tenantId, lead_intake_id: leadId, contact_id: contactId,
        event_type: 'note_added', event_label: 'Demo note added',
        payload: { text: lead.activityNote, actor: { displayName: 'Demo Team' }, is_fictional_demo_data: true },
      })
      if (error) throw error
    }
  }
}

async function ensureNotes(tenantId: string, notes: DemoNote[]) {
  for (const [index, note] of notes.entries()) {
    const id = fixtureId('3', tenantId, index)
    const { data: existingNote, error: lookupError } = await supabaseAdmin
      .from('notes').select('id').eq('tenant_id', tenantId).eq('id', id).maybeSingle()
    if (lookupError) throw lookupError
    if (!existingNote) {
      const { error } = await supabaseAdmin.from('notes').insert({
        id, tenant_id: tenantId, title: note.title, body: note.body, color: note.color,
        pinned: note.pinned, created_by: 'Demo Team',
      })
      if (error) throw error
    }
  }
}