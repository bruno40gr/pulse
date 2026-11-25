-- Account managers are people on an account, not additional student accounts.
BEGIN;
CREATE OR REPLACE FUNCTION public.change_account_manager(p_tenant uuid,p_actor uuid,p_operation uuid,p_change jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE previous contact_family_operations; account uuid := (p_change->>'account_id')::uuid;
  person uuid := (p_change->>'person_id')::uuid; action text := p_change->>'kind';
  fields jsonb := p_change->'fields'; answer jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text,210004));
  SELECT * INTO previous FROM contact_family_operations WHERE tenant_id=p_tenant AND operation_id=p_operation;
  IF FOUND THEN
    IF previous.actor_id<>p_actor OR previous.change<>p_change THEN RAISE EXCEPTION 'Operation changed'; END IF;
    RETURN previous.result;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM accounts WHERE tenant_id=p_tenant AND id=account) THEN RAISE EXCEPTION 'Account unavailable'; END IF;
  IF action IS NULL OR action NOT IN ('manager-link','manager-create','manager-unlink') THEN RAISE EXCEPTION 'Invalid manager action'; END IF;
  IF action='manager-create' THEN
    IF coalesce(trim(fields->>'first_name'),'')='' OR coalesce(trim(fields->>'last_name'),'')='' THEN RAISE EXCEPTION 'Name required'; END IF;
    INSERT INTO people(tenant_id,first_name,last_name,email,phone,date_of_birth)
      VALUES(p_tenant,fields->>'first_name',fields->>'last_name',nullif(fields->>'email',''),nullif(fields->>'phone',''),nullif(fields->>'date_of_birth','')::date)
      RETURNING id INTO person;
  END IF;
  IF person IS NULL OR NOT EXISTS(SELECT 1 FROM people WHERE tenant_id=p_tenant AND id=person) THEN RAISE EXCEPTION 'Person unavailable'; END IF;
  IF action='manager-unlink' THEN
    IF EXISTS(SELECT 1 FROM account_holders WHERE tenant_id=p_tenant AND account_id=account AND person_id=person AND is_primary) THEN
      RAISE EXCEPTION 'Primary account holder cannot be removed here';
    END IF;
    DELETE FROM account_holders WHERE tenant_id=p_tenant AND account_id=account AND person_id=person AND NOT coalesce(is_primary,false);
  ELSE
    IF NOT EXISTS(SELECT 1 FROM account_holders WHERE tenant_id=p_tenant AND account_id=account AND person_id=person) THEN
      INSERT INTO account_holders(tenant_id,account_id,person_id,relationship,is_primary)
        VALUES(p_tenant,account,person,'Account manager',false);
    END IF;
  END IF;
  answer := jsonb_build_object('saved',true,'accountId',account,'personId',person);
  INSERT INTO contact_family_operations VALUES(p_tenant,p_operation,p_actor,p_change,answer,now());
  RETURN answer;
END;
$$;
REVOKE ALL ON FUNCTION public.change_account_manager(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.change_account_manager(uuid,uuid,uuid,jsonb) TO service_role;
COMMIT;