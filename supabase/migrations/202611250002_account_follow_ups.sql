-- CRM client database (consolidated production: same Odeon project as primary).
-- Primary account and actor identities are verified by the API.
-- Separate scope: no person/inquiry reminders are reassigned or backfilled.
BEGIN;
CREATE TABLE public.account_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, account_id uuid NOT NULL,
  due_at timestamptz, message text CHECK (length(message)<=12000),
  status text NOT NULL CHECK (status IN ('open','cleared','completed')),
  owner_membership_id uuid NOT NULL, updated_by_membership_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,account_id), CHECK (status<>'open' OR due_at IS NOT NULL)
);
CREATE TABLE public.account_follow_up_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  follow_up_id uuid NOT NULL REFERENCES public.account_follow_ups(id) ON DELETE RESTRICT,
  snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_follow_up_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_follow_ups,public.account_follow_up_history FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.account_follow_ups TO service_role;
GRANT SELECT,INSERT ON public.account_follow_up_history TO service_role;
CREATE FUNCTION public.audit_account_follow_up() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  INSERT INTO public.account_follow_up_history(tenant_id,follow_up_id,snapshot) VALUES(NEW.tenant_id,NEW.id,to_jsonb(NEW));
  RETURN NEW;
END;
$$;
CREATE TRIGGER account_follow_up_audit AFTER INSERT OR UPDATE ON public.account_follow_ups
FOR EACH ROW EXECUTE FUNCTION public.audit_account_follow_up();
CREATE FUNCTION public.save_account_follow_up(p_tenant uuid,p_account uuid,p_actor uuid,p_action text,
  p_expected_version integer,p_due timestamptz DEFAULT NULL,p_message text DEFAULT NULL)
RETURNS SETOF public.account_follow_ups LANGUAGE plpgsql SET search_path=public AS $$
DECLARE target public.account_follow_ups; next_status text;
BEGIN
  IF p_tenant IS NULL OR p_account IS NULL OR p_actor IS NULL OR p_action IS NULL OR p_action NOT IN ('save','clear','complete')
    OR p_expected_version IS NULL OR p_expected_version<0 OR length(p_message)>12000
    OR (p_action='save' AND (p_due IS NULL OR NOT isfinite(p_due))) THEN RAISE EXCEPTION 'Invalid account follow-up'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text || ':' || p_account::text,250002));
  SELECT * INTO target FROM public.account_follow_ups WHERE tenant_id=p_tenant AND account_id=p_account FOR UPDATE;
  IF coalesce(target.version,0)<>p_expected_version THEN
    RAISE EXCEPTION 'Follow-up changed' USING ERRCODE='40001'; END IF;
  next_status := CASE p_action WHEN 'save' THEN 'open' WHEN 'clear' THEN 'cleared' ELSE 'completed' END;
  IF target.id IS NULL THEN
    IF p_action<>'save' THEN RAISE EXCEPTION 'No account follow-up to change'; END IF;
    INSERT INTO public.account_follow_ups(tenant_id,account_id,due_at,message,status,owner_membership_id,updated_by_membership_id)
      VALUES(p_tenant,p_account,p_due,nullif(btrim(p_message),''),next_status,p_actor,p_actor) RETURNING * INTO target;
  ELSE
    UPDATE public.account_follow_ups SET due_at=CASE WHEN p_action='save' THEN p_due ELSE target.due_at END,
      message=CASE WHEN p_action='save' THEN nullif(btrim(p_message),'') ELSE target.message END,
      status=next_status,updated_by_membership_id=p_actor,version=version+1,updated_at=now()
      WHERE id=target.id RETURNING * INTO target;
  END IF;
  RETURN NEXT target;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_account_follow_up() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_account_follow_up(uuid,uuid,uuid,text,integer,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_account_follow_up(uuid,uuid,uuid,text,integer,timestamptz,text) TO service_role;
COMMIT;