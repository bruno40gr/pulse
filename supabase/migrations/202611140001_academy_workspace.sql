BEGIN;

-- Tenant authorization is enforced at the API boundary; never expose snapshots directly.
CREATE TABLE public.academy_workspaces (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
  revision bigint NOT NULL DEFAULT 0,
  state jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.tenant_memberships(id)
);
ALTER TABLE public.academy_workspaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.academy_workspaces FROM anon, authenticated;
GRANT ALL ON public.academy_workspaces TO service_role;

CREATE FUNCTION public.save_academy_workspace(p_tenant uuid, p_actor uuid, p_revision bigint, p_state jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE current_revision bigint;
BEGIN
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