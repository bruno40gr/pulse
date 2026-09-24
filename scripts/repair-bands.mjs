// Repair band classification + band names for a tenant.
// Re-derives "band" service_type and the band/ensemble name from the Harmony
// reports, and patches existing enrollments (service_type + custom_fields.band_name).
//   node scripts/repair-bands.mjs           # dry run
//   node scripts/repair-bands.mjs --apply   # write changes
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

function readCsv(path) {
  if (!path) return []
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data
}

function detectServiceType(name) {
  const lower = String(name || '').toLowerCase()
  if (lower.includes('band') || lower.includes('101') || lower.includes('rock city')) return 'band'
  if (lower.includes('semi-private') || lower.includes('semi private')) return 'semi-private'
  if (lower.includes('group') || lower.includes('kids n keys')) return 'group'
  return 'private'
}

function deriveBandName(value) {
  if (!value) return null
  let t = String(value).trim()
  if (!t) return null
  t = t.replace(/\s*-\s*(mon|tue|wed|thu|fri|sat|sun)\s+\d{1,2}:\d{2}\s*(am|pm)/i, '')
  t = t.replace(/\s*\([^)]*make\s?up[^)]*\)/i, '')
  return t.trim() || null
}

function nameKeyOf(value) {
  if (!value) return ''
  return String(value).replace(/\s*\(account\)\s*$/i, '').trim().toLowerCase()
}

// ── Build student -> band_name map (band students only) ──────────────
const bandByStudent = new Map()

function addBand(student, serviceName, classOrAppt) {
  if (!student) return
  if (detectServiceType(serviceName) !== 'band') return
  const band = deriveBandName(classOrAppt)
  if (!band) return
  const key = nameKeyOf(student)
  if (!bandByStudent.has(key)) bandByStudent.set(key, band)
}

for (const row of readCsv(ATTENDANCE)) {
  const student = row['Client Name']
  const serviceName = row['Service Name'] || row['Appt/Class Name'] || ''
  addBand(student, serviceName, row['Appt/Class Name'])
}

for (const row of readCsv(SUBSCRIPTIONS)) {
  const student = row['Client Name']
  const serviceName = row['Plan Name'] || ''
  addBand(student, serviceName, row['Class'])
}

console.log('Tenant:', TENANT_ID)
console.log('Mode:', APPLY ? 'APPLY (writing)' : 'DRY RUN (no changes)')
console.log('Band students found in reports:', bandByStudent.size)
console.log('')

const { data: people, error: peopleErr } = await supabase
  .from('people')
  .select('id, first_name, last_name, students(id, enrollments(id, service_type, custom_fields))')
  .eq('tenant_id', TENANT_ID)
if (peopleErr) { console.error('fetch people error:', peopleErr.message); process.exit(1) }

let bandPeople = 0
const updates = []
for (const person of people || []) {
  const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim()
  const band = bandByStudent.get(nameKeyOf(fullName))
  if (!band) continue
  bandPeople++
  for (const student of person.students || []) {
    for (const enrollment of student.enrollments || []) {
      const existing = enrollment.custom_fields || {}
      const needService = enrollment.service_type !== 'band'
      const needBand = existing.band_name !== band
      if (needService || needBand) {
        updates.push({
          enrollment_id: enrollment.id,
          service_type: 'band',
          custom_fields: { ...existing, band_name: band },
        })
      }
    }
  }
}

console.log('Band people in DB matched:', bandPeople)
console.log('Enrollments to update:', updates.length)

if (!APPLY) {
  let shown = 0
  for (const [name, band] of bandByStudent) {
    if (shown >= 15) break
    console.log(`  ${name}  ->  ${band}`)
    shown++
  }
  console.log('\nRe-run with --apply to write changes.')
  process.exit(0)
}

let updated = 0
for (const u of updates) {
  const { error } = await supabase
    .from('enrollments')
    .update({ service_type: u.service_type, custom_fields: u.custom_fields })
    .eq('id', u.enrollment_id)
  if (error) console.log('  enrollment update failed:', u.enrollment_id, error.message)
  else updated++
}

console.log('\nDone. enrollmentsUpdated=', updated)

