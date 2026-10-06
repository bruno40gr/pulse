// Explicitly authorized metadata-shaped GETs only. No RPCs, writes or row payload output.
const checks = [
  ['crm_contacts', 'id,tenant_id,full_name,email,phone'],
  ['lead_intakes', 'id,tenant_id,contact_id,category,status,crm_contacts(id,full_name,email,phone)'],
  ['lead_events', 'id,tenant_id,lead_intake_id,event_type,payload'],
  ['job_applications', 'id,tenant_id,contact_id,status,crm_contacts(id,full_name)'],
]

function configuration(env) {
  const ref = env.ODEON_API_CHECK_PROJECT_REF
  if (!/^[a-z]{20}$/.test(ref || '') || env.ODEON_API_CHECK_AUTHORIZE !== `read-only:${ref}`) {
    throw new Error('Explicit read-only project authorization required')
  }
  const url = new URL(env.ODEON_API_CHECK_URL)
  if (url.href !== `https://${ref}.supabase.co/`) throw new Error('Project URL mismatch')
  const key = env.ODEON_API_CHECK_SERVICE_KEY
  if (!key || /\s/.test(key)) throw new Error('Private service key required')
  return { url, key }
}

async function checkHostedApi(env, request = fetch) {
  const { url, key } = configuration(env)
  const results = []
  for (const [table, select] of checks) {
    const endpoint = new URL(`rest/v1/${table}`, url)
    endpoint.searchParams.set('select', select)
    endpoint.searchParams.set('limit', '0')
    let response
    try {
      response = await request(endpoint, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { apikey: key, authorization: `Bearer ${key}` },
      })
    } catch {
      throw new Error(`Hosted API transport failed for ${table}`)
    }
    // Never emit upstream errors: they may contain credentials, SQL or PII.
    if (!response.ok) throw new Error(`Hosted API check failed for ${table} (HTTP ${response.status})`)
    let body
    try { body = await response.json() } catch { throw new Error(`Invalid API response for ${table}`) }
    if (!Array.isArray(body) || body.length !== 0) throw new Error(`Expected zero-row response for ${table}`)
    results.push({ table, status: 'query-shape-accepted' })
  }
  return results
}

module.exports = { checkHostedApi, configuration }
if (require.main === module) {
  checkHostedApi(process.env).then(results => {
    for (const result of results) console.log(`${result.table}: ${result.status}`)
    console.log('LIMIT: no row values, RPC execution, RLS isolation or browser workflows verified.')
  }).catch(() => {
    console.error('Hosted API verification refused or failed. No response payload or credentials printed.')
    process.exitCode = 1
  })
}