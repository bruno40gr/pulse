import evidence from './legacy-billing-account-evidence.json'

/** Reviewed source-ID evidence, not a name/age/destination heuristic. Display
 * suppression only; billing, recipient resolution and reminder ownership stay put. */
export function isLegacyStudentBillingAccount(tenantId: string, accountId: string | undefined, sourceClientId: string | undefined) {
  return tenantId === evidence.tenant_id && evidence.billing_only_student_accounts.some(row =>
    row.account_id === accountId && row.source_client_id === sourceClientId
    && row.source_manager_ids.length > 0 && !row.source_manager_ids.includes(sourceClientId || ''))
}