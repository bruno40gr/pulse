import { NextResponse } from 'next/server'
import { contacts } from '../../../fixtures/contacts'

// This host has no production routes, middleware, environment files or clients.
// Unknown reads and every write fail closed instead of forwarding upstream.
export async function GET(request: Request) {
  const path = new URL(request.url).pathname
  if (path === '/api/contacts') return NextResponse.json(contacts)
  if (path.startsWith('/api/contacts/')) {
    const contact = contacts.find(item => item.id === decodeURIComponent(path.slice('/api/contacts/'.length)))
    return NextResponse.json(contact || { error: 'Fictional contact not found' }, { status: contact ? 200 : 404 })
  }
  if (path === '/api/tenant-fields' || path === '/api/funding/cases') return NextResponse.json([])
  if (path === '/api/tenant/sync-status') return NextResponse.json({ last_synced_at: '2026-11-09T12:00:00Z', is_demo: false })
  if (path === '/api/account/identity') return NextResponse.json({ firstName: 'Alex', fullName: 'Alex Adams', avatarUrl: null, isDemo: true })
  if (path === '/api/account/claim-reminder') return NextResponse.json({ show: false })
  if (path === '/api/account/me') return NextResponse.json({ tenantId: '00000000-0000-0000-0000-000000000001', membershipId: 'fictional-review' })
  if (path === '/api/notifications') return NextResponse.json({ notifications: [], unread_count: 0 })
  if (path === '/api/leads' || path === '/api/inbox') return NextResponse.json({ count: 0 })
  return NextResponse.json({ error: 'Unavailable in isolated preview' }, { status: 404 })
}

export async function POST() {
  return NextResponse.json({ error: 'No live writes in isolated preview' }, { status: 403 })
}

export const PATCH = POST
export const PUT = POST
export const DELETE = POST