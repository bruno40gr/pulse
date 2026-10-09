// Pure transformation: no credentials, connections, or filesystem access.
const { createHash, createHmac } = require('node:crypto');
const TABLES = ['accounts', 'people', 'students', 'contacts', 'crm_contacts', 'lead_intakes', 'lead_events', 'messages', 'notes', 'note_replies'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STRUCTURAL = new Set(['status', 'client_status', 'contact_kind', 'lifecycle_stage', 'intake_type', 'source_system', 'source_form', 'category', 'priority', 'temperature', 'direction', 'channel', 'event_type', 'message_routing', 'color']);
const VALUES = new Set(['new', 'active', 'inactive', 'paused', 'disenrolled', 'lead', 'customer', 'student', 'lesson_inquiry', 'tour_request', 'service_inquiry', 'job_application', 'headliner-website', 'website', 'manual-meta', 'manual', 'app_booking_modal', 'booking_interstitial', 'untriaged', 'lesson', 'lessons', 'service', 'services', 'normal', 'high', 'low', 'urgent', 'hot', 'warm', 'cold', 'inbound', 'outbound', 'sms', 'email', 'call', 'sent', 'received', 'delivered', 'failed', 'undelivered', 'queued', 'read', 'unread', 'contacted', 'qualified', 'won', 'lost', 'converted', 'follow_up', 'nurture', 'archived', 'account_holder', 'student', 'yellow', 'blue', 'green', 'pink', 'purple', 'white', 'created', 'updated', 'status_changed', 'note_added', 'sms_received', 'sms_sent', 'call_started', 'call_completed']);
const SAFE_KEYS = new Set(['text', 'timestamp', 'completed_at', 'fixture', 'staff_status', 'age', 'age_group', 'belt_level', 'class_day', 'grade', 'instructor', 'level', 'program', 'session_day', 'subject', 'staff_start_date', 'message', 'student_name', 'parent_name', 'account_holder_name', 'name', 'notes', 'payload', 'actor', 'updates', 'status', 'previous_status', 'next_status', 'source', 'source_form', 'source_page', 'intake_type', 'category', 'phone', 'email', 'first_name', 'last_name', 'full_name', 'displayName', 'personId', 'instructorId', 'membershipId', 'instrument', 'instrument_interest', 'instrument_or_program', 'experience', 'experience_level', 'preferred_date', 'preferred_days', 'preferred_times', 'time_window', 'follow_up_at', 'follow_up_note', 'lost_reason', 'sibling_count', 'siblings', 'family_members_interested', 'session_value', 'potential_value_base', 'potential_value_total', 'opportunity_value_unit', 'discount_offer_applied', 'promotion_type', 'promotion_offer', 'offer_description', 'offer_code', 'service_type', 'service_types', 'program_label', 'service_label', 'reason', 'duration', 'imported_at', 'disenrollment_date', 'disenrollment_month', 'is_fictional_demo_data', 'imported', 'imported_from_event_roster', 'to_phone', 'agent_phone', 'twilio_sid', 'call_sid', 'campaign_id', 'new_contact_id', 'previous_contact_id', 'source_received_at']);
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function mask(value) {
  // Preserve length, whitespace, punctuation and broad Unicode layout classes.
  return value.replace(/[\p{L}\p{N}\p{S}]/gu, c => /[0-9]/.test(c) ? '0' : /[A-Z]/.test(c) ? 'X' : /[a-z]/.test(c) ? 'x' : c.codePointAt(0) > 0xffff ? '🧪' : '文');
}
function sanitizeSnapshot(input, secret) {
  if (!secret || secret.length < 32) throw Error('A private per-refresh salt is required');
  const privateHash = value => createHmac('sha256', secret).update(value).digest('hex');
  if (!input || Object.keys(input).sort().join() !== [...TABLES, 'tenants'].sort().join()) throw Error('Unexpected snapshot table inventory');
  const ids = new Map();
  const mapId = id => {
    if (!ids.has(id)) { const h = privateHash('staging-id:' + id); ids.set(id, `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`); }
    return ids.get(id);
  };
  for (const tenant of input.tenants) {
    if (!['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003'].includes(tenant.id)) throw Error('Unreviewed tenant mapping');
    ids.set(tenant.id, tenant.id);
  }
  function clean(value, key = '') {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map(v => clean(v, key));
    if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [SAFE_KEYS.has(k) ? k : 'field_' + hash(k).slice(0,12), clean(v,k)]));
    if (typeof value !== 'string') return value;
    if (UUID.test(value)) return mapId(value);
    if ((/(?:_at|timestamp|_date|date_of_birth)$/.test(key) || key === 'last_attended') && /^\d{4}-\d{2}-\d{2}(?:$|[T ])/.test(value) && !Number.isNaN(Date.parse(value))) return value;
    if (STRUCTURAL.has(key) && VALUES.has(value)) return value;
    if (/email/i.test(key)) return value.trim() ? `test-${privateHash(value.toLowerCase()).slice(0,20)}@example.invalid` : value;
    if (/phone/i.test(key)) {
      let i = 0; const digits = '000' + privateHash(value).replace(/[a-f]/g,c => String(parseInt(c,16)%10));
      return value.replace(/\d/g, () => digits[i++ % digits.length]);
    }
    return mask(value);
  }
  const output = { tenants: input.tenants.map((t,i) => ({ ...t, id: t.id, name: `Staging School ${i + 1}` })) };
  for (const table of TABLES) {
    if (!Array.isArray(input[table])) throw Error('Invalid snapshot rows');
    output[table] = input[table].map(row => Object.fromEntries(Object.entries(row).map(([k,v]) => [k, clean(v,k)])));
    for (const [index,row] of output[table].entries()) {
      if (table === 'messages') { row.campaign_id = null; row.media_url = null; row.twilio_sid = input[table][index].twilio_sid ? 'STAGING_' + privateHash(input[table][index].twilio_sid).slice(0,24) : null; }
      if (table === 'notes' || table === 'note_replies') row.created_by_membership_id = null;
      if (table === 'accounts') row.card_on_file = false;
    }
  }
  return output;
}
module.exports = { TABLES, sanitizeSnapshot, mask };