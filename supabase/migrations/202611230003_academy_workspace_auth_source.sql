BEGIN;

-- The source is supplied only by the authorized server, never the request body.
-- Remove the older service-role entry point so it cannot bypass this policy.
DROP FUNCTION public.save_academy_workspace(uuid, uuid, bigint, jsonb);

CREATE FUNCTION public.save_academy_workspace(p_tenant uuid, p_actor uuid, p_revision bigint, p_state jsonb, p_auth_source text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE current_revision bigint;
BEGIN
  IF p_revision < 0 OR p_revision IS NULL OR p_state IS NULL THEN
    RAISE EXCEPTION 'Invalid workspace revision or state';
  END IF;
  IF p_auth_source IS NULL OR p_auth_source NOT IN ('supabase', 'legacy') THEN
    RAISE EXCEPTION 'Invalid authentication source';
  END IF;
  -- Match request-context.ts, including immediate denial after legacy retirement.
  -- Lock the actor against concurrent suspension while persisting the workspace.
  PERFORM 1 FROM public.tenant_memberships
    WHERE id = p_actor AND tenant_id = p_tenant
      AND ((p_auth_source = 'supabase' AND status = 'active')
        OR (p_auth_source = 'legacy' AND legacy_access_enabled IS TRUE
          AND status IN ('unclaimed', 'invited', 'active')))
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Actor is not eligible to save this tenant workspace';
  END IF;
  INSERT INTO public.academy_workspaces(tenant_id) VALUES (p_tenant) ON CONFLICT DO NOTHING;
  SELECT revision INTO current_revision FROM public.academy_workspaces WHERE tenant_id = p_tenant FOR UPDATE;
  IF current_revision <> p_revision THEN
    RETURN jsonb_build_object('conflict', true, 'revision', current_revision);
  END IF;
  UPDATE public.academy_workspaces SET state = p_state, revision = revision + 1, updated_at = now(), updated_by = p_actor
    WHERE tenant_id = p_tenant;
  RETURN jsonb_build_object('revision', current_revision + 1);
END;
$$;
REVOKE ALL ON FUNCTION public.save_academy_workspace(uuid, uuid, bigint, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_academy_workspace(uuid, uuid, bigint, jsonb, text) TO service_role;
COMMIT;