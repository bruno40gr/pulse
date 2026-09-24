import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getImportProfile, classifyStatus } from '@/lib/import-profile'
import { isNonStudentBooking } from '@/lib/contact-kind'
import { assertTenantAccess } from '@/lib/access'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function getTenantId(request: Request): string {
  const url = new URL(request.url)
  return url.searchParams.get('tenant') || DEFAULT_TENANT_ID
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a contact filter assistant for a small business messaging tool called Pulse.
You receive a natural language query about contacts and must convert it into a structured filter. You only parse intent — you never return contact ids.

Return ONLY valid JSON with this exact shape (no markdown, no backticks):
{
  "instructors": [],
  "instruments": [],
  "service_types": [],
  "bands": [],
  "lesson_days": [],
  "client_statuses": [],
  "last_attended_months": [],
  "cancelled_in_month": null,
  "not_attended_days": null,
  "has_email": null,
  "no_match": false,
  "explanation": ""
}

Rules:
- Empty arrays mean "no filter on that dimension".
- "instructors": substrings of instructor names (e.g. "Bridget"). "X's students" / "students of X" = instructors ["X"].
- "instruments": lowercase instrument names (e.g. "drums", "piano", "bass", "voice"). "drum students" = instruments ["drums"].
- "service_types": one of "private", "group", "semi-private", "band" (band = 101 classes like Bass 101, Guitar 101). "band students" = service_types ["band"].
- "bands": substrings of band/ensemble names (e.g. "sunkast", "anomaly syndrome", "la paz"). "SunKast students" / "students in SunKast" / "who is in SunKast" = bands ["sunkast"]. "band students" alone = service_types ["band"] (leave bands empty unless a specific band is named).
- "lesson_days": lowercase day names (e.g. "tuesday"). "Tuesday students" = lesson_days ["tuesday"].
- "client_statuses": one of "active", "member", "inactive", "cancelled", "dropped", "prospect". "active students" = client_statuses ["active"] (members are also active). "inactive/cancelled students" = client_statuses ["inactive", "cancelled", "dropped"].
- "client_statuses": one of "active", "member", "inactive", "cancelled", "dropped", "prospect". "active students" = client_statuses ["active"] (members are also active). "inactive/cancelled students" = client_statuses ["inactive", "cancelled", "dropped"]. If the query is specifically about becoming inactive in a named month (for example "inactive in september", "cancelled for september", "dropped in september"), prefer "cancelled_in_month" and leave "client_statuses" empty unless the user explicitly asks for both.
- "last_attended_months": lowercase month names (e.g. "august") meaning the contact last attended in that month. "students who last attended in august" = last_attended_months ["august"].
- "cancelled_in_month": a lowercase month name meaning "became inactive during that month" (was active the month before, but not that month). "cancelled for september" / "dropped in september" / "quit in september" = cancelled_in_month "september". null = no filter.
- "not_attended_days": integer N meaning "last attended more than N days ago". "haven't attended in X weeks/days" = not_attended_days N. null = no filter.
- "has_email": true = has email, false = no email, null = no filter. "contacts with no email" = has_email false.
- "no_match": true only if the query cannot be mapped to any filter. Otherwise false.
- "explanation": short human-readable summary (e.g. "Students of Bridget").`

function norm(value: unknown): string {
  return String(value ?? '').toLowerCase().trim()
}

function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => norm(v))
    .filter((v) => v.length >= 2)
}

function containsAny(haystack: string[], needles: string[]): boolean {
  if (needles.length === 0) return true
  return needles.some((needle) => haystack.some((item) => item.includes(needle)))
}

function isInactiveLikeStatus(value: string): boolean {
  return value === 'inactive' || value === 'cancelled' || value === 'dropped'
}

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}

type EnrollmentRow = {
  instrument: string | null
  service_type: string | null
  lesson_day: string | null
  custom_fields: Record<string, unknown> | null
  instructor_person_id: string | null
}

type StudentRow = {
  id: string
  client_status: string | null
  last_attended: string | null
  enrollments: EnrollmentRow[] | null
}

type PersonRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  students: StudentRow[] | null
}

export async function POST(request: Request) {
  try {
    const { query, tenant } = await request.json()
    const tenantId = tenant || getTenantId(request)
    if (!query?.trim()) return NextResponse.json({ error: 'No query provided' }, { status: 400 })

    const access = await assertTenantAccess(request, tenantId)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const profile = await getImportProfile(tenantId)

    const { data, error } = await supabaseAdmin
      .from('people')
      .select(`
        id, first_name, last_name, email, opted_out,
        students (
          id, client_status, last_attended,
          enrollments (
            instrument, service_type, lesson_day,
            custom_fields, instructor_person_id
          )
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('opted_out', false)

    if (error) throw error

    const people = (data || []) as PersonRow[]

    // Resolve instructor names from instructor_person_id → people
    const instructorPersonIds = new Set<string>()
    for (const person of people) {
      for (const student of person.students || []) {
        for (const enrollment of student.enrollments || []) {
          if (enrollment.instructor_person_id) instructorPersonIds.add(enrollment.instructor_person_id)
        }
      }
    }

    const instructorNameByPersonId = new Map<string, string>()
    if (instructorPersonIds.size > 0) {
      const { data: instructorPeople } = await supabaseAdmin
        .from('people')
        .select('id, first_name, last_name')
        .in('id', [...instructorPersonIds])
      for (const p of instructorPeople || []) {
        instructorNameByPersonId.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(' '))
      }
    }

    // Aggregate each person across ALL students/enrollments
    const contacts = people.map((person) => {
      const instructors = new Set<string>()
      const instruments = new Set<string>()
      const serviceTypes = new Set<string>()
      const bands = new Set<string>()
      const lessonDays = new Set<string>()
      let clientStatus = ''
      let lastAttended: string | null = null
      let studentId: string | null = null
      let nonStudentBooking = false

      for (const student of person.students || []) {
        if (!studentId && student.id) studentId = student.id
        if (student.client_status && !clientStatus) clientStatus = norm(student.client_status)
        if (student.last_attended && (!lastAttended || new Date(student.last_attended) > new Date(lastAttended))) {
          lastAttended = student.last_attended
        }
        for (const enrollment of student.enrollments || []) {
          if (isNonStudentBooking(enrollment)) nonStudentBooking = true
          if (enrollment.instrument) instruments.add(norm(enrollment.instrument))
          if (enrollment.service_type) serviceTypes.add(norm(enrollment.service_type))
          if (enrollment.lesson_day) lessonDays.add(norm(enrollment.lesson_day))

          const cfBandName = enrollment.custom_fields?.band_name
          if (typeof cfBandName === 'string' && cfBandName.trim() !== '' && cfBandName.trim() !== '-') bands.add(norm(cfBandName))

          const cfName = enrollment.custom_fields?.instructor
          const hasCfName = typeof cfName === 'string' && cfName.trim() !== '' && cfName.trim() !== '-'
          const name = hasCfName
            ? cfName
            : enrollment.instructor_person_id
              ? instructorNameByPersonId.get(enrollment.instructor_person_id)
              : null
          if (name) instructors.add(norm(name))
        }
      }

      return {
        id: person.id,
        student_id: studentId,
        email: person.email,
        client_status: clientStatus,
        last_attended: lastAttended,
        non_student_booking: nonStudentBooking,
        instructors: [...instructors],
        instruments: [...instruments],
        service_types: [...serviceTypes],
        bands: [...bands],
        lesson_days: [...lessonDays],
      }
    })

    // Fetch roster snapshots (resilient) to answer "cancelled in <month>" queries.
    const activeMonthsByStudent = new Map<string, Set<string>>()
    let maxYear = new Date().getFullYear()
    try {
      const { data: snapRows } = await supabaseAdmin
        .from('roster_snapshots')
        .select('student_id, snapshot_date, is_active')
        .eq('tenant_id', tenantId)
      for (const r of (snapRows || []) as Array<{ student_id: string; snapshot_date: string; is_active: boolean }>) {
        if (!r.is_active) continue
        const key = r.snapshot_date.slice(0, 7)
        if (!activeMonthsByStudent.has(r.student_id)) activeMonthsByStudent.set(r.student_id, new Set())
        activeMonthsByStudent.get(r.student_id)!.add(key)
        const y = Number(r.snapshot_date.slice(0, 4))
        if (Number.isFinite(y) && y > maxYear) maxYear = y
      }
    } catch (e) {
      console.warn('roster_snapshots: table may not exist yet —', (e as Error).message)
    }

    // Parse the query into a structured filter (LLM only parses intent)
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Query: "${query}"` }],
    })

    const firstBlock = response.content[0]
    const rawText = firstBlock && firstBlock.type === 'text' ? firstBlock.text : ''
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const spec = JSON.parse(cleaned)

    const instructors = strArray(spec.instructors)
    const instruments = strArray(spec.instruments)
    const serviceTypes = strArray(spec.service_types)
    const bands = strArray(spec.bands)
    const lessonDays = strArray(spec.lesson_days)
    const clientStatuses = strArray(spec.client_statuses)
    const lastAttendedMonths = strArray(spec.last_attended_months)
    const cancelledInMonth = typeof spec.cancelled_in_month === 'string' && spec.cancelled_in_month.trim()
      ? spec.cancelled_in_month.trim().toLowerCase()
      : null
    const notAttendedDays = typeof spec.not_attended_days === 'number' && Number.isFinite(spec.not_attended_days)
      ? spec.not_attended_days
      : null
    const hasEmail = typeof spec.has_email === 'boolean' ? spec.has_email : null
    const noMatch = spec.no_match === true

    const dayMs = 24 * 60 * 60 * 1000
    const now = Date.now()
    const applyClientStatusFilter = !(cancelledInMonth && clientStatuses.length > 0 && clientStatuses.every(isInactiveLikeStatus))

    const matchingIds: string[] = []
    for (const c of contacts) {
      if (noMatch) break
      if (c.non_student_booking && (cancelledInMonth || clientStatuses.some(isInactiveLikeStatus))) continue
      if (!containsAny(c.instructors, instructors)) continue
      if (!containsAny(c.instruments, instruments)) continue
      if (!containsAny(c.service_types, serviceTypes)) continue
      if (!containsAny(c.bands, bands)) continue
      if (!containsAny(c.lesson_days, lessonDays)) continue
      if (applyClientStatusFilter && clientStatuses.length > 0) {
        const cls = classifyStatus(c.client_status, profile)
        const statusMatched = clientStatuses.some((s) => {
          if (s === 'active') return cls === 'active'
          if (s === 'inactive' || s === 'cancelled' || s === 'dropped') return cls === 'inactive'
          return cls === s
        })
        if (!statusMatched) continue
      }
      if (cancelledInMonth) {
        const idx = MONTH_NAMES.indexOf(cancelledInMonth)
        if (idx < 0) continue
        const curKey = monthKey(maxYear, idx)
        const prevIdx = idx - 1
        const prevKey = monthKey(prevIdx < 0 ? maxYear - 1 : maxYear, (prevIdx + 12) % 12)
        const activeMonths = c.student_id ? activeMonthsByStudent.get(c.student_id) : undefined
        const wasActivePrev = activeMonths ? activeMonths.has(prevKey) : false
        const isActiveCur = activeMonths ? activeMonths.has(curKey) : false
        if (!(wasActivePrev && !isActiveCur)) continue
      }
      if (lastAttendedMonths.length > 0) {
        if (!c.last_attended) continue
        const monthName = new Date(c.last_attended).toLocaleString('en-US', { month: 'long' }).toLowerCase()
        if (!lastAttendedMonths.includes(monthName)) continue
      }
      if (hasEmail === true && !c.email) continue
      if (hasEmail === false && c.email) continue
      if (notAttendedDays !== null) {
        if (!c.last_attended) continue
        const last = new Date(c.last_attended).getTime()
        if (!Number.isFinite(last)) continue
        if (now - last < notAttendedDays * dayMs) continue
      }

      matchingIds.push(c.id)
    }

    const explanation = typeof spec.explanation === 'string' && spec.explanation.trim()
      ? spec.explanation.trim()
      : query

    return NextResponse.json({ contact_ids: matchingIds, explanation })
  } catch (error) {
    console.error('AI filter error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
