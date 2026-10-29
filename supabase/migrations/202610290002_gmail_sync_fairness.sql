-- Apply before deploying the retry-aware legacy scheduler, even with the store flag disabled.
BEGIN;
ALTER TABLE public.gmail_connections
  ADD COLUMN sync_last_attempt_at timestamptz,
  ADD COLUMN sync_next_attempt_at timestamptz NOT NULL DEFAULT '-infinity',
  ADD COLUMN sync_attempts integer NOT NULL DEFAULT 0 CHECK (sync_attempts>=0),
  ADD COLUMN sync_lease_token uuid;
CREATE INDEX gmail_connections_sync_due ON public.gmail_connections(sync_next_attempt_at,sync_last_attempt_at);

-- Reserve a batch before permission checks, so revoked/broken mailboxes rotate too.
-- One mailbox per tenant precedes a second mailbox from any tenant. Within each
-- round, least recently attempted mailboxes win, not oldest successful coverage.
CREATE FUNCTION public.gmail_schedule_sync(p_limit integer DEFAULT 5)
RETURNS SETOF public.gmail_connections LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE wall timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(72910378);
  wall := clock_timestamp();
  RETURN QUERY WITH ranked AS MATERIALIZED (
    SELECT id, sync_last_attempt_at,
      row_number() OVER (PARTITION BY tenant_id ORDER BY sync_last_attempt_at NULLS FIRST,id) AS slot
    FROM public.gmail_connections
    WHERE sync_next_attempt_at<=wall AND (lease_until IS NULL OR lease_until<=wall)
  ), picked AS MATERIALIZED (
    SELECT c.id FROM public.gmail_connections c JOIN ranked r ON r.id=c.id
    ORDER BY r.slot,r.sync_last_attempt_at NULLS FIRST,c.id
    LIMIT greatest(0,least(coalesce(p_limit,5),5)) FOR UPDATE OF c SKIP LOCKED
  ), updated AS (
  UPDATE public.gmail_connections c SET sync_last_attempt_at=wall,
    sync_attempts=least(c.sync_attempts+1,32),
    sync_next_attempt_at=wall+make_interval(secs=>least(3600,300*power(2,least(c.sync_attempts,4)))::integer)
  FROM picked WHERE c.id=picked.id RETURNING c.*
  ) SELECT u.* FROM updated u JOIN ranked r ON r.id=u.id
    ORDER BY r.slot,r.sync_last_attempt_at NULLS FIRST,u.id;
END; $$;

CREATE OR REPLACE FUNCTION public.gmail_claim_sync(p_id uuid,p_tenant uuid)
RETURNS SETOF public.gmail_connections LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.gmail_connections%ROWTYPE; wall timestamptz;
BEGIN
  SELECT * INTO c FROM public.gmail_connections WHERE id=p_id AND tenant_id=p_tenant FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  wall := clock_timestamp();
  IF c.lease_until IS NOT NULL AND c.lease_until>wall THEN RETURN; END IF;
  RETURN QUERY UPDATE public.gmail_connections SET lease_until=wall+interval '5 minutes',
    sync_lease_token=gen_random_uuid(),sync_until=coalesce(sync_until,wall)
    WHERE id=p_id AND tenant_id=p_tenant RETURNING *;
END; $$;

-- A stale worker may neither advance coverage nor release its successor's lease.
CREATE FUNCTION public.gmail_finish_sync(p_id uuid,p_tenant uuid,p_lease uuid,p_success boolean,p_page text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.gmail_connections%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.gmail_connections WHERE id=p_id AND tenant_id=p_tenant
    AND sync_lease_token=p_lease FOR UPDATE;
  IF NOT FOUND OR c.lease_until IS NULL OR c.lease_until<=clock_timestamp() THEN RETURN false; END IF;
  BEGIN
    IF p_success THEN
      UPDATE public.gmail_connections SET page_token=p_page,
        last_synced_at=CASE WHEN p_page IS NULL THEN c.sync_until ELSE last_synced_at END,
        sync_until=CASE WHEN p_page IS NULL THEN NULL ELSE c.sync_until END,
        lease_until=NULL,sync_lease_token=NULL,last_error=NULL,sync_attempts=0,
        sync_next_attempt_at=clock_timestamp()+interval '1 minute'
        WHERE id=p_id AND tenant_id=p_tenant;
    ELSE
      UPDATE public.gmail_connections SET lease_until=NULL,sync_lease_token=NULL,
        sync_next_attempt_at=greatest(sync_next_attempt_at,clock_timestamp()+interval '5 minutes'),
        last_error='Sync failed. Retry; if it persists, reconnect this Google mailbox.'
        WHERE id=p_id AND tenant_id=p_tenant;
    END IF;
    IF c.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Lease expired' USING ERRCODE='P0002'; END IF;
  EXCEPTION WHEN no_data_found THEN RETURN false;
  END;
  RETURN true;
END; $$;

CREATE FUNCTION public.gmail_sync_credentials_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.refresh_token_ciphertext IS DISTINCT FROM OLD.refresh_token_ciphertext THEN
    NEW.lease_until := NULL; NEW.sync_lease_token := NULL;
    NEW.sync_attempts := 0; NEW.sync_next_attempt_at := clock_timestamp(); NEW.last_error := NULL;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.gmail_sync_credentials_changed() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER gmail_sync_credentials_changed BEFORE UPDATE OF refresh_token_ciphertext ON public.gmail_connections
  FOR EACH ROW EXECUTE FUNCTION public.gmail_sync_credentials_changed();

REVOKE ALL ON FUNCTION public.gmail_schedule_sync(integer),public.gmail_claim_sync(uuid,uuid),public.gmail_finish_sync(uuid,uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gmail_schedule_sync(integer),public.gmail_claim_sync(uuid,uuid),public.gmail_finish_sync(uuid,uuid,uuid,boolean,text) TO service_role;
COMMIT;