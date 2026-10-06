# SMS reliability activation

Durable receipt is deployed. Session/page-open recovery is an alternative to a scheduler; no independent alert subscription is claimed.

The dashboard calls the tenant-authorized POST `/api/inbox/reconcile` once on mount after login and whenever Conversations opens. A database-atomic, per-tenant five-minute throttle shares work across staff and serverless instances. The call does not block login or inbox loading; existing inbox polling displays recovered messages. Demo sessions cannot trigger provider recovery. No browser receives provider credentials. Recovery does not run while everyone is offline.

1. Take a private main-database backup and rehearse `scripts/crm-consolidation/11-sms-reliability.sql`.
2. Install it in main, then deploy the reviewed release with `ODEON_DURABLE_SMS=enabled`.
3. Generate a private random `SMS_RECONCILIATION_SECRET` of at least 32 characters. Never put it in Git or chat.
4. Current operation uses the authenticated dashboard/session trigger described above; no scheduler is required or configured. The bearer-protected GET `/api/internal/sms-reconcile` remains available for authorized operator runs. An always-on scheduler is optional if recovery while staff are offline becomes necessary; it must independently alert on failed or missed runs. Do not leave a laptop process running as a permanent solution.
5. Configure Twilio webhook error email alarms independently. Alert configuration and delivery verification remain outstanding. If a scheduler is added later, test its failure alerts too; a job cannot detect its own failure to run.
6. Verify a signed duplicate, receipt recovery, intentional deletion, and a new inbound SMS. Review `sms_reconciliation_state.last_success_at` and `last_error` through privileged database access. No public health endpoint exposes tenant status.

## Boundaries

- No automatic recovery before the installation timestamp: old deletions have no tombstones. Review historical missing messages manually.
- Recovery overlaps the last successful run by seven days and preserves provider timestamps. Failed runs do not advance their checkpoint. Messages still unavailable from the provider after the overlap require operator review.
- Deletion trigger stores only tenant/SID/time and is atomic with message deletion. It prevents retry and reconciliation resurrection.
- Receipts are serialized and idempotent, validated against the receiving tenant/number, and committed with inbox storage. Errors return non-success for provider retries.
- Contact ambiguity does not discard a reply: store it by phone with no contact link. Opt-out updates apply only to an unambiguous resolved person.
- This path leaves CRM projections pending in the existing cutover queue. Keep the migration replay/drain process operational after cutover; do not purge pending receipts. Inbox delivery does not wait for CRM history.
- Reconciliation does not send messages. It exposes only checked/recovered counts, never message text or credentials.
- Carrier messages never received by Twilio cannot be recovered here. No zero-loss guarantee is claimed.