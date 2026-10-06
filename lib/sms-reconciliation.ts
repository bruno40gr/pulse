import { supabaseAdmin } from '@/lib/supabase/admin'

type ProviderMessage = {
  sid: string; direction: string; from: string; to: string; body: string; date_sent: string
}

// Exported pure validation for tests. A provider pagination URL must never leak credentials.
export function providerPageUrl(path: string, accountSid: string): URL {
  const url = new URL(path, 'https://api.twilio.com')
  if (url.origin !== 'https://api.twilio.com' || url.username || url.password
    || url.pathname !== `/2010-04-01/Accounts/${accountSid}/Messages.json`) {
    throw new Error('Invalid provider pagination URL')
  }
  return url
}

export async function reconcileInboundSms(tenantId?: string, throttle = false) {
  let query = supabaseAdmin.from('twilio_config')
    .select('tenant_id,account_sid,auth_token,phone_number')
  if (tenantId) query = query.eq('tenant_id', tenantId)
  const { data: configs, error } = await query
  if (!error && tenantId && !configs?.length) return { checked: 0, recovered: 0 }
  if (error || !configs?.length) throw new Error('SMS configuration unavailable')
  let recovered = 0
  let checked = 0
  for (const config of configs) {
    const tenantId = config.tenant_id
    const attempt = new Date().toISOString()
    try {
      if (throttle) {
        // Atomic per-tenant claim prevents simultaneous logins/page opens from
        // starting duplicate provider scans across serverless instances.
        const cutoff = new Date(Date.now() - 5 * 60000).toISOString()
        const { data: claimed, error: claimError } = await supabaseAdmin.from('sms_reconciliation_state')
          .update({ last_attempt_at: attempt }).eq('tenant_id', tenantId)
          .or(`last_attempt_at.is.null,last_attempt_at.lt.${cutoff}`).select('tenant_id')
        if (claimError) throw new Error('SMS reconciliation claim failed')
        if (!claimed?.length) continue
      }
      const { data: state, error: stateError } = await supabaseAdmin.from('sms_reconciliation_state')
        .select('started_at,last_success_at').eq('tenant_id', tenantId).single()
      if (stateError || !state) throw new Error('SMS reconciliation is not initialized')
      const start = new Date(state.started_at).getTime()
      const last = state.last_success_at ? new Date(state.last_success_at).getTime() : start
      // Overlap handles delayed provider visibility and interrupted runs. Never resurrect
      // pre-rollout deletions: old deletions have no tombstone and require manual review.
      const from = new Date(Math.max(start, last - 7 * 86400000))
      if (!Number.isFinite(from.getTime())) throw new Error('Invalid reconciliation checkpoint')
      let path: string | null = `/2010-04-01/Accounts/${config.account_sid}/Messages.json?${new URLSearchParams({
        To: config.phone_number, 'DateSent>': from.toISOString().slice(0, 10), PageSize: '1000',
      })}`
      const incoming: ProviderMessage[] = []
      let pages = 0
      while (path) {
        if (++pages > 20) throw new Error('SMS history requires operator review')
        const response = await fetch(providerPageUrl(path, config.account_sid), {
          headers: { Authorization: `Basic ${Buffer.from(`${config.account_sid}:${config.auth_token}`).toString('base64')}` },
          cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
        })
        if (!response.ok) throw new Error('SMS provider history unavailable')
        const page = await response.json() as { messages: ProviderMessage[]; next_page_uri: string | null }
        if (!Array.isArray(page.messages)) throw new Error('Invalid provider history')
        incoming.push(...page.messages.filter(message => message.direction === 'inbound'
          && message.to === config.phone_number && new Date(message.date_sent).getTime() >= from.getTime()
          && new Date(message.date_sent).getTime() <= new Date(attempt).getTime()))
        path = page.next_page_uri
      }
      let tenantRecovered = 0
      for (const message of incoming.sort((a, b) => Date.parse(a.date_sent) - Date.parse(b.date_sent))) {
        const { data: outcome, error: receiptError } = await supabaseAdmin.rpc('odeon_sms_receive', {
          p_tenant_id: tenantId, p_received_at: new Date(message.date_sent).toISOString(),
          p_payload: { message_sid: message.sid, from_phone: message.from, to_phone: message.to, body: message.body },
        })
        if (receiptError || !['saved', 'existing', 'deleted'].includes(outcome)) throw new Error('SMS receipt recovery failed')
        checked++
        if (outcome === 'saved') tenantRecovered++
      }
      const { error: updateError } = await supabaseAdmin.from('sms_reconciliation_state').update({
        last_attempt_at: attempt, last_success_at: attempt, last_error: null, recovered_count: tenantRecovered,
      }).eq('tenant_id', tenantId)
      if (updateError) throw new Error('SMS checkpoint update failed')
      recovered += tenantRecovered
    } catch {
      await supabaseAdmin.from('sms_reconciliation_state').update({
        last_attempt_at: attempt, last_error: 'Reconciliation failed; operator review required',
      }).eq('tenant_id', tenantId)
      // No sender, message content, tokens, or provider response bodies in logs.
      throw new Error('SMS reconciliation failed')
    }
  }
  return { checked, recovered }
}