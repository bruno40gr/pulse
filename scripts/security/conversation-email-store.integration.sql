-- Run only against a disposable PostgreSQL database with the migration applied.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.tenants(id) VALUES ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
INSERT INTO public.gmail_connections(id,tenant_id,email,refresh_token_ciphertext,connected_by) VALUES
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','office@example.invalid','synthetic','30000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','office@example.invalid','synthetic','30000000-0000-0000-0000-000000000002');
DO $$
DECLARE
  tenant uuid := '10000000-0000-0000-0000-000000000001';
  mailbox uuid := '20000000-0000-0000-0000-000000000001';
  history_job uuid;
  lease uuid := gen_random_uuid();
  old_lease uuid := gen_random_uuid();
  import_job uuid;
  overlap_job uuid;
  saved_freshness timestamptz;
BEGIN
  BEGIN
    INSERT INTO public.conversation_email_mailboxes(tenant_id,connection_id) VALUES(tenant,'20000000-0000-0000-0000-000000000002');
    RAISE EXCEPTION 'Cross-tenant mailbox accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  IF has_table_privilege('authenticated','public.conversation_email_messages','SELECT') OR
    has_function_privilege('authenticated','public.conversation_email_claim()','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated role can access service-only store';
  END IF;
  INSERT INTO public.conversation_email_jobs(tenant_id,connection_id,kind,job_key,range_start,range_end,status,lease_token,lease_until)
    VALUES(tenant,mailbox,'import','recovery-test','2026-10-01','2026-11-01','running',old_lease,now()-interval '1 minute') RETURNING id INTO import_job;
  INSERT INTO public.conversation_email_jobs(tenant_id,connection_id,kind,job_key,status,lease_token,lease_until)
    VALUES(tenant,mailbox,'history','history','running',lease,now()+interval '1 minute') RETURNING id INTO history_job;
  INSERT INTO public.conversation_email_messages(tenant_id,connection_id,provider_message_id,provider_thread_id,sent_at,direction,sender,participants,subject,body)
    VALUES(tenant,mailbox,'deleted','thread',now(),'inbound','parent@example.com','{parent@example.com}','Old','Deleted at provider');
  IF public.conversation_email_commit(history_job,gen_random_uuid(),'[]','{}','{"recover":true}',true,'new-baseline') THEN
    RAISE EXCEPTION 'Stale lease accepted';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_email_messages WHERE tenant_id=tenant) THEN RAISE EXCEPTION 'Stale worker changed data'; END IF;
  IF NOT public.conversation_email_commit(history_job,lease,'[]','{}','{"recover":true}',true,'new-baseline') THEN RAISE EXCEPTION 'Recovery rejected'; END IF;
  IF EXISTS(SELECT 1 FROM public.conversation_email_messages WHERE tenant_id=tenant) THEN RAISE EXCEPTION 'Missed deletions not reconciled'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_email_jobs WHERE id=import_job AND status='pending' AND checkpoint='{}' AND lease_token IS NULL) THEN RAISE EXCEPTION 'Import coverage not reset'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_email_mailboxes WHERE tenant_id=tenant AND history_id='new-baseline') THEN RAISE EXCEPTION 'Baseline not committed'; END IF;
  IF EXISTS(SELECT 1 FROM public.conversation_email_mailboxes WHERE tenant_id=tenant AND last_synced_at IS NOT NULL) THEN RAISE EXCEPTION 'Recovery baseline incorrectly marked fresh'; END IF;
  IF public.conversation_email_commit(import_job,old_lease,'[]','{}','{}',true) THEN RAISE EXCEPTION 'Expired import committed'; END IF;
  UPDATE public.conversation_email_jobs SET status='reconnect',last_error='reconnect_required' WHERE id=history_job;
  UPDATE public.conversation_email_jobs SET status='running',lease_token=old_lease,lease_until=now()+interval '1 minute',checkpoint='{"cursor":"saved"}' WHERE id=import_job;
  UPDATE public.gmail_connections SET refresh_token_ciphertext='replacement-test-token' WHERE id=mailbox;
  IF EXISTS(SELECT 1 FROM public.conversation_email_jobs WHERE connection_id=mailbox AND (status<>'pending' OR lease_token IS NOT NULL OR last_error IS NOT NULL)) THEN RAISE EXCEPTION 'Credential update did not resume jobs'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_email_jobs WHERE id=import_job AND checkpoint->>'cursor'='saved') THEN RAISE EXCEPTION 'Reconnect lost import progress'; END IF;
  IF public.conversation_email_commit(import_job,old_lease,'[]','{}','{}',true) THEN RAISE EXCEPTION 'Worker with old credentials committed'; END IF;
  UPDATE public.conversation_email_jobs SET status='running',lease_token=lease,lease_until=clock_timestamp()+interval '50 milliseconds' WHERE id=history_job;
  PERFORM pg_sleep(0.1);
  IF public.conversation_email_commit(history_job,lease,'[]','{}','{}',true,'expired') THEN RAISE EXCEPTION 'Transaction-start time accepted an expired lease'; END IF;
  UPDATE public.conversation_email_jobs SET status='running',lease_token=lease,lease_until=clock_timestamp()+interval '1 minute' WHERE id=history_job;
  IF NOT public.conversation_email_commit(history_job,lease,'[]','{}','{}',true,'fresh') THEN RAISE EXCEPTION 'Fresh history commit rejected'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_email_mailboxes WHERE tenant_id=tenant AND history_id='fresh' AND last_synced_at IS NOT NULL) THEN RAISE EXCEPTION 'Completed history did not mark freshness'; END IF;
  UPDATE public.conversation_email_jobs SET status='running',lease_token=old_lease,lease_until=clock_timestamp()+interval '1 minute' WHERE id=import_job;
  IF NOT public.conversation_email_commit(import_job,old_lease,'[]','{}','{}',true) THEN RAISE EXCEPTION 'Import commit rejected'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_email_mailboxes WHERE tenant_id=tenant AND history_id='fresh' AND last_synced_at IS NOT NULL) THEN RAISE EXCEPTION 'Import changed history freshness'; END IF;
  SELECT last_synced_at INTO saved_freshness FROM public.conversation_email_mailboxes WHERE connection_id=mailbox;
  INSERT INTO public.conversation_email_jobs(tenant_id,connection_id,kind,job_key,range_start,range_end,status,lease_token,lease_until)
    VALUES(tenant,mailbox,'import','overlapping','2026-10-15','2026-11-15','running',lease,clock_timestamp()+interval '1 minute') RETURNING id INTO overlap_job;
  IF NOT public.conversation_email_commit(overlap_job,lease,'[]','{}','{"batch":{"ids":["remaining"],"next":{},"complete":true}}',false) THEN RAISE EXCEPTION 'Partial overlap failed'; END IF;
  IF EXISTS(SELECT 1 FROM public.conversation_email_jobs WHERE id=overlap_job AND status='complete') THEN RAISE EXCEPTION 'Partial import marked complete'; END IF;
  UPDATE public.conversation_email_jobs SET status='running',lease_token=lease,lease_until=clock_timestamp()+interval '1 minute' WHERE id=history_job;
  IF NOT public.conversation_email_commit(history_job,lease,'[]','{}','{"history":"fresh","cursor":"next-page"}',false) THEN RAISE EXCEPTION 'Interleaved partial history failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_email_mailboxes WHERE connection_id=mailbox AND history_id='fresh' AND last_synced_at=saved_freshness) THEN RAISE EXCEPTION 'Partial history advanced freshness'; END IF;
  UPDATE public.gmail_connections SET refresh_token_ciphertext='interleaved-reconnect' WHERE id=mailbox;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_email_jobs WHERE id=overlap_job AND checkpoint->'batch'->'ids'='["remaining"]') THEN RAISE EXCEPTION 'Reconnect lost partial overlap'; END IF;
  IF public.conversation_email_commit(history_job,lease,'[]','{}','{}',true,'stale-history') THEN RAISE EXCEPTION 'Reconnect accepted interleaved history worker'; END IF;
  -- Expiry DURING a write must roll back message and checkpoint changes together.
  CREATE FUNCTION public.slow_synthetic_message() RETURNS trigger LANGUAGE plpgsql AS $slow$
    BEGIN PERFORM pg_sleep(0.15); RETURN NEW; END $slow$;
  CREATE TRIGGER slow_synthetic_message BEFORE INSERT ON public.conversation_email_messages FOR EACH ROW EXECUTE FUNCTION public.slow_synthetic_message();
  UPDATE public.conversation_email_jobs SET status='running',lease_token=lease,lease_until=clock_timestamp()+interval '75 milliseconds' WHERE id=overlap_job;
  IF public.conversation_email_commit(overlap_job,lease,
    '[{"provider_message_id":"slow","provider_thread_id":"thread","sent_at":"2026-10-20T12:00:00Z","direction":"inbound","sender":"parent@example.com","recipients":[],"copied_recipients":[],"participants":["parent@example.com"],"subject":"slow","body":"slow","unread":false}]',
    '{}','{}',true) THEN RAISE EXCEPTION 'Slow write accepted expired lease'; END IF;
  IF EXISTS(SELECT 1 FROM public.conversation_email_messages WHERE provider_message_id='slow') THEN RAISE EXCEPTION 'Slow message was not rolled back'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_email_jobs WHERE id=overlap_job AND status='running' AND checkpoint ? 'batch') THEN RAISE EXCEPTION 'Slow commit advanced coverage'; END IF;
  DROP TRIGGER slow_synthetic_message ON public.conversation_email_messages;
  DROP FUNCTION public.slow_synthetic_message();
  RAISE NOTICE 'PASS: tenant isolation, grants, stale leases, recovery, reconnect fencing and history freshness';
END $$;
ROLLBACK;