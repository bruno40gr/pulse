-- Primary contacts DB. Depends on Migration 001 student_accounts.
-- Additional account links are NOT new messaging grants.
BEGIN;
ALTER TABLE public.student_accounts ADD COLUMN IF NOT EXISTS communication_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS family_revision bigint NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS public.contact_family_operations (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id), operation_id uuid NOT NULL,
  actor_id uuid NOT NULL, change jsonb NOT NULL, result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,operation_id)
);
ALTER TABLE public.contact_family_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contact_family_operations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.contact_family_operations TO service_role;

CREATE OR REPLACE FUNCTION public.change_contact_family(p_tenant uuid,p_actor uuid,p_operation uuid,p_change jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE previous contact_family_operations; account uuid := (p_change->>'account_id')::uuid;
  person uuid := (p_change->>'person_id')::uuid; manager uuid := (p_change->>'manager_account_id')::uuid;
  student students; fields jsonb := p_change->'fields'; action text := p_change->>'kind';
  relationship text := p_change->>'relationship'; answer jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text,210004));
  SELECT * INTO previous FROM contact_family_operations WHERE tenant_id=p_tenant AND operation_id=p_operation;
  IF FOUND THEN
    IF previous.actor_id<>p_actor OR previous.change<>p_change THEN RAISE EXCEPTION 'Operation changed'; END IF;
    RETURN previous.result;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM accounts WHERE tenant_id=p_tenant AND id=account) THEN RAISE EXCEPTION 'Account unavailable'; END IF;
  IF action NOT IN ('child','link-child','link-account','create-manager','unlink-child','dependent-relationship')
    OR relationship IS NULL OR relationship NOT IN ('Child','Spouse','Sibling','Other','Parent / guardian','Other responsible adult') THEN
    RAISE EXCEPTION 'Invalid relationship operation';
  END IF;
  IF action='child' THEN
    IF nullif(btrim(fields->>'first_name'),'') IS NULL OR nullif(btrim(fields->>'last_name'),'') IS NULL THEN RAISE EXCEPTION 'Name required'; END IF;
    person := gen_random_uuid();
    INSERT INTO people(id,tenant_id,first_name,last_name,email,phone,date_of_birth,custom_fields)
      VALUES(person,p_tenant,fields->>'first_name',fields->>'last_name',fields->>'email',fields->>'phone',
        nullif(fields->>'date_of_birth','')::date,'{}');
    INSERT INTO students(tenant_id,person_id,account_id,client_status,is_minor,message_routing)
      VALUES(p_tenant,person,account,'prospect',
        CASE WHEN nullif(fields->>'date_of_birth','') IS NULL THEN NULL ELSE (fields->>'date_of_birth')::date > (current_date-interval '18 years')::date END,
        'account_holder') RETURNING * INTO student;
    INSERT INTO student_accounts(student_id,account_id,relationship,is_primary,communication_enabled)
      VALUES(student.id,account,relationship,true,true);
  ELSE
    IF NOT EXISTS(SELECT 1 FROM people WHERE tenant_id=p_tenant AND id=person) THEN RAISE EXCEPTION 'Person unavailable'; END IF;
    SELECT * INTO student FROM students WHERE tenant_id=p_tenant AND person_id=person FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Student unavailable'; END IF;
    IF (p_change->>'expected_revision') IS NULL OR student.family_revision<>(p_change->>'expected_revision')::bigint THEN
      RAISE EXCEPTION 'Relationships changed; refresh before saving';
    END IF;
    IF action IN ('link-account','create-manager') THEN
      IF student.account_id IS DISTINCT FROM account AND NOT EXISTS(SELECT 1 FROM student_accounts WHERE student_id=student.id AND account_id=account) THEN
        RAISE EXCEPTION 'Student not in account';
      END IF;
      IF action='create-manager' THEN
        IF nullif(btrim(fields->>'first_name'),'') IS NULL OR nullif(btrim(fields->>'last_name'),'') IS NULL THEN RAISE EXCEPTION 'Name required'; END IF;
        manager := gen_random_uuid();
        INSERT INTO accounts(id,tenant_id,name,email,phone) VALUES(manager,p_tenant,
          concat_ws(' ',fields->>'first_name',fields->>'last_name'),fields->>'email',fields->>'phone');
      END IF;
      IF manager=account OR NOT EXISTS(SELECT 1 FROM accounts WHERE tenant_id=p_tenant AND id=manager) THEN RAISE EXCEPTION 'Manager unavailable'; END IF;
      INSERT INTO student_accounts(student_id,account_id,relationship,is_primary,communication_enabled)
        VALUES(student.id,manager,relationship,false,false) ON CONFLICT(student_id,account_id) DO NOTHING;
    ELSIF action='link-child' THEN
      -- Keep the student's existing primary account and routing unchanged.
      INSERT INTO student_accounts(student_id,account_id,relationship,is_primary,communication_enabled)
        VALUES(student.id,account,relationship,false,false) ON CONFLICT(student_id,account_id) DO NOTHING;
    ELSE
      IF student.account_id IS DISTINCT FROM account AND NOT EXISTS(SELECT 1 FROM student_accounts WHERE student_id=student.id AND account_id=account) THEN
        RAISE EXCEPTION 'Relationship unavailable';
      END IF;
      IF action='unlink-child' THEN
        IF student.account_id=account OR EXISTS(SELECT 1 FROM student_accounts WHERE student_id=student.id AND account_id=account AND is_primary) THEN
          RAISE EXCEPTION 'Primary account requires an explicit reassignment, not unlinking';
        END IF;
        DELETE FROM student_accounts WHERE student_id=student.id AND account_id=account;
      ELSE
        INSERT INTO student_accounts(student_id,account_id,relationship,is_primary,communication_enabled)
          VALUES(student.id,account,relationship,student.account_id=account,student.account_id=account)
          ON CONFLICT(student_id,account_id) DO UPDATE SET relationship=EXCLUDED.relationship;
      END IF;
    END IF;
  END IF;
  UPDATE students SET family_revision=family_revision+1 WHERE id=student.id AND tenant_id=p_tenant;
  answer := jsonb_build_object('personId',person,'accountId',account,'managerAccountId',manager,'saved',true);
  INSERT INTO contact_family_operations VALUES(p_tenant,p_operation,p_actor,p_change,answer,now());
  RETURN answer;
END;
$$;
REVOKE ALL ON FUNCTION public.change_contact_family(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.change_contact_family(uuid,uuid,uuid,jsonb) TO service_role;
COMMIT;