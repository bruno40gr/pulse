import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { data: person } = await supabaseAdmin
      .from('people')
      .select(`
        *,
        students (
          client_status, last_attended, message_routing, is_minor, account_id,
          accounts ( name, phone, email ),
          enrollments ( instrument, service_type, lesson_day, lesson_time, plan_name, session_name, custom_fields )
        )
      `)
      .eq('id', id)
      .single()

    if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const student = (person as any).students?.[0] || {}
    const account = student.accounts || {}
    const enrollment = student.enrollments?.[0] || {}

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
                              'plan_name', 'session_name', 'instructor']

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
          await supabaseAdmin.from('enrollments')
            .update({
              custom_fields: { ...enrollment.custom_fields, ...enrollmentUpdate },
            })
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
          enrollments ( instrument, service_type, lesson_day, lesson_time, plan_name, session_name, custom_fields )
        )
      `)
      .eq('id', id)
      .single()

    if (!person) throw new Error('Person not found')

    const student = (person as any).students?.[0] || {}
    const account = student.accounts || {}
    const enrollment = student.enrollments?.[0] || {}

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