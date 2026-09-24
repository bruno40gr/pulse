import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertTenantAccess } from '@/lib/access'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    // Actual schema: instructors table (id → person_id)
    const { data: instructorRecord, error } = await supabaseAdmin
      .from('instructors')
      .select(`
        id, tenant_id, specialty, created_at,
        person:people (
          id, first_name, last_name, phone, email, date_of_birth, custom_fields
        )
      `)
      .eq('id', id)
      .single()

    if (error || !instructorRecord) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    const access = await assertTenantAccess(request, instructorRecord.tenant_id)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const person = Array.isArray(instructorRecord.person) ? instructorRecord.person[0] : instructorRecord.person
    const personId = person?.id ?? null

    // Get students taught by this instructor via enrollments.instructor_person_id
    let students: any[] = []
    if (personId) {
      const { data: enrollments } = await supabaseAdmin
        .from('enrollments')
        .select(`
          id, instrument, service_type, lesson_day, lesson_time,
          student:students (
            id, client_status, last_attended,
            person:people ( id, first_name, last_name, phone, email )
          )
        `)
        .eq('instructor_person_id', personId)

      students = (enrollments || []).map((e: any) => {
        const student = Array.isArray(e.student) ? e.student[0] : e.student
        const studentPerson = Array.isArray(student?.person) ? student.person[0] : student?.person
        return {
          enrollment_id: e.id,
          student_id: student?.id ?? null,
          person_id: studentPerson?.id ?? null,
          name: studentPerson
            ? `${studentPerson.first_name} ${studentPerson.last_name}`
            : null,
          phone: studentPerson?.phone ?? null,
          email: studentPerson?.email ?? null,
          client_status: student?.client_status ?? null,
          last_attended: student?.last_attended ?? null,
          instrument: e.instrument,
          service_type: e.service_type,
          lesson_day: e.lesson_day,
          lesson_time: e.lesson_time,
        }
      })
    }

    return NextResponse.json({
      id: instructorRecord.id,
      role: 'instructor',
      is_active: (person?.custom_fields?.staff_status ?? 'active') !== 'sunset',
      created_at: instructorRecord.created_at,
      person_id: personId,
      first_name: person?.first_name ?? null,
      last_name: person?.last_name ?? null,
      phone: person?.phone ?? null,
      email: person?.email ?? null,
      date_of_birth: person?.date_of_birth ?? null,
      students,
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}