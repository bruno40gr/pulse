import { NextResponse } from 'next/server'
import { ACCESS_COOKIE_MAX_AGE_SECONDS, ACCESS_COOKIE_NAME, createAccessSession } from '@/lib/access'
import { getActiveTeachers } from '@/lib/teachers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const password = typeof body.password === 'string' ? body.password : ''
    const instructorId = typeof body.instructorId === 'string' ? body.instructorId.trim() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const expectedPassword = process.env.PULSE_SYSTEM_PASSWORD || '1478'

    if (password !== expectedPassword) return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })

    const teachers = await getActiveTeachers()
    let teacher = teachers.find((candidate) => candidate.instructorId === instructorId)
    if (!teacher && name) {
      const normalized = name.toLowerCase()
      teacher = teachers.find(
        (candidate) =>
          candidate.fullName.toLowerCase() === normalized ||
          candidate.displayName.toLowerCase() === normalized
      )
    }
    if (!teacher) return NextResponse.json({ error: 'Choose a valid teacher.' }, { status: 400 })

    const response = NextResponse.json({ actor: teacher })
    response.cookies.set(ACCESS_COOKIE_NAME, await createAccessSession({ ...teacher, access: { kind: 'headliner' } }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
    })
    return response
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Could not sign in.' }, { status: 500 })
  }
}