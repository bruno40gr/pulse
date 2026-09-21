import { NextResponse } from 'next/server'
import { getActiveTeachers } from '@/lib/teachers'

export async function GET() {
  try {
    return NextResponse.json(await getActiveTeachers())
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}