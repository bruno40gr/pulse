-- Primary database. Explicit family display links; NEVER reassign billing or messaging.
-- Requires the previously installed contact_family_operations ledger.
BEGIN;
CREATE TABLE public.family_account_links (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  family_account_id uuid NOT NULL REFERENCES public.accounts(id),
  member_account_id uuid NOT NULL REFERENCES public.accounts(id),
  created_by_membership_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, member_account_id),
  CHECK (family_account_id <> member_account_id)
);
ALTER TABLE public.family_account_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_account_links FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON public.family_account_links TO service_role;
CREATE FUNCTION public.link_family_account(p_tenant uuid, p_actor uuid, p_operation uuid, p_change jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE target uuid := (p_change->>'account_id')::uuid;
  member uuid := (p_change->>'member_account_id')::uuid;
  previous public.contact_family_operations; answer jsonb;
BEGIN
  IF p_tenant IS NULL OR p_actor IS NULL OR p_operation IS NULL OR target IS NULL OR member IS NULL OR target=member
    THEN RAISE EXCEPTION 'Choose two different accounts'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text,210004));
  SELECT * INTO previous FROM public.contact_family_operations WHERE tenant_id=p_tenant AND operation_id=p_operation;
  IF FOUND THEN
    IF previous.actor_id<>p_actor OR previous.change<>p_change THEN RAISE EXCEPTION 'Operation changed'; END IF;
    RETURN previous.result;
  END IF;
  IF (SELECT count(*) FROM public.accounts WHERE tenant_id=p_tenant AND id IN (target,member))<>2 THEN
    RAISE EXCEPTION 'Account unavailable'; END IF;
  -- Do not silently move an existing family, create cycles or merge two populated families.
  IF EXISTS(SELECT 1 FROM public.family_account_links WHERE tenant_id=p_tenant AND
    (member_account_id=target OR family_account_id=member OR (member_account_id=member AND family_account_id<>target))) THEN
    RAISE EXCEPTION 'Family changed; review existing account links'; END IF;
  INSERT INTO public.family_account_links(tenant_id,family_account_id,member_account_id,created_by_membership_id)
    VALUES(p_tenant,target,member,p_actor) ON CONFLICT DO NOTHING;
  answer := jsonb_build_object('saved',true,'accountId',target,'memberAccountId',member);
  INSERT INTO public.contact_family_operations VALUES(p_tenant,p_operation,p_actor,p_change,answer,now());
  RETURN answer;
END;
$$;
REVOKE ALL ON FUNCTION public.link_family_account(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.link_family_account(uuid,uuid,uuid,jsonb) TO service_role;
COMMIT;