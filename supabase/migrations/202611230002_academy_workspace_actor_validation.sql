BEGIN;

-- Forward-only upgrade for schools where the original workspace migration already ran.
CREATE OR REPLACE FUNCTION public.save_academy_workspace(p_tenant uuid, p_actor uuid, p_revision bigint, p_state jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE current_revision bigint;
BEGIN
  IF p_revision < 0 OR p_revision IS NULL OR p_state IS NULL THEN
    RAISE EXCEPTION 'Invalid workspace revision or state';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_memberships WHERE id=p_actor AND tenant_id=p_tenant AND status='active') THEN
    RAISE EXCEPTION 'Actor is not an active member of this tenant';
  END IF;
  INSERT INTO academy_workspaces(tenant_id) VALUES (p_tenant) ON CONFLICT DO NOTHING;
  SELECT revision INTO current_revision FROM academy_workspaces WHERE tenant_id = p_tenant FOR UPDATE;
  IF current_revision <> p_revision THEN
    RETURN jsonb_build_object('conflict', true, 'revision', current_revision);
  END IF;
  UPDATE academy_workspaces SET state = p_state, revision = revision + 1, updated_at = now(), updated_by = p_actor
    WHERE tenant_id = p_tenant;
  RETURN jsonb_build_object('revision', current_revision + 1);
END;
$$;
REVOKE ALL ON FUNCTION public.save_academy_workspace(uuid, uuid, bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_academy_workspace(uuid, uuid, bigint, jsonb) TO service_role;
COMMIT;
