// Backfill family/account-holder accounts for a tenant.
// Re-derives the account holder (parent/payer) from the Harmony reports and
// creates/reuses one shared account per family, re-points students at it, and
// deletes orphaned "<Student> (account)" rows.
//   node scripts/migrations/backfill-family-accounts.mjs           # dry run
//   node scripts/migrations/backfill-family-accounts.mjs --apply   # write changes
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'
import Papa from 'papaparse'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TENANT_ID = env.CRM_TENANT_ID || '00000000-0000-0000-0000-000000000001'
const APPLY = process.argv.includes('--apply')
const downloads = join(os.homedir(), 'Downloads')

function findReport(basename) {
  const direct = join(downloads, basename)
  if (existsSync(direct)) return direct
  const prefix = basename.split('_')[0]
  const file = readdirSync(downloads).find((f) => f.startsWith(prefix) && f.endsWith('.csv'))
  return file ? join(downloads, file) : null
}

const ATTENDANCE = env.ATTENDANCE_CSV || findReport('attendance_report_September_3,_2026_5_40_PM_PDT.csv')
const SUBSCRIPTIONS = env.SUBSCRIPTIONS_CSV || findReport('subscriptions_report_September_3,_2026_5_39_PM_PDT.csv')
const TRANSACTIONS = env.TRANSACTIONS_CSV || findReport('transactions_report_September_4,_2026_11_52_AM_PDT.csv')

function readCsv(path) {
  if (!path) return []
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data
}

function normalizePhone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 10) return '1' + digits
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits
  return null
}

function phoneKey(value) {
  if (!value) return null
  const digits = String(value).replace(/\D/g, '')
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  if (digits.length >= 7) return digits
  return null
}

function emailKey(value) {
  if (!value) return null
  const t = String(value).trim().toLowerCase()
  if (!t || t === '-' || t === '—' || ['n/a', 'none', 'null'].includes(t)) return null
  return t
}

function nameKeyOf(value) {
  if (!value) return ''
  return String(value).replace(/\s*\(account\)\s*$/i, '').trim().toLowerCase()
}

// ── 1. Build student -> account holder map from the reports ─────────────
const payerPhoneByEmail = new Map()
const payerPhoneByName = new Map()
for (const row of readCsv(TRANSACTIONS)) {
  const email = emailKey(row['Payer Email'])
  const name = nameKeyOf(row['Payer Name'])
  const phone = normalizePhone(row['Payer Phone'])
  if (email && phone && !payerPhoneByEmail.has(email)) payerPhoneByEmail.set(email, phone)
  if (name && phone && !payerPhoneByName.has(name)) payerPhoneByName.set(name, phone)
}

// studentName -> { name, email, phone }
const accountHolderByStudent = new Map()

function mergeHolder(studentName, holder) {
  if (!studentName) return
  const key = nameKeyOf(studentName)
  const existing = accountHolderByStudent.get(key) || { name: null, email: null, phone: null }
  accountHolderByStudent.set(key, {
    name: existing.name || holder.name,
    email: existing.email || holder.email,
    phone: existing.phone || holder.phone,
  })
}

for (const row of readCsv(ATTENDANCE)) {
  const student = row['Client Name']
  const name = row['AccountManager 1 name'] || row['AccountManager 2 name'] || null
  const email = emailKey(row['AccountManager 1 email'] || row['AccountManager 2 email'])
  const phone = normalizePhone(row['AccountManager 1 phone 1'] || row['AccountManager 1 phone 2'] || row['AccountManager 2 phone 1'])
  if (student) mergeHolder(student, { name, email, phone })
}

for (const row of readCsv(SUBSCRIPTIONS)) {
  const student = row['Client Name']
  const name = row['Payer Name'] || null
  const email = emailKey(row['Payer Email'])
  const phone = (email && payerPhoneByEmail.get(email)) || (nameKeyOf(name) && payerPhoneByName.get(nameKeyOf(name))) || null
  if (student) mergeHolder(student, { name, email, phone })
}

// ── 2. Resolve / create shared accounts and reassign students ────────────
console.log('Tenant:', TENANT_ID)
console.log('Mode:', APPLY ? 'APPLY (writing)' : 'DRY RUN (no changes)')
console.log('Students mapped to an account holder:', accountHolderByStudent.size)
console.log('')

const { data: people, error: peopleErr } = await supabase
  .from('people')
  .select('id, first_name, last_name, students(id, account_id)')
  .eq('tenant_id', TENANT_ID)
if (peopleErr) { console.error('fetch people error:', peopleErr.message); process.exit(1) }

const { data: accounts } = await supabase
  .from('accounts')
  .select('id, name, email, phone')
  .eq('tenant_id', TENANT_ID)

const accountByEmail = new Map()
const accountByPhone = new Map()
const accountByName = new Map()
for (const a of accounts || []) {
  const ek = emailKey(a.email)
  if (ek && !accountByEmail.has(ek)) accountByEmail.set(ek, a)
  const pk = phoneKey(a.phone)
  if (pk && !accountByPhone.has(pk)) accountByPhone.set(pk, a)
  const nk = nameKeyOf(a.name)
  if (nk && !accountByName.has(nk)) accountByName.set(nk, a)
}

function registerAccount(a) {
  const ek = emailKey(a.email)
  if (ek && !accountByEmail.has(ek)) accountByEmail.set(ek, a)
  const pk = phoneKey(a.phone)
  if (pk && !accountByPhone.has(pk)) accountByPhone.set(pk, a)
  const nk = nameKeyOf(a.name)
  if (nk && !accountByName.has(nk)) accountByName.set(nk, a)
}

let createdAccounts = 0
let reassignedStudents = 0
let updatedAccounts = 0
const accountsToCreate = []
const studentsToReassign = []
const accountsToDelete = []
const finalAccountIds = new Set()

for (const person of people || []) {
  const studentRow = (person.students && person.students[0]) || null
  if (!studentRow) continue

  const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim()
  const holder = accountHolderByStudent.get(nameKeyOf(fullName))

  const hasHolder = holder && (holder.name || holder.email || holder.phone)
  const accountName = (hasHolder ? holder.name : fullName) || fullName
  const accountEmail = hasHolder ? holder.email : null
  const accountPhone = hasHolder ? holder.phone : null

  const ek = emailKey(accountEmail)
  const pk = phoneKey(accountPhone)
  const nk = nameKeyOf(accountName)

  let account = (ek && accountByEmail.get(ek)) || (pk && accountByPhone.get(pk)) || (nk && accountByName.get(nk)) || null

  if (!account) {
    const created = { tenant_id: TENANT_ID, name: accountName, email: accountEmail, phone: accountPhone }
    accountsToCreate.push(created)
    account = { id: `new-${accountsToCreate.length}`, name: accountName, email: accountEmail, phone: accountPhone }
    registerAccount(account)
    createdAccounts++
  } else if ((accountEmail && !account.email) || (accountPhone && !account.phone)) {
    accountsToDelete.push({ type: 'update', id: account.id, email: account.email || accountEmail, phone: account.phone || accountPhone })
    updatedAccounts++
  }

  if (studentRow.account_id !== account.id) {
    studentsToReassign.push({ student_id: studentRow.id, from: studentRow.account_id, to: account.id })
    reassignedStudents++
  }
  finalAccountIds.add(account.id)
}

for (const a of accounts || []) {
  if (!finalAccountIds.has(a.id)) accountsToDelete.push({ type: 'delete', id: a.id, name: a.name })
}

console.log('Accounts to create:', createdAccounts)
console.log('Students to reassign:', reassignedStudents)
console.log('Accounts to update (backfill email/phone):', updatedAccounts)
console.log('Orphaned accounts to delete:', accountsToDelete.filter((d) => d.type === 'delete').length)
console.log('')

if (!APPLY) {
  let shown = 0
  for (const [name, h] of accountHolderByStudent) {
    if (shown >= 12) break
    console.log(`  ${name}  ->  ${h.name || '(self)'}  ${h.email || ''}  ${h.phone || ''}`)
    shown++
  }
  console.log('\nRe-run with --apply to write changes.')
  process.exit(0)
}

for (const acc of accountsToCreate) {
  const { data, error } = await supabase.from('accounts').insert(acc).select('id').single()
  if (error) { console.log('  account create failed:', acc.name, error.message); continue }
  const idx = accountsToCreate.indexOf(acc)
  for (const r of studentsToReassign) if (r.to === `new-${idx + 1}`) r.to = data.id
  registerAccount({ id: data.id, name: acc.name, email: acc.email, phone: acc.phone })
}

for (const r of studentsToReassign) {
  if (String(r.to).startsWith('new-')) continue
  const { error } = await supabase.from('students').update({ account_id: r.to }).eq('id', r.student_id)
  if (error) console.log('  student reassign failed:', r.student_id, error.message)
}

for (const d of accountsToDelete) {
  if (d.type === 'update') {
    await supabase.from('accounts').update({ email: d.email, phone: d.phone }).eq('id', d.id)
  } else if (d.type === 'delete') {
    await supabase.from('accounts').delete().eq('id', d.id)
  }
}

console.log('\nDone. accountsCreated=', createdAccounts, 'studentsReassigned=', reassignedStudents)


