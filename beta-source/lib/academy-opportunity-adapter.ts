import { bandRequestRecipient } from './academy-band-requests'
import type { LeadWorkspaceAdapter } from '@/components/leads/LeadWorkspaceContext'
import { createOpportunities, isOpenBandOpportunity } from './academy-opportunities'
import { inquiryStatus } from './academy-explorer-contacts'
import { leadBelongsToTab } from '@/lib/lead-lesson-details'
import { emptyStudentPreferences, readLeadStudents, type LeadStudent } from '@/lib/lead-students'
import { resolveCommunicationRecipients } from '@/lib/communication-recipients'
import type { ExplorerInquiry, ExplorerPerson, InquiryStage } from './event-explorer'

type State = { people: ExplorerPerson[]; inquiries: ExplorerInquiry[] }
type Options = {
  getState: () => State
  onChange: (state: State) => void
  getCreationIds: () => string[] | null
  onBandEnrollment?: (studentId: string, bandId: string) => void
}

export function opportunityCreation(people: ExplorerPerson[], ids: string[], key: string) {
  const selected = ids.map(id => people.find(person => person.id === id)).filter((person): person is ExplorerPerson => Boolean(person))
  const holder = selected.length > 0 && new Set(selected.map(person => person.accountId || person.id)).size === 1
    ? people.find(person => person.accountId === selected[0].accountId && person.roles.some(role => ['Parent', 'Account holder'].includes(role))) || selected[0]
    : undefined
  return { key, fullName: holder?.name || '', email: holder?.email || '', phone: '', students: selected.map(studentForPerson) }
}

function studentForPerson(person: ExplorerPerson): LeadStudent {
  return { name: person.name, email: person.email, phone: '', age: '', date_of_birth: '', instrument_interest: person.instruments?.join(', ') || '', relationship_to_contact: '', preferences: emptyStudentPreferences() }
}

/** Local data transport only. No network fallback, including unrecognized paths. */
export function createOpportunityAdapter({ getState, onChange, getCreationIds, onBandEnrollment }: Options): LeadWorkspaceAdapter {
  const edits = new Map<string, Record<string, unknown>>()
  const notes = new Map<string, { id: string; text: string; timestamp: string; editable: boolean }[]>()
  const json = (body: unknown, status = 200) => Response.json(body, { status })
  const record = (inquiry: ExplorerInquiry) => {
    const person = getState().people.find(person => person.id === inquiry.personId)
    const created = inquiry.createdAt || '2026-10-01T12:00:00.000Z'
    const extra = edits.get(inquiry.id) || {}
    const bandInquiry = Boolean(inquiry.bandId || inquiry.serviceType === 'band' || /\b(band|ensemble)\b/i.test(inquiry.interest))
    const payload = {
      opportunity_origin: inquiry.origin || null,
      ...(bandInquiry ? { service_type: 'band' } : {}),
      student_requests: person ? [{ ...studentForPerson(person), ...(bandInquiry ? { instrument_interest: 'Band' } : {}) }] : [],
      ...(inquiry.bandId ? { band_id: inquiry.bandId, band_name: inquiry.interest } : {}),
      follow_up_at: inquiry.followUp || null,
      follow_up_note: inquiry.note || null,
      ...(inquiry.winbackStatus ? { winback_status: inquiry.winbackStatus } : {}),
      ...extra,
    }
    return {
      id: inquiry.id, tenant_id: 'explorer-local', contact_id: inquiry.personId,
      intake_type: bandInquiry ? 'lesson_inquiry' : inquiry.category === 'Service inquiries' ? 'service_inquiry' : 'lesson_inquiry',
      source_system: 'local', source_form: inquiry.stage === 'Disenrolled' ? '2026-disenrollment-import' : '', source_page: null,
      category: inquiry.stage === 'Disenrolled' ? 'winback' : inquiry.category,
      status: inquiry.stage === 'Disenrolled' ? inquiry.winbackStatus || 'to_contact' : inquiryStatus(inquiry),
      program_label: bandInquiry ? 'Band' : inquiry.category === 'Service inquiries' ? null : inquiry.interest,
      service_label: !bandInquiry && inquiry.category === 'Service inquiries' ? inquiry.interest : null,
      priority: 'normal', temperature: '', source: inquiry.source || '', payload,
      created_at: created, updated_at: inquiry.updatedAt || created, last_activity_at: inquiry.updatedAt || created,
      follow_up_at: inquiry.followUp || null, follow_up_note: inquiry.note || null,
      contact: { id: inquiry.personId, full_name: person?.name || '', email: person?.email || null, phone: null, notes: null },
      events: [], notes_history: notes.get(inquiry.id) || [],
    }
  }
  return {
    isOwner: true,
    onBandEnrollment,
    async request(input, init) {
      const url = new URL(input, 'http://local.invalid')
      const method = init?.method || 'GET'
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const state = getState()
      if (url.pathname === '/api/contacts' || url.pathname === '/api/staff') return json([])
      if (url.pathname === '/api/brand-settings') return json({})
      if (url.pathname === '/api/contacts/check-sensitive') return json({ flagged: [], opted_out: [] })
      if (url.pathname === '/api/media-suggestions') return json({ suggestions: [] })
      if (url.pathname === '/api/communications/recipients' && method === 'POST') {
        const contacts = state.people.filter(person => body.contactIds?.includes(person.id)).map(person => ({
          id: person.id, first_name: person.name, email: person.email, phone: null, opted_out: false, accounts: [{ name: bandRequestRecipient(person, state.people).name, email: bandRequestRecipient(person, state.people).email, phone: null }],
        }))
        return json({ ...resolveCommunicationRecipients(contacts, body.channel), version: 'explorer-local' })
      }
      if (url.pathname === '/api/communications/senders') return json({ senders: [{ id: 'local', name: 'Academy', email: 'academy@example.test', mine: false }] })
      if (url.pathname === '/api/conversations/templates') return json({ templates: [] })
      if (url.pathname === '/api/conversations/signature') return json({ name: 'Academy', title: '', personal: false })
      if (url.pathname === '/api/communications/email' && method === 'POST') return json({ sent: new Set(body.contactIds).size, failed: 0, uncertain: 0, pending: 0 })
      if (url.pathname === '/api/leads' && method === 'GET') {
        const scope = url.searchParams.has('band_scope') ? { bandId: url.searchParams.get('band_id') || '', origin: url.searchParams.get('origin') || '' } : null
        const all = state.inquiries.filter(inquiry => !scope || (isOpenBandOpportunity(inquiry) && (!scope.bandId || (scope.bandId === 'unassigned' ? !inquiry.bandId : inquiry.bandId === scope.bandId)) && (!scope.origin || inquiry.origin === scope.origin))).map(record)
        const tabs = ['lesson_inquiry', 'service_inquiry', 'job_application', 'winback', 'enrolled', 'lost']
        const counts = Object.fromEntries(tabs.map(tab => [tab, all.filter(lead => leadBelongsToTab(lead, tab)).length]))
        const tab = url.searchParams.get('intake_type') || 'lesson_inquiry'
        const status = url.searchParams.get('status')
        const leads = all.filter(lead => (scope ? true : leadBelongsToTab(lead, tab)) && (!status || lead.status === status))
        const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)
        const page = leads.slice(offset, offset + 100)
        if (url.searchParams.get('summary_only') === '1') return json({ counts, pipelineValue: 0, closedSinceOct1: 0 })
        return json(url.searchParams.get('include_counts') === '1' ? { leads: page, counts, pipelineValue: 0, closedSinceOct1: 0 } : page)
      }
      const id = url.pathname.match(/^\/api\/leads\/([^/]+)$/)?.[1]
      if (id) {
        const inquiry = state.inquiries.find(inquiry => inquiry.id === id)
        if (!inquiry) return json({ error: 'Opportunity not found.' }, 404)
        if (method === 'GET') return json(record(inquiry))
        if (method === 'PATCH') {
          const payload = body.payload || {}
          if ('follow_up_at' in payload && payload.follow_up_at !== null && (typeof payload.follow_up_at !== 'string' || !Number.isFinite(Date.parse(payload.follow_up_at)))) return json({ error: 'Choose a valid follow-up date.' }, 400)
          if ('follow_up_note' in payload && payload.follow_up_note !== null && typeof payload.follow_up_note !== 'string') return json({ error: 'Enter a valid reminder.' }, 400)
          if (inquiry.bandId && ['won', 'enrolled'].includes(String(body.status).toLowerCase()) && !['Won', 'Enrolled'].includes(inquiry.stage)) {
            if (!onBandEnrollment) return json({ error: 'Complete band enrollment before confirming membership.' }, 409)
            onBandEnrollment(inquiry.personId, inquiry.bandId)
            return json(record(inquiry))
          }
          const stage = body.status === 'won' ? 'Enrolled' : body.status
            ? String(body.status).replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase()) : inquiry.stage
          const winback = inquiry.stage === 'Disenrolled'
          const changed: ExplorerInquiry = {
            ...inquiry, stage: winback ? inquiry.stage : stage as InquiryStage,
            ...(winback && body.status ? { winbackStatus: body.status } : {}),
            followUp: Object.hasOwn(payload, 'follow_up_at') ? String(payload.follow_up_at || '').slice(0, 10) : inquiry.followUp,
            note: Object.hasOwn(payload, 'follow_up_note') ? String(payload.follow_up_note || '') : inquiry.note,
            ...(typeof body.program_label === 'string' && !inquiry.bandId ? { interest: body.program_label } : {}),
            ...(typeof body.service_label === 'string' ? { interest: body.service_label } : {}),
            updatedAt: new Date().toISOString(),
          }
          if (typeof body.add_note === 'string' && body.add_note.trim()) notes.set(id, [...notes.get(id) || [], { id: crypto.randomUUID(), text: body.add_note.trim(), timestamp: changed.updatedAt!, editable: true }])
          if (body.edit_note) {
            const entries = notes.get(id) || []
            const entry = entries.find(note => note.id === body.edit_note.id)
            if (!entry || entry.text !== body.edit_note.previous_text) return json({ error: 'The note changed. Reopen it and try again.' }, 409)
            notes.set(id, entries.map(note => note.id === entry.id ? { ...note, text: body.edit_note.text } : note))
          }
          edits.set(id, { ...edits.get(id), ...payload })
          // Contact identity is shared; an inquiry outcome or follow-up is not.
          const people = state.people.map(person => person.id === inquiry.personId ? {
            ...person, ...(typeof body.full_name === 'string' ? { name: body.full_name } : {}),
            ...(typeof body.email === 'string' ? { email: body.email } : {}),
          } : person)
          onChange({ people, inquiries: state.inquiries.map(item => item.id === id ? changed : item) })
          return json(record(changed))
        }
      }
      if (url.pathname === '/api/leads' && method === 'DELETE') {
        const ids = new Set(body.ids || body.lead_ids || [])
        onChange({ ...state, inquiries: state.inquiries.filter(inquiry => !ids.has(inquiry.id)) })
        return json({ success: true })
      }
      if (url.pathname === '/api/intake' && method === 'POST') {
        const people = [...state.people]
        let ids = getCreationIds() || []
        const students = readLeadStudents(body.payload, body.program_label)
        if (!body.full_name?.trim() || (!body.email?.trim() && !body.phone?.trim())) return json({ error: 'Enter a contact name and email or phone.' }, 400)
        const scope = body.payload?.service_type === 'band' ? { bandId: body.payload?.band_id || '', origin: '' } : null
        const interest = scope ? (body.payload?.band_name || 'Band program') : body.service_label || body.program_label || ''
        if (!interest.trim()) return json({ error: 'Select a program or service.' }, 400)
        if (!ids.length) {
          if (people.some(person => person.name.trim().toLowerCase() === body.full_name.trim().toLowerCase() && person.email.trim().toLowerCase() === (body.email || '').trim().toLowerCase())) return json({ error: 'Select the existing contact before creating another inquiry.' }, 409)
          if (body.intake_type !== 'service_inquiry' && (!students.length || students.some(student => !student.name.trim()))) return json({ error: 'Enter each student’s name.' }, 400)
          const holderId = crypto.randomUUID()
          const accountId = holderId
          people.push({ id: holderId, accountId, name: body.full_name, email: body.email || '', family: body.full_name, roles: ['Account holder'], enrolled: false, customer: false })
          ids = (body.intake_type === 'service_inquiry' ? [{ name: body.full_name, email: body.email }] : students).map(student => {
            const id = crypto.randomUUID()
            people.push({ id, accountId, name: student.name, email: student.email || body.email || '', family: body.full_name, roles: ['Student'], instruments: [], enrolled: false, customer: false })
            return id
          })
        }
        const result = createOpportunities(state.inquiries, people, {
          personIds: ids, interest,
          category: body.intake_type === 'service_inquiry' ? 'Service inquiries' : 'Lesson requests',
          origin: body.payload?.opportunity_origin === 'family_inquiry' ? 'family_inquiry' : 'staff_initiated', bandId: body.payload?.band_id || undefined, serviceType: scope ? 'band' : undefined, source: body.utm_source || undefined, followUp: '', note: body.payload?.message || '',
        })
        for (const inquiry of result.inquiries.filter(inquiry => !state.inquiries.some(existing => existing.id === inquiry.id))) {
          const student = students[ids.indexOf(inquiry.personId)]
          edits.set(inquiry.id, { ...body.payload, ...(student ? { student_requests: [student] } : {}) })
        }
        onChange({ people, inquiries: result.inquiries })
        return json({ lead_intake_id: result.inquiries.find(inquiry => ids.includes(inquiry.personId) && inquiry.interest === (body.service_label || body.program_label))?.id })
      }
      // Calls, messaging, imports and AI must never reach operational services.
      return json({ error: 'This action is unavailable.' }, 422)
    },
  }
}