import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { parseCSV } from '@/lib/csv-parser'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function getTenantId(request: Request): string {
  const url = new URL(request.url)
  return url.searchParams.get('tenant') || DEFAULT_TENANT_ID
}

export async function GET(request: Request) {
  const tenantId = getTenantId(request)
  try {
    const { data, error } = await supabaseAdmin
      .from('people')
      .select(`
        id, tenant_id, first_name, last_name, phone, email,
        date_of_birth, opted_out, notes_history, student_notes_history,
        custom_fields, created_at, updated_at,
        students (
          id, client_status, last_attended, message_routing, is_minor, account_id,
          accounts ( id, name, phone, email ),
          enrollments ( instrument, service_type, lesson_day, lesson_time, plan_name, session_name, custom_fields )
        )
      `)
      .eq('tenant_id', tenantId)
      .order('last_name', { ascending: true })

    if (error) throw error

    // Flatten the joined data to match the old contacts shape
    const flattened = (data || []).map((person: any) => {
      const student = (person.students as any)?.[0] ?? {}
      const account = (student as any).accounts ?? {}
      const enrollment = (student as any).enrollments?.[0] ?? {}
      const enrollmentFields = (enrollment as any).custom_fields ?? {}

      return {
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
        account_id: student.account_id,
        account_holder_name: account.name,
        account_holder_phone: account.phone,
        account_holder_email: account.email,
        family_name: account.name,
        notes_history: person.notes_history || [],
        student_notes_history: person.student_notes_history || [],
        custom_fields: {
          ...person.custom_fields,
          ...enrollmentFields,
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
      }
    })

    return NextResponse.json(flattened)
  } catch (error) {
    console.error('Error fetching contacts:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { csv } = await request.json()
    if (!csv) return NextResponse.json({ error: 'No CSV data provided' }, { status: 400 })

    const url = new URL(request.url)
    const tenantId = url.searchParams.get('tenant') || DEFAULT_TENANT_ID

    const parsedContacts = await parseCSV(csv)

    // Fetch existing people for deduplication
    const { data: existingPeople } = await supabaseAdmin
      .from('people')
      .select('id, phone, email, first_name, last_name')
      .eq('tenant_id', tenantId)

    const phoneMap = new Map(existingPeople?.map(p => [p.phone, p]) || [])
    const emailMap = new Map(existingPeople?.map(p => [p.email?.toLowerCase(), p]) || [])
    const nameMap = new Map(existingPeople?.map(p => [`${p.first_name} ${p.last_name}`.toLowerCase(), p]) || [])

    let createdCount = 0
    let updatedCount = 0

    for (const contact of parsedContacts) {
      const normPhone = contact.phone || null
      const normEmail = contact.email?.toLowerCase() || null
      const normName = `${contact.first_name} ${contact.last_name}`.toLowerCase()

      const existing =
        (normPhone && phoneMap.get(normPhone)) ||
        (normEmail && emailMap.get(normEmail)) ||
        nameMap.get(normName)

      const { instrument, lesson_day, lesson_time, service_type, instructor,
              plan_name, session_name, band_name, last_attended, tags, client_status, ...baseContact } = contact

      const enrollmentFields: Record<string, any> = {
        instrument, lesson_day, lesson_time, service_type,
        plan_name, session_name,
        instructor, band_name,
      }

      if (existing) {
        // Update existing person — only write fields that have a value
        const cleanBaseContact = Object.fromEntries(
          Object.entries(baseContact).filter(([, v]) => v !== null && v !== undefined && v !== '')
        )
        if (Object.keys(cleanBaseContact).length > 0) {
          await supabaseAdmin.from('people')
            .update({ ...cleanBaseContact, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        }

        // Update their enrollment if it exists
        const { data: existingStudent } = await supabaseAdmin
          .from('students')
          .select('id')
          .eq('person_id', existing.id)
          .single()

        if (existingStudent) {
          const { data: existingEnrollment } = await supabaseAdmin
            .from('enrollments')
            .select('id, custom_fields')
            .eq('student_id', existingStudent.id)
            .single()

          if (existingEnrollment) {
            await supabaseAdmin.from('enrollments')
              .update({
                ...Object.fromEntries(
                  Object.entries(enrollmentFields).filter(([, v]) => v !== null && v !== undefined)
                ),
                custom_fields: {
                  ...existingEnrollment.custom_fields,
                  ...Object.fromEntries(
                    Object.entries(enrollmentFields).filter(([, v]) => v !== undefined)
                  ),
                },
              })
              .eq('id', existingEnrollment.id)
          }

          // Update student status
          if (client_status || last_attended) {
            await supabaseAdmin.from('students')
              .update({
                ...(client_status && { client_status }),
                ...(last_attended && { last_attended }),
              })
              .eq('id', existingStudent.id)
          }
        }

        updatedCount++
      } else {
        // Create new person
        const { data: newPerson, error: personError } = await supabaseAdmin
          .from('people')
          .insert({
            ...baseContact,
            tenant_id: tenantId,
            custom_fields: {},
          })
          .select('id')
          .single()

        if (personError || !newPerson) {
          console.error('Failed to create person:', personError)
          continue
        }

        // Create account
        const { data: newAccount } = await supabaseAdmin
          .from('accounts')
          .insert({
            tenant_id: tenantId,
            name: `${contact.first_name} ${contact.last_name} (account)`,
            email: contact.email,
            phone: contact.phone,
          })
          .select('id')
          .single()

        // Create student
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

        // Create enrollment
        if (newStudent) {
          await supabaseAdmin.from('enrollments').insert({
            tenant_id: tenantId,
            student_id: newStudent.id,
            ...Object.fromEntries(
              Object.entries(enrollmentFields).filter(([, v]) => v !== null && v !== undefined)
            ),
            custom_fields: enrollmentFields,
          })
        }

        createdCount++
      }
    }

    // Run deduplication
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/api/contacts/deduplicate`, {
      method: 'POST',
    }).catch(() => {})

    // Update tenant last_synced_at
    await supabaseAdmin
      .from('tenants')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', tenantId)

    return NextResponse.json({
      message: 'Import successful',
      created: createdCount,
      updated: updatedCount,
    })
  } catch (error) {
    console.error('Import failed:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}