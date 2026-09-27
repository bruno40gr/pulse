import { NextResponse } from 'next/server'
import { getActiveTeachers, HEADLINER_TENANT_ID } from '@/lib/teachers'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const teachers = await getActiveTeachers()
    const personIds = teachers.map(teacher => teacher.personId)
    const { data: memberships, error } = personIds.length
      ? await supabaseAdmin
          .from('tenant_memberships')
          .select('person_id, status, auth_user_id')
          .eq('tenant_id', HEADLINER_TENANT_ID)
          .in('person_id', personIds)
      : { data: [], error: null }
    if (error) throw error
    const selectableMemberships = (memberships || []).filter(membership =>
      ['unclaimed', 'invited', 'active'].includes(membership.status)
    )
    const selectablePersonIds = new Set(selectableMemberships.map(membership => membership.person_id))
    const claimedPersonIds = new Set(selectableMemberships
      .filter(membership => membership.status === 'active' && membership.auth_user_id)
      .map(membership => membership.person_id))

    return NextResponse.json(teachers
      .filter(teacher => selectablePersonIds.has(teacher.personId))
      .map(teacher => ({
        instructorId: teacher.instructorId,
        displayName: teacher.displayName,
        accountClaimed: claimedPersonIds.has(teacher.personId),
      })))
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}