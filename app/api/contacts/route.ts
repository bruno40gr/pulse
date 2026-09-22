import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { parseCSV, type FieldMapping, type ParsedContact } from '@/lib/csv-parser'
import { resolveInstructor, type ResolvedInstructor } from '@/lib/instructors'
import { enrichDemoContact } from '@/lib/demo-contact-enrichment'
import { getImportProfile, saveImportProfile, classifyStatus } from '@/lib/import-profile'
import { isNonStudentBooking } from '@/lib/contact-kind'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function getTenantId(request: Request): string {
  const url = new URL(request.url)
  return url.searchParams.get('tenant') || DEFAULT_TENANT_ID
}

type DedupPerson = {
  id: string
  phone: string | null
  email: string | null
  first_name: string | null
  last_name: string | null
  custom_fields: Record<string, unknown> | null
}

type AttendanceEntry = { session_date: string; status: string }

// Merge a new attendance series into an existing one, deduping by session date
// (newer import wins) and returning date-descending order.
function mergeAttendanceEntries(existing: unknown, incoming: AttendanceEntry[]): AttendanceEntry[] {
  const byDate = new Map<string, string>()
  if (Array.isArray(existing)) {
    for (const item of existing) {
      if (item && typeof item === 'object') {
        const rec = item as { session_date?: unknown; status?: unknown }
        if (typeof rec.session_date === 'string' && typeof rec.status === 'string') {
          byDate.set(rec.session_date, rec.status)
        }
      }
    }
  }
  for (const r of incoming) byDate.set(r.session_date, r.status)
  return [...byDate.entries()]
    .map(([session_date, status]) => ({ session_date, status }))
    .sort((a, b) => (a.session_date < b.session_date ? 1 : -1))
}

function normalizePhoneForDedup(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  if (digits.length >= 7) return digits
  return null
}

function normalizeEmailForDedup(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed || trimmed === '-' || trimmed === '—' || trimmed === 'n/a' || trimmed === 'none' || trimmed === 'null') return null
  return trimmed
}

function nameKey(first: string | null | undefined, last: string | null | undefined): string {
  return `${first ?? ''} ${last ?? ''}`.trim().toLowerCase()
}

// Merge multiple session rows for the same student into a single contact,
// keeping the most recent attended date and the union of tags/fields.
function mergeContactRows(rows: ParsedContact[]): ParsedContact {
  const first = rows[0]

  function firstNonBlank<T>(get: (r: ParsedContact) => T | null | undefined): T | null {
    for (const r of rows) {
      const v = get(r)
      if (v !== null && v !== undefined && v !== '') return v as T
    }
    return null
  }

  let lastAttended: string | null = null
  for (const r of rows) {
    if (r.last_attended && (!lastAttended || r.last_attended > lastAttended)) {
      lastAttended = r.last_attended
    }
  }

  const tagSet = new Set<string>()
  for (const r of rows) for (const t of r.tags || []) tagSet.add(t)

  return {
    first_name: firstNonBlank((r) => r.first_name) || first.first_name,
    last_name: firstNonBlank((r) => r.last_name) || first.last_name,
    email: firstNonBlank((r) => (r.email && r.email !== '-' ? r.email : null)),
    phone: firstNonBlank((r) => r.phone),
    external_id: firstNonBlank((r) => r.external_id),
    date_of_birth: firstNonBlank((r) => r.date_of_birth),
    instructor: firstNonBlank((r) => r.instructor),
    last_attended: lastAttended,
    session_date: firstNonBlank((r) => r.session_date),
    attendance_status: undefined,
    tags: tagSet.size > 0 ? [...tagSet] : undefined,
    instrument: firstNonBlank((r) => r.instrument),
    service_type: firstNonBlank((r) => r.service_type),
    program: firstNonBlank((r) => r.program),
    plan_name: firstNonBlank((r) => r.plan_name),
    session_name: firstNonBlank((r) => r.session_name),
    band_name: firstNonBlank((r) => r.band_name),
    lesson_day: firstNonBlank((r) => r.lesson_day),
    lesson_time: firstNonBlank((r) => r.lesson_time),
    client_status: firstNonBlank((r) => r.client_status),
  }
}

export async function GET(request: Request) {
  const tenantId = getTenantId(request)

  try {
    // Actual schema: people → students → enrollments (instructor_person_id → people)
    const { data, error } = await supabaseAdmin
      .from('people')
      .select(`
        id, tenant_id, first_name, last_name, phone, email,
        date_of_birth, opted_out, notes_history, student_notes_history,
        custom_fields, created_at, updated_at,
        students (
          id, client_status, last_attended, message_routing, is_minor, account_id,
          accounts ( id, name, phone, email ),
          enrollments (
            id, instrument, service_type, lesson_day, lesson_time,
            plan_name, session_name, custom_fields, instructor_person_id
          )
        )
      `)
      .eq('tenant_id', tenantId)
      .order('last_name', { ascending: true })

    if (error) throw error

    // Collect instructor person ids to resolve names + instructor records
    const instructorPersonIds = new Set<string>()
    for (const person of data || []) {
      const enrollment = (person as any).students?.[0]?.enrollments?.[0]
      const pid = enrollment?.instructor_person_id
      if (pid) instructorPersonIds.add(pid)
    }

    // Resolve instructor people (name) and instructors table (id)
    const personIdList = [...instructorPersonIds]
    let instructorPeople: any[] = []
    let instructorRecords: any[] = []

    if (personIdList.length > 0) {
      const { data: peopleData } = await supabaseAdmin
        .from('people')
        .select('id, first_name, last_name, phone, email')
        .in('id', personIdList)
      instructorPeople = peopleData || []

      const { data: instrData } = await supabaseAdmin
        .from('instructors')
        .select('id, person_id')
        .in('person_id', personIdList)
      instructorRecords = instrData || []
    }

    const personById = new Map(instructorPeople.map(p => [p.id, p]))
    const instructorIdByPersonId = new Map(instructorRecords.map(i => [i.person_id, i.id]))

    // Identify all instructors (staff) for this tenant so they can be surfaced as editable contacts.
    const { data: allInstructorRows } = await supabaseAdmin
      .from('instructors')
      .select('id, person_id')
      .eq('tenant_id', tenantId)
    const instructorIdByAllPersonIds = new Map((allInstructorRows || []).map((i: any) => [i.person_id, i.id]))

    // Flatten the joined data to match the contacts shape
    const flattened = (data || []).map((person: any) => {
      const student = person.students?.[0] ?? {}
      const account = student.accounts ?? {}
      const enrollment = student.enrollments?.[0] ?? {}
      const enrollmentFields = enrollment.custom_fields ?? {}
      const nonStudentBooking = isNonStudentBooking(enrollment)
      const staffId = instructorIdByAllPersonIds.get(person.id) ?? null
      const isInstructor = !!staffId
      const isActive = (person.custom_fields?.staff_status ?? 'active') !== 'sunset'

      // Account holders (single account fallback — actual schema has no student_accounts)
      const accountHolders = account.name
        ? [{ name: account.name, phone: account.phone, email: account.email, relationship: null, is_primary: true }]
        : []

      // Resolve instructor from instructor_person_id (actual schema)
      const instructorPersonId = enrollment.instructor_person_id ?? null
      const instructorPerson = instructorPersonId ? personById.get(instructorPersonId) : null
      const instructorRecordId = instructorPersonId ? instructorIdByPersonId.get(instructorPersonId) : null

      const instructorInfo = instructorPersonId
        ? {
            staff_id: instructorRecordId ?? instructorPersonId,
            person_id: instructorPersonId,
            name: instructorPerson
              ? `${instructorPerson.first_name} ${instructorPerson.last_name}`
              : (enrollmentFields.instructor || null),
            phone: instructorPerson?.phone ?? null,
            email: instructorPerson?.email ?? null,
          }
        : null

      return enrichDemoContact({
        id: person.id,
        tenant_id: person.tenant_id,
        first_name: person.first_name,
        last_name: person.last_name,
        phone: person.phone,
        email: person.email,
        date_of_birth: person.date_of_birth,
        opted_out: person.opted_out,
        client_status: student.client_status || 'active',
        last_attended: student.last_attended,
        message_routing: nonStudentBooking ? 'student' : (student.message_routing || 'student'),
        is_minor: nonStudentBooking ? false : (student.is_minor ?? false),
        account_id: student.account_id,
        staff_id: staffId,
        is_active: isActive,
        account_holder_name: nonStudentBooking ? null : account.name,
        account_holder_phone: nonStudentBooking ? null : account.phone,
        account_holder_email: nonStudentBooking ? null : account.email,
        family_name: nonStudentBooking ? null : account.name,
        account_holders: nonStudentBooking ? [] : accountHolders,
        instructor: instructorInfo,
        notes_history: person.notes_history || [],
        student_notes_history: person.student_notes_history || [],
        custom_fields: {
          ...person.custom_fields,
          ...enrollmentFields,
          contact_kind: isInstructor ? 'instructor' : (nonStudentBooking ? 'booking' : 'student'),
          instrument: enrollment.instrument || person.custom_fields?.instrument,
          service_type: enrollment.service_type || person.custom_fields?.service_type,
          lesson_day: enrollment.lesson_day || person.custom_fields?.lesson_day,
          lesson_time: enrollment.lesson_time || person.custom_fields?.lesson_time,
          plan_name: enrollment.plan_name || person.custom_fields?.plan_name,
          session_name: enrollment.session_name || person.custom_fields?.session_name,
          instructor: enrollmentFields.instructor || person.custom_fields?.instructor,
          band_name: enrollmentFields.band_name || person.custom_fields?.band_name,
        },
        tags: person.custom_fields?.tags || [],
      })
    })

    // Sunset instructors are not viewable/actionable — hide them from the list.
    return NextResponse.json(flattened.filter((c: any) => !(c.staff_id && c.is_active === false)))
  } catch (error) {
    console.error('Error fetching contacts:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { csv, mappings, profile: profileUpdate, snapshot_month } = await request.json()
    if (!csv) return NextResponse.json({ error: 'No CSV data provided' }, { status: 400 })

    const url = new URL(request.url)
    const tenantId = url.searchParams.get('tenant') || DEFAULT_TENANT_ID

    // Load the tenant's import profile (active/cancelled vocabulary); save if the client provided an update.
    const profile = await getImportProfile(tenantId)
    if (profileUpdate && (Array.isArray(profileUpdate.active_statuses) || Array.isArray(profileUpdate.inactive_statuses))) {
      await saveImportProfile(tenantId, {
        ...profile,
        ...(Array.isArray(profileUpdate.active_statuses) ? { active_statuses: profileUpdate.active_statuses } : {}),
        ...(Array.isArray(profileUpdate.inactive_statuses) ? { inactive_statuses: profileUpdate.inactive_statuses } : {}),
        ...(profileUpdate.column_mapping ? { column_mapping: profileUpdate.column_mapping } : {}),
      })
    }

    // If the client told us which month this data is for, date snapshots by that month;
    // otherwise fall back to today.
    const snapshotDate = typeof snapshot_month === 'string' && /^\d{4}-\d{2}$/.test(snapshot_month)
      ? `${snapshot_month}-01`
      : new Date().toISOString().slice(0, 10)

    const parsedContacts = await parseCSV(csv, mappings as FieldMapping[] | undefined)

    // Fetch existing people for deduplication
    const { data } = await supabaseAdmin
      .from('people')
      .select('id, phone, email, first_name, last_name, custom_fields')
      .eq('tenant_id', tenantId)

    const existingPeople = (data || []) as DedupPerson[]

    const externalIdMap = new Map<string, DedupPerson>()
    const emailMap = new Map<string, DedupPerson>()
    const nameMap = new Map<string, DedupPerson>()
    const phoneMap = new Map<string, DedupPerson>()
    for (const p of existingPeople) {
      const extId = typeof p.custom_fields?.external_id === 'string' ? p.custom_fields.external_id : null
      if (extId && !externalIdMap.has(extId)) externalIdMap.set(extId, p)
      const ek = normalizeEmailForDedup(p.email)
      if (ek && !emailMap.has(ek)) emailMap.set(ek, p)
      const nk = nameKey(p.first_name, p.last_name)
      if (nk && !nameMap.has(nk)) nameMap.set(nk, p)
      const pk = normalizePhoneForDedup(p.phone)
      if (pk && !phoneMap.has(pk)) phoneMap.set(pk, p)
    }

    // Group rows (one per session) by identity so attendance aggregates per student
    const groups = new Map<string, ParsedContact[]>()
    for (const contact of parsedContacts) {
      const ek = normalizeEmailForDedup(contact.email)
      const nk = nameKey(contact.first_name, contact.last_name)
      const pk = normalizePhoneForDedup(contact.phone)
      const key = contact.external_id
        ? `id:${contact.external_id}`
        : ek
          ? `email:${ek}`
          : nk
            ? `name:${nk}`
            : `phone:${pk || 'unknown'}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(contact)
    }

    let createdCount = 0
    let updatedCount = 0
    const instructorCache = new Map<string, ResolvedInstructor | null>()

    for (const rows of groups.values()) {
      const contact = mergeContactRows(rows)
      const attendanceRecords = rows
        .filter((r) => r.session_date && r.attendance_status)
        .map((r) => ({ session_date: r.session_date as string, status: r.attendance_status as string }))

      const { instrument, lesson_day, lesson_time, service_type, instructor,
              plan_name, session_name, band_name, last_attended, client_status } = contact

      const personFields = {
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
        phone: contact.phone,
        date_of_birth: contact.date_of_birth ?? null,
      }

      const normEmail = normalizeEmailForDedup(contact.email)
      const normName = nameKey(contact.first_name, contact.last_name)
      const normPhone = normalizePhoneForDedup(contact.phone)
      const normExternalId = contact.external_id || null

      // Prefer stable external id, then email, then name, then phone (account holder's, often shared by siblings)
      const existing =
        (normExternalId && externalIdMap.get(normExternalId)) ||
        (normEmail && emailMap.get(normEmail)) ||
        (normName && nameMap.get(normName)) ||
        (normPhone && phoneMap.get(normPhone))

      const enrollmentFields: Record<string, string | null | undefined> = {
        instrument, lesson_day, lesson_time, service_type,
        plan_name, session_name,
        instructor, band_name,
      }
      // Only these are real enrollments columns; instructor/band_name live in custom_fields.
      const enrollmentColumns: Record<string, string | null | undefined> = {
        instrument, lesson_day, lesson_time, service_type,
        plan_name, session_name,
      }

      // Resolve instructor via shared helper (cached per unique name)
      const instructorKey = instructor ? instructor.trim().toLowerCase() : ''
      let resolvedInstructor = instructorKey ? instructorCache.get(instructorKey) : null
      if (instructorKey && !instructorCache.has(instructorKey)) {
        resolvedInstructor = await resolveInstructor(tenantId, instructor)
        instructorCache.set(instructorKey, resolvedInstructor)
      }
      const instructorPersonId = resolvedInstructor?.person_id ?? null

      let studentId: string | null = null

      if (existing) {
        const cleanPersonFields = Object.fromEntries(
          Object.entries(personFields).filter(([, v]) => v !== null && v !== undefined && v !== '')
        )
        const mergedPersonCustomFields = normExternalId
          ? { ...(existing.custom_fields || {}), external_id: normExternalId }
          : (existing.custom_fields || {})
        if (Object.keys(cleanPersonFields).length > 0 || normExternalId) {
          await supabaseAdmin.from('people')
            .update({ ...cleanPersonFields, custom_fields: mergedPersonCustomFields, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        }

        const { data: existingStudent } = await supabaseAdmin
          .from('students')
          .select('id')
          .eq('person_id', existing.id)
          .single()

        if (existingStudent) {
          studentId = existingStudent.id
          const { data: existingEnrollment } = await supabaseAdmin
            .from('enrollments')
            .select('id, custom_fields')
            .eq('student_id', existingStudent.id)
            .single()

          if (existingEnrollment) {
            await supabaseAdmin.from('enrollments')
              .update({
                ...Object.fromEntries(
                  Object.entries(enrollmentColumns).filter(([, v]) => v !== null && v !== undefined)
                ),
                ...(instructorPersonId ? { instructor_person_id: instructorPersonId } : {}),
                custom_fields: {
                  ...existingEnrollment.custom_fields,
                  ...Object.fromEntries(
                    Object.entries(enrollmentFields).filter(([, v]) => v !== undefined)
                  ),
                  ...(attendanceRecords.length > 0
                    ? { attendance: mergeAttendanceEntries(existingEnrollment.custom_fields?.attendance, attendanceRecords) }
                    : {}),
                },
              })
              .eq('id', existingEnrollment.id)
          }

          if (client_status || last_attended) {
            await supabaseAdmin.from('students')
              .update({
                ...(client_status ? { client_status } : {}),
                ...(last_attended ? { last_attended } : {}),
              })
              .eq('id', existingStudent.id)
          }
        }

        updatedCount++
      } else {
        const { data: newPerson, error: personError } = await supabaseAdmin
          .from('people')
          .insert({ ...personFields, tenant_id: tenantId, custom_fields: normExternalId ? { external_id: normExternalId } : {} })
          .select('id')
          .single()

        if (personError || !newPerson) {
          console.error('Failed to create person:', personError)
          continue
        }

        // Register the new person in the dedup maps so later rows in the same batch dedupe correctly
        const newPersonRow: DedupPerson = {
          id: newPerson.id,
          phone: contact.phone,
          email: contact.email,
          first_name: contact.first_name,
          last_name: contact.last_name,
          custom_fields: normExternalId ? { external_id: normExternalId } : {},
        }
        if (normExternalId) externalIdMap.set(normExternalId, newPersonRow)
        if (normEmail) emailMap.set(normEmail, newPersonRow)
        if (normName) nameMap.set(normName, newPersonRow)
        if (normPhone) phoneMap.set(normPhone, newPersonRow)

        const { data: newAccount } = await supabaseAdmin
          .from('accounts')
          .insert({ tenant_id: tenantId, name: `${contact.first_name} ${contact.last_name} (account)`, email: contact.email, phone: contact.phone })
          .select('id')
          .single()

        const { data: newStudent } = await supabaseAdmin
          .from('students')
          .insert({
            tenant_id: tenantId,
            person_id: newPerson.id,
            account_id: newAccount?.id,
            client_status: client_status || 'active',
            last_attended: last_attended || null,
          })
          .select('id')
          .single()

        if (newStudent) {
          studentId = newStudent.id
          await supabaseAdmin.from('enrollments').insert({
            tenant_id: tenantId,
            student_id: newStudent.id,
            ...Object.fromEntries(
              Object.entries(enrollmentColumns).filter(([, v]) => v !== null && v !== undefined)
            ),
            ...(instructorPersonId ? { instructor_person_id: instructorPersonId } : {}),
            custom_fields: {
              ...enrollmentFields,
              ...(attendanceRecords.length > 0 ? { attendance: mergeAttendanceEntries(undefined, attendanceRecords) } : {}),
            },
          })
        }

        createdCount++
      }

      // Record roster snapshots for this student (resilient — no-op until the migration runs).
      // Derive one snapshot per month the student has sessions, so a single combined file
      // (e.g. August + September) yields per-month snapshots automatically.
      if (studentId) {
        const months = new Set<string>()
        for (const r of attendanceRecords) {
          if (r.session_date) months.add(r.session_date.slice(0, 7))
        }
        try {
          if (months.size > 0) {
            await supabaseAdmin.from('roster_snapshots').upsert(
              [...months].map((m) => ({
                tenant_id: tenantId,
                student_id: studentId,
                snapshot_date: `${m}-01`,
                is_active: true,
              })),
              { onConflict: 'tenant_id,student_id,snapshot_date' },
            )
          } else {
            const statusClass = classifyStatus(client_status, profile)
            const isActive = statusClass === 'active' || (statusClass === 'unknown' && !client_status)
            await supabaseAdmin.from('roster_snapshots').upsert({
              tenant_id: tenantId,
              student_id: studentId,
              snapshot_date: snapshotDate,
              is_active: isActive,
            }, { onConflict: 'tenant_id,student_id,snapshot_date' })
          }
        } catch (e) {
          console.warn('roster_snapshots: table may not exist yet —', (e as Error).message)
        }
      }
    }

    await supabaseAdmin
      .from('tenants')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', tenantId)

    return NextResponse.json({ message: 'Import successful', created: createdCount, updated: updatedCount })
  } catch (error) {
    console.error('Import failed:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}