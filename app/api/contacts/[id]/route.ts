import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const tryFetch = async (useNewJoins: boolean) => {
    const selectClause = useNewJoins
      ? `
        *,
        students (
          client_status, last_attended, message_routing, is_minor, account_id,
          accounts ( name, phone, email ),
          student_accounts (
            relationship,
            is_primary,
            accounts ( id, name, phone, email )
          ),
          enrollments (
            instrument, service_type, lesson_day, lesson_time, plan_name, session_name, custom_fields,
            instructor_id,
            instructor:staff (
              id,
              person:people ( id, first_name, last_name, phone, email )
            )
          )
        )
      `
      : `
        *,
        students (
          client_status, last_attended, message_routing, is_minor, account_id,
          accounts ( name, phone, email ),
          enrollments ( instrument, service_type, lesson_day, lesson_time, plan_name, session_name, custom_fields )
        )
      `

    return supabaseAdmin
      .from('people')
      .select(selectClause)
      .eq('id', id)
      .single()
  }

  try {
    let result = await tryFetch(true)

    // If the new query failed because tables don't exist, fall back
    if (result.error && (
      result.error.message?.includes('student_accounts') ||
      result.error.message?.includes('staff') ||
      result.error.code === 'PGRST200'
    )) {
      console.warn('New joins not available yet, falling back to legacy query:', result.error.message)
      result = await tryFetch(false)
    }

    const { data: person, error } = result
    if (error) throw error
    if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const student = (person as any).students?.[0] || {}
    const account = student.accounts || {}
    const enrollment = student.enrollments?.[0] || {}

    // Build account_holders array from student_accounts
    const studentAccounts = student.student_accounts ?? []
    const accountHolders = studentAccounts.map((sa: any) => ({
      name: sa.accounts?.name ?? null,
      phone: sa.accounts?.phone ?? null,
      email: sa.accounts?.email ?? null,
      relationship: sa.relationship ?? null,
      is_primary: sa.is_primary ?? false,
    }))

    // If no student_accounts yet (pre-migration), fall back to single account
    if (accountHolders.length === 0 && account.name) {
      accountHolders.push({
        name: account.name,
        phone: account.phone,
        email: account.email,
        relationship: null,
        is_primary: true,
      })
    }

    // Build instructor info from staff join
    const instructor = enrollment.instructor
    const instructorInfo = instructor ? {
      staff_id: instructor.id,
      person_id: instructor.person?.id ?? null,
      name: instructor.person
        ? `${instructor.person.first_name} ${instructor.person.last_name}`
        : null,
      phone: instructor.person?.phone ?? null,
      email: instructor.person?.email ?? null,
    } : null

    return NextResponse.json({
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
      message_routing: student.message_routing || 'account_holder',
      is_minor: student.is_minor ?? true,
      account_holder_name: account.name,
      account_holder_phone: account.phone,
      account_holder_email: account.email,
      family_name: account.name,
      account_holders: accountHolders,
      instructor: instructorInfo,
      notes_history: person.notes_history || [],
      student_notes_history: person.student_notes_history || [],
      custom_fields: {
        ...person.custom_fields,
        ...enrollment.custom_fields,
        instrument: enrollment.instrument,
        service_type: enrollment.service_type,
        lesson_day: enrollment.lesson_day,
        lesson_time: enrollment.lesson_time,
        plan_name: enrollment.plan_name,
        session_name: enrollment.session_name,
        band_name: enrollment.custom_fields?.band_name || person.custom_fields?.band_name,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()

    // Split fields by destination table
    const personFields = ['first_name', 'last_name', 'phone', 'email', 'date_of_birth',
                         'opted_out', 'notes_history', 'student_notes_history', 'custom_fields']
    const studentFields = ['client_status', 'last_attended', 'message_routing', 'is_minor', 'account_id']
    const accountFields = ['account_holder_name', 'account_holder_phone', 'account_holder_email', 'family_name']
    const enrollmentFields = ['band_name', 'instrument', 'service_type', 'lesson_day', 'lesson_time',
                              'plan_name', 'session_name', 'instructor', 'instructor_id']

    const personUpdate = Object.fromEntries(
      Object.entries(body).filter(([k]) => personFields.includes(k))
    )
    const studentUpdate = Object.fromEntries(
      Object.entries(body).filter(([k]) => studentFields.includes(k))
    )
    const enrollmentUpdate = Object.fromEntries(
      Object.entries(body).filter(([k]) => enrollmentFields.includes(k))
    )

    // Update person
    if (Object.keys(personUpdate).length > 0) {
      await supabaseAdmin.from('people')
        .update({ ...personUpdate, updated_at: new Date().toISOString() })
        .eq('id', id)
    }

    // Update student
    if (Object.keys(studentUpdate).length > 0) {
      await supabaseAdmin.from('students')
        .update(studentUpdate)
        .eq('person_id', id)
    }

    // Update enrollment custom_fields
    if (Object.keys(enrollmentUpdate).length > 0) {
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('person_id', id)
        .single()

      if (student) {
        const { data: enrollment } = await supabaseAdmin
          .from('enrollments')
          .select('id, custom_fields')
          .eq('student_id', student.id)
          .single()

        if (enrollment) {
          // Separate instructor_id from custom_fields
          const { instructor_id, ...customFieldUpdates } = enrollmentUpdate

          const updatePayload: any = {
            custom_fields: { ...enrollment.custom_fields, ...customFieldUpdates },
          }

          if (instructor_id !== undefined) {
            updatePayload.instructor_id = instructor_id
          }

          await supabaseAdmin.from('enrollments')
            .update(updatePayload)
            .eq('id', enrollment.id)
        }
      }
    }

    // Return updated flattened record
    const { data: person } = await supabaseAdmin
      .from('people')
      .select(`
        *,
        students (
          client_status, last_attended, message_routing, is_minor, account_id,
          accounts ( name, phone, email ),
          student_accounts (
            relationship,
            is_primary,
            accounts ( id, name, phone, email )
          ),
          enrollments (
            instrument, service_type, lesson_day, lesson_time, plan_name, session_name, custom_fields,
            instructor_id,
            instructor:staff (
              id,
              person:people ( id, first_name, last_name, phone, email )
            )
          )
        )
      `)
      .eq('id', id)
      .single()

    if (!person) throw new Error('Person not found')

    const student = (person as any).students?.[0] || {}
    const account = student.accounts || {}
    const enrollment = student.enrollments?.[0] || {}

    // Build account_holders array
    const studentAccounts = student.student_accounts ?? []
    const accountHolders = studentAccounts.map((sa: any) => ({
      name: sa.accounts?.name ?? null,
      phone: sa.accounts?.phone ?? null,
      email: sa.accounts?.email ?? null,
      relationship: sa.relationship ?? null,
      is_primary: sa.is_primary ?? false,
    }))

    if (accountHolders.length === 0 && account.name) {
      accountHolders.push({
        name: account.name,
        phone: account.phone,
        email: account.email,
        relationship: null,
        is_primary: true,
      })
    }

    const instructor = enrollment.instructor
    const instructorInfo = instructor ? {
      staff_id: instructor.id,
      person_id: instructor.person?.id ?? null,
      name: instructor.person
        ? `${instructor.person.first_name} ${instructor.person.last_name}`
        : null,
      phone: instructor.person?.phone ?? null,
      email: instructor.person?.email ?? null,
    } : null

    return NextResponse.json({
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
      message_routing: student.message_routing || 'account_holder',
      is_minor: student.is_minor ?? true,
      account_holder_name: account.name,
      account_holder_phone: account.phone,
      account_holder_email: account.email,
      family_name: account.name,
      account_holders: accountHolders,
      instructor: instructorInfo,
      notes_history: person.notes_history || [],
      student_notes_history: person.student_notes_history || [],
      custom_fields: {
        ...person.custom_fields,
        ...enrollment.custom_fields,
        instrument: enrollment.instrument,
        service_type: enrollment.service_type,
        lesson_day: enrollment.lesson_day,
        lesson_time: enrollment.lesson_time,
        plan_name: enrollment.plan_name,
        session_name: enrollment.session_name,
        band_name: enrollment.custom_fields?.band_name || person.custom_fields?.band_name,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: deleteId } = await params
  try {
    const { error } = await supabaseAdmin
      .from('contacts')
      .delete()
      .eq('id', deleteId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}