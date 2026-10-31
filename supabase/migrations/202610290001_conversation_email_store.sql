-- Additive, service-role-only conversation store. Existing outreach capture is unchanged.
BEGIN;
ALTER TABLE public.gmail_connections ADD CONSTRAINT gmail_connections_tenant_id_id_key UNIQUE (tenant_id,id);
CREATE TABLE public.conversation_email_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  connection_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('import','history')),
  job_key text NOT NULL,
  range_start timestamptz,
  range_end timestamptz,
  addresses text[] NOT NULL DEFAULT '{}',
  checkpoint jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','complete','delayed','reconnect')),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id,connection_id) REFERENCES public.gmail_connections(tenant_id,id) ON DELETE CASCADE,
  UNIQUE (tenant_id,connection_id,job_key),
  CHECK ((kind='history') OR (range_start IS NOT NULL AND range_end > range_start))
);
CREATE INDEX conversation_email_jobs_due ON public.conversation_email_jobs(next_attempt_at,updated_at) WHERE status IN ('pending','delayed','running');
CREATE TABLE public.conversation_email_messages (
  tenant_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  provider_message_id text NOT NULL,
  provider_thread_id text NOT NULL,
  sent_at timestamptz NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  sender text NOT NULL,
  recipients text[] NOT NULL DEFAULT '{}',
  copied_recipients text[] NOT NULL DEFAULT '{}',
  participants text[] NOT NULL,
  subject text NOT NULL,
  body text NOT NULL CHECK (length(body)<=100000),
  unread boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,connection_id,provider_message_id),
  FOREIGN KEY (tenant_id,connection_id) REFERENCES public.gmail_connections(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX conversation_email_messages_range ON public.conversation_email_messages(tenant_id,connection_id,sent_at DESC,provider_message_id DESC);
CREATE INDEX conversation_email_messages_participants ON public.conversation_email_messages USING gin(participants);
CREATE TABLE public.conversation_email_mailboxes (
  tenant_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  history_id text,
  last_synced_at timestamptz,
  PRIMARY KEY (tenant_id,connection_id),
  FOREIGN KEY (tenant_id,connection_id) REFERENCES public.gmail_connections(tenant_id,id) ON DELETE CASCADE
);
ALTER TABLE public.conversation_email_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_email_mailboxes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversation_email_jobs,public.conversation_email_messages,public.conversation_email_mailboxes FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.conversation_email_jobs,public.conversation_email_messages,public.conversation_email_mailboxes TO service_role;

CREATE FUNCTION public.conversation_email_claim()
RETURNS SETOF public.conversation_email_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE candidate public.conversation_email_jobs%ROWTYPE; wall timestamptz;
BEGIN
  -- Serialize claims, not network work. Four global workers; one per mailbox.
  PERFORM pg_advisory_xact_lock(72910377);
  wall := clock_timestamp();
  IF (SELECT count(*) FROM public.conversation_email_jobs WHERE lease_until>wall)>=4 THEN RETURN; END IF;
  SELECT j.* INTO candidate FROM public.conversation_email_jobs j
  WHERE j.status IN ('pending','delayed','running') AND j.next_attempt_at<=wall
    AND (j.lease_until IS NULL OR j.lease_until<=wall)
    AND NOT EXISTS (SELECT 1 FROM public.conversation_email_jobs busy WHERE busy.connection_id=j.connection_id AND busy.lease_until>wall)
  ORDER BY j.updated_at,j.created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN; END IF;
  RETURN QUERY UPDATE public.conversation_email_jobs SET status='running',lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '120 seconds',updated_at=clock_timestamp()
    WHERE id=candidate.id RETURNING *;
END; $$;

CREATE FUNCTION public.conversation_email_commit(p_job uuid,p_lease uuid,p_messages jsonb,p_deleted text[],p_checkpoint jsonb,p_complete boolean,p_history text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.conversation_email_jobs%ROWTYPE; recovering boolean := p_checkpoint->>'recover'='true';
BEGIN
  SELECT * INTO j FROM public.conversation_email_jobs WHERE id=p_job AND lease_token=p_lease AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  -- now() is the transaction start time, not wall time after a lock wait.
  IF j.lease_until<=clock_timestamp() THEN RETURN false; END IF;
  BEGIN
  IF j.kind='history' AND p_checkpoint->>'recover'='true' THEN
    -- One mailbox lease at a time: reset coverage and stale data atomically
    -- with the replacement baseline. Expired workers lose their fencing token.
    DELETE FROM public.conversation_email_messages WHERE tenant_id=j.tenant_id AND connection_id=j.connection_id;
    UPDATE public.conversation_email_jobs SET status='pending',checkpoint='{}',processed=0,
      lease_token=NULL,lease_until=NULL,attempts=0,last_error=NULL,next_attempt_at=now(),updated_at=now()
      WHERE tenant_id=j.tenant_id AND connection_id=j.connection_id AND kind='import';
    p_checkpoint := '{}';
  END IF;
  DELETE FROM public.conversation_email_messages WHERE tenant_id=j.tenant_id AND connection_id=j.connection_id AND provider_message_id=ANY(p_deleted);
  INSERT INTO public.conversation_email_messages(tenant_id,connection_id,provider_message_id,provider_thread_id,sent_at,direction,sender,recipients,copied_recipients,participants,subject,body,unread)
  SELECT j.tenant_id,j.connection_id,m.provider_message_id,m.provider_thread_id,m.sent_at,m.direction,m.sender,m.recipients,m.copied_recipients,m.participants,m.subject,m.body,m.unread
  FROM jsonb_to_recordset(p_messages) AS m(provider_message_id text,provider_thread_id text,sent_at timestamptz,direction text,sender text,recipients text[],copied_recipients text[],participants text[],subject text,body text,unread boolean)
  ON CONFLICT (tenant_id,connection_id,provider_message_id) DO UPDATE SET sent_at=excluded.sent_at,direction=excluded.direction,sender=excluded.sender,recipients=excluded.recipients,copied_recipients=excluded.copied_recipients,participants=excluded.participants,subject=excluded.subject,body=excluded.body,unread=excluded.unread,updated_at=now();
  IF p_history IS NOT NULL THEN
    INSERT INTO public.conversation_email_mailboxes(tenant_id,connection_id,history_id,last_synced_at)
      VALUES(j.tenant_id,j.connection_id,p_history,CASE WHEN j.kind='history' AND p_complete AND NOT coalesce(recovering,false) THEN clock_timestamp() ELSE NULL END)
    ON CONFLICT (tenant_id,connection_id) DO UPDATE SET history_id=excluded.history_id,
      last_synced_at=CASE WHEN j.kind='history' THEN excluded.last_synced_at ELSE public.conversation_email_mailboxes.last_synced_at END;
  END IF;
  UPDATE public.conversation_email_jobs SET checkpoint=p_checkpoint,processed=processed+jsonb_array_length(p_messages),
    status=CASE WHEN p_complete AND kind='import' THEN 'complete' ELSE 'pending' END,
    next_attempt_at=CASE WHEN p_complete AND kind='history' THEN now()+interval '1 minute' ELSE now() END,
    lease_until=NULL,lease_token=NULL,attempts=0,last_error=NULL,updated_at=now() WHERE id=j.id;
  -- Roll back messages, coverage and freshness together if a write exhausted the lease.
  IF j.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Lease expired' USING ERRCODE='P0002'; END IF;
  EXCEPTION WHEN no_data_found THEN RETURN false;
  END;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.conversation_email_claim(),public.conversation_email_commit(uuid,uuid,jsonb,text[],jsonb,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.conversation_email_claim(),public.conversation_email_commit(uuid,uuid,jsonb,text[],jsonb,boolean,text) TO service_role;

-- Credentials are replaced by the existing OAuth callback. Fence workers using
-- old credentials and reactivate paused jobs without depending on browser reads.
CREATE FUNCTION public.conversation_email_credentials_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.refresh_token_ciphertext IS DISTINCT FROM OLD.refresh_token_ciphertext THEN
    UPDATE public.conversation_email_jobs SET status='pending',lease_token=NULL,lease_until=NULL,
      attempts=0,last_error=NULL,next_attempt_at=now(),updated_at=now()
      WHERE tenant_id=NEW.tenant_id AND connection_id=NEW.id AND status IN ('reconnect','running','delayed');
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.conversation_email_credentials_changed() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER conversation_email_credentials_changed AFTER UPDATE OF refresh_token_ciphertext ON public.gmail_connections
  FOR EACH ROW EXECUTE FUNCTION public.conversation_email_credentials_changed();
COMMIT;