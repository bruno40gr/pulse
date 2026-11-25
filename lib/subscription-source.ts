import Papa from 'papaparse'

export type SubscriptionSourceRow = {
  subscription_id: string; client_id: string; staff_id: string; staff_name: string
  service_name: string; plan_name: string; status: 'active' | 'pending'
  instrument: string; service_type: string; level: number | null; duration: number | null
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Subscription imports are identity-based snapshots, never attendance imports. */
export function readSubscriptionSource(csv: string): SubscriptionSourceRow[] | null {
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: 'greedy', transformHeader: value => value.trim() })
  if (!parsed.meta.fields?.includes('Primary Staff Name') || !parsed.meta.fields.includes('Plan Name')) return null
  if (parsed.errors.length || !['Id', 'Client Id', 'Primary Staff Id', 'Service Name', 'Status'].every(key => parsed.meta.fields?.includes(key))) throw new Error('Subscription export requires source subscription, client and staff IDs, service and status.')
  const ids = new Set<string>()
  return parsed.data.flatMap(row => {
    const status = row.Status?.trim().toLowerCase()
    if (status !== 'active' && status !== 'pending') return []
    const subscription_id = row.Id?.trim().toLowerCase()
    const client_id = row['Client Id']?.trim().toLowerCase()
    const staff_id = row['Primary Staff Id']?.trim().toLowerCase()
    if (![subscription_id, client_id, staff_id].every(id => uuid.test(id)) || ids.has(subscription_id)) throw new Error('Missing or duplicate source subscription identity.')
    ids.add(subscription_id)
    const service_name = row['Service Name']?.trim() || ''
    const plan_name = row['Plan Name']?.trim() || ''
    if (!service_name || !plan_name) throw new Error('Subscription service and plan are required.')
    const level = /\bLevel\s+(\d+)\b/i.exec(service_name)
    const duration = /\((\d+)[ -]?min/i.exec(service_name)
    const instrument = service_name.replace(/\s*-\s*Level\s+\d+.*$/i, '').replace(/\s*\(.*$/, '').trim()
    const service_type = /semi[ -]?private/i.test(`${service_name} ${plan_name}`) ? 'semi-private' : /group|band|little rockers/i.test(`${service_name} ${plan_name}`) ? 'group' : /private/i.test(plan_name) ? 'private' : ''
    return [{ subscription_id, client_id, staff_id, staff_name: row['Primary Staff Name']?.trim() || '', service_name, plan_name, status, instrument, service_type, level: level ? Number(level[1]) : null, duration: duration ? Number(duration[1]) : null }]
  })
}