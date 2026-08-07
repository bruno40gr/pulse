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
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('last_name', { ascending: true })

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { csv } = await request.json()
    if (!csv) return NextResponse.json({ error: 'No CSV data provided' }, { status: 400 })

    const parsedContacts = await parseCSV(csv)

    const { data: existingContacts, error: selectError } = await supabaseAdmin
      .from('contacts')
      .select('id, phone, email, first_name, last_name')
      .eq('tenant_id', getTenantId(request))

    if (selectError) throw selectError

    const phoneMap = new Map(existingContacts.map(c => [c.phone, c]))
    const emailMap = new Map(existingContacts.map(c => [c.email?.toLowerCase(), c]))
    const nameMap = new Map(existingContacts.map(c => [`${c.first_name} ${c.last_name}`.toLowerCase(), c]))

    let createdCount = 0
    let updatedCount = 0
    const toInsert: any[] = []
    const toUpdate: any[] = []

    for (const contact of parsedContacts) {
      const normPhone = contact.phone || null
      const normEmail = contact.email?.toLowerCase() || null
      const normName = `${contact.first_name} ${contact.last_name}`.toLowerCase()

      const existing =
        (normPhone && phoneMap.get(normPhone)) ||
        (normEmail && emailMap.get(normEmail)) ||
        nameMap.get(normName)

      // Extract music-school specific fields into custom_fields
      const { instrument, lesson_day, lesson_time, service_type, instructor, plan_name, session_name, last_attended, date_of_birth, tags, ...baseContact } = contact

      const custom_fields = {
        ...(instrument && { instrument }),
        ...(lesson_day && { lesson_day }),
        ...(lesson_time && { lesson_time }),
        ...(service_type && { service_type }),
        ...(instructor && { instructor }),
        ...(plan_name && { plan_name }),
        ...(session_name && { session_name }),
        ...(last_attended && { last_attended }),
      }

      if (existing) {
        const merged = { ...existing }
        for (const key in baseContact) {
          if ((baseContact as any)[key] !== null && (baseContact as any)[key] !== undefined) {
            (merged as any)[key] = (baseContact as any)[key]
          }
        }
        merged.custom_fields = { ...((existing as any).custom_fields || {}), ...custom_fields }
        if (tags?.length) merged.tags = tags
        toUpdate.push(merged)
      } else {
        toInsert.push({
          ...baseContact,
          ...(date_of_birth && { date_of_birth }),
          tenant_id: getTenantId(request),
          custom_fields,
          tags: tags || [],
        })
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabaseAdmin.from('contacts').insert(toInsert)
      if (error) throw error
      createdCount = toInsert.length
    }

    for (const contact of toUpdate) {
      const { error } = await supabaseAdmin
        .from('contacts')
        .update(contact)
        .eq('id', contact.id)
      if (error) console.warn('Update failed:', error.message)
      else updatedCount++
    }

    return NextResponse.json({ message: 'Import successful', created: createdCount, updated: updatedCount })
  } catch (error) {
    console.error('Import failed:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}