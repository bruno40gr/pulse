'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import DashboardShell from '@/beta-source/app/dashboard/DashboardShell'
import ContactsPage, { type Contact } from '@/app/dashboard/contacts/page'
import { ContactSampleContext } from '@/components/contacts/ContactPrototypeContext'
import StaffView from '@/beta-source/app/dashboard/staff/StaffView'
import StudentWorkspaceV3 from '@/beta-source/app/content-studio-prototype/students/StudentWorkspaceV3'
import SchoolSetup from '@/beta-source/app/content-studio-prototype/school-setup/SchoolSetup'
import type { SetupRecord } from '@/beta-source/app/content-studio-prototype/school-setup/setup-content'
import { Select } from '@/beta-source/components/ui/Select'
import { createDemoWorkspace } from '@/beta-source/lib/odeon-demo-workspace'
import { createDemoSetup } from '@/beta-source/lib/odeon-demo-setup'
import { createOdeonDemo } from '@/beta-source/lib/odeon-demo'
import { previewContacts, type FamilyPreviewData } from '@/beta-source/lib/academy-family-preview'
import type { MakeupPreviewState } from '@/beta-source/lib/academy-makeup-preview'
import StaffSlidePanel, { type StaffMember } from '@/beta-source/components/contacts/StaffSlidePanel'
import { colors, spacing } from '@/beta-source/lib/tokens'

const storageKey = 'odeon:app-sample:v2'
export default function DemoWorkspace({ onboarding = false }: { onboarding?: boolean }) {
  const params = useSearchParams()
  const [snapshot, setSnapshot] = useState(createDemoWorkspace)
  const [setup, setSetup] = useState(createDemoSetup)
  const [ready, setReady] = useState(false)
  const [staffId, setStaffId] = useState<string | null>(null)
  const seed = useMemo(createOdeonDemo, [])
  useEffect(() => {
    try { const saved = sessionStorage.getItem(storageKey); if (saved) { const parsed = JSON.parse(saved); if (parsed.snapshot?.data?.demoSchool && parsed.setup) { setSnapshot(parsed.snapshot); setSetup(parsed.setup) } } } catch { /* Optional local persistence. */ }
    setReady(true)
  }, [])
  useEffect(() => { if (ready) { try { sessionStorage.setItem(storageKey, JSON.stringify({ snapshot, setup })) } catch { /* In-memory fallback. */ } } }, [snapshot, setup, ready])
  const onChange = useCallback((data: FamilyPreviewData, makeups: MakeupPreviewState) => setSnapshot({ data, makeups }), [])
  const onSetup = useCallback((data: Record<string, SetupRecord[]>) => setSetup(data), [])
  const parent = params.get('view') === 'parent', staff = params.get('screen') === 'staff'
  const sampleStaff = useMemo(() => seed.teachers.map(teacher => ({ id: teacher.id, person_id: teacher.id, first_name: teacher.name.split(' ')[0], last_name: teacher.name.split(' ').slice(1).join(' '), email: teacher.email, phone: '(202) 555-0100', is_active: true })), [seed])
  const staffDetail = useMemo((): StaffMember | undefined => {
    const teacher = seed.teachers.find(item => item.id === staffId)
    if (!teacher) return undefined
    return { ...sampleStaff.find(item => item.id === teacher.id)!, role: 'teacher', date_of_birth: null, students: snapshot.data.students.flatMap(student => student.enrollments.filter(enrollment => enrollment.teacher === teacher.name).map(enrollment => ({ enrollment_id: enrollment.id, student_id: student.id, person_id: student.id, name: `${student.firstName} ${student.lastName}`, phone: student.phone, email: student.email, client_status: 'Member', last_attended: '2026-10-31', instrument: enrollment.program, service_type: enrollment.service, lesson_day: enrollment.day, lesson_time: enrollment.time }))) }
  }, [seed, staffId, snapshot.data, sampleStaff])
  if (!ready) return null
  if (onboarding) return <SchoolSetup demo configuredData={setup} onConfiguredChange={onSetup} />
  return <DashboardShell sample>
    <div style={{ padding: '6px 24px', background: colors.surfaceMuted, color: colors.textSecondary, fontSize: 12 }}>Beta · Sample data · Fictional records only · No real payments or messages · Changes are not shared with other testers</div>
    {parent && <div style={{ padding: spacing.lg }}><Select label="Preview family" value={params.get('account') || snapshot.data.accounts[0].id} onChange={event => { window.location.href = `/odeon-demo?view=parent&account=${encodeURIComponent(event.target.value)}` }}>{snapshot.data.accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</Select></div>}
    {staff ? <>
      <StaffView sampleStaff={sampleStaff} onOpenSample={setStaffId} />
      {staffDetail && <StaffSlidePanel staffId={staffDetail.id} sampleStaff={staffDetail} onClose={() => setStaffId(null)} onViewStudent={id => { const account = snapshot.data.accounts.find(item => item.studentIds.includes(id)); if (account) window.location.href = `/odeon-demo?view=quick&account=${encodeURIComponent(account.id)}&student=${encodeURIComponent(id)}` }} />}
    </> : <StudentWorkspaceV3 key={parent ? params.get('account') || 'parent' : 'staff'} initialData={snapshot.data} initialMakeups={snapshot.makeups} onDemoChange={onChange} renderContacts={({ data, onOpen }) => <SampleContacts data={data} onOpen={onOpen} />} />}
  </DashboardShell>
}

/** Published Contacts rows carry the account link the live table groups families by. */
type SandboxContact = Contact & {
  account_id: string | null
  account_holder_person_id: string | null
  account_holders: { person_id: string; name: string | null; phone: string | null; email: string | null; relationship: string | null; is_primary: boolean }[]
  is_student: boolean
  student_id: string | null
}

function SampleContacts({ data, onOpen }: { data: FamilyPreviewData; onOpen: (accountId: string, studentId?: string) => void }) {
  const contacts = useMemo((): SandboxContact[] => previewContacts(data).map(contact => {
    const student = data.students.find(item => item.id === contact.id), account = data.accounts.find(item => item.holderId === contact.id || item.studentIds.includes(contact.id))
    const isStudent = Boolean(student) && contact.id !== account?.holderId
    return { id: contact.id, first_name: contact.firstName, last_name: contact.lastName, email: contact.email || null, phone: contact.phone || null, client_status: 'Member', opted_out: false, last_attended: '2026-10-31', notes: null, family_name: account?.name || null, account_holder_name: account?.holderName || null, account_holder_email: account?.email || null, account_holder_phone: '(202) 555-0100', custom_fields: { program: student?.enrollments.map(item => item.program) || [], instructor: student?.enrollments.map(item => item.teacher) || [], service: student?.enrollments.map(item => item.service) || [] }, account_id: account?.id || null, account_holder_person_id: isStudent ? account?.holderId || null : null, account_holders: isStudent && account ? [{ person_id: account.holderId, name: account.holderName, phone: '(202) 555-0100', email: account.email, relationship: 'Parent', is_primary: true }] : [], is_student: isStudent, student_id: isStudent ? contact.id : null }
  }), [data])
  const onOpenContact = useCallback((id: string) => {
    const account = data.accounts.find(item => item.holderId === id || item.studentIds.includes(id))
    if (!account) return false
    onOpen(account.id, id === account.holderId ? undefined : id)
    return true
  }, [data, onOpen])
  return <ContactSampleContext.Provider value={{ contacts, onOpen: onOpenContact }}><ContactsPage /></ContactSampleContext.Provider>
}