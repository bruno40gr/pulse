BEGIN;

CREATE TABLE public.community_post_state (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
  revision bigint NOT NULL DEFAULT 0
);
CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  platform text NOT NULL CHECK (platform IN ('Instagram', 'TikTok')),
  original_url text NOT NULL,
  status text NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'approved', 'archived')),
  permission_notes text NOT NULL DEFAULT '' CHECK (length(permission_notes) <= 4000),
  permission_confirmed boolean NOT NULL DEFAULT false,
  homepage_order integer CHECK (homepage_order BETWEEN 1 AND 4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, original_url),
  UNIQUE (tenant_id, homepage_order),
  CHECK (status <> 'approved' OR (permission_confirmed AND length(trim(permission_notes)) > 0)),
  CHECK (homepage_order IS NULL OR status = 'approved'),
  CHECK (
    (platform = 'Instagram' AND original_url ~ '^https://www[.]instagram[.]com/(p|reel)/[A-Za-z0-9_-]+/$') OR
    (platform = 'TikTok' AND original_url ~ '^https://www[.]tiktok[.]com/@[A-Za-z0-9_.]+/video/[0-9]{15,25}$')
  )
);
CREATE TABLE public.community_post_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  actor_membership_id uuid NOT NULL REFERENCES public.tenant_memberships(id),
  revision bigint NOT NULL,
  action text NOT NULL,
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_posts, public.community_post_state, public.community_post_audit FROM anon, authenticated;
GRANT ALL ON public.community_posts, public.community_post_state, public.community_post_audit TO service_role;

CREATE FUNCTION public.community_post_workspace(p_tenant uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'revision', COALESCE((SELECT revision FROM community_post_state WHERE tenant_id = p_tenant), 0),
    'posts', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC, p.id) FROM community_posts p WHERE p.tenant_id = p_tenant), '[]'::jsonb)
  );
$$;

CREATE FUNCTION public.community_post_command(p_tenant uuid, p_actor uuid, p_revision bigint, p_action text, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  current_revision bigint;
  before_workspace jsonb;
  after_workspace jsonb;
  selected_ids uuid[];
  target_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tenant_memberships WHERE id = p_actor AND tenant_id = p_tenant AND status IN ('active', 'invited', 'unclaimed')) THEN
    RAISE EXCEPTION 'Invalid actor' USING ERRCODE = '22023';
  END IF;
  INSERT INTO community_post_state(tenant_id) VALUES (p_tenant) ON CONFLICT DO NOTHING;
  SELECT revision INTO current_revision FROM community_post_state WHERE tenant_id = p_tenant FOR UPDATE;
  IF p_revision IS DISTINCT FROM current_revision THEN
    RAISE EXCEPTION 'Stale workspace' USING ERRCODE = '40001';
  END IF;
  before_workspace := community_post_workspace(p_tenant);
  IF p_action = 'add' THEN
    INSERT INTO community_posts(tenant_id, platform, original_url)
    VALUES (p_tenant, p_data->>'platform', p_data->>'original_url');
  ELSIF p_action = 'review' THEN
    target_id := (p_data->>'id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM community_posts WHERE tenant_id = p_tenant AND id = target_id) THEN
      RAISE EXCEPTION 'Invalid post' USING ERRCODE = '22023';
    END IF;
    IF p_data->>'status' NOT IN ('inbox', 'approved', 'archived') OR p_data->>'status' IS NULL
       OR (p_data->>'status' = 'approved' AND (COALESCE((p_data->>'permission_confirmed')::boolean, false) = false OR length(trim(COALESCE(p_data->>'permission_notes', ''))) = 0)) THEN
      RAISE EXCEPTION 'Invalid review' USING ERRCODE = '22023';
    END IF;
    UPDATE community_posts SET status = p_data->>'status', permission_notes = p_data->>'permission_notes',
      permission_confirmed = (p_data->>'permission_confirmed')::boolean,
      homepage_order = CASE WHEN p_data->>'status' = 'approved' THEN homepage_order ELSE NULL END,
      updated_at = now() WHERE id = target_id AND tenant_id = p_tenant;
  ELSIF p_action = 'homepage' THEN
    IF jsonb_typeof(p_data->'ids') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Invalid selection' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(array_agg(value::uuid), '{}'::uuid[]) INTO selected_ids FROM jsonb_array_elements_text(p_data->'ids');
    IF cardinality(selected_ids) > 4 OR cardinality(selected_ids) <> (SELECT count(DISTINCT id) FROM unnest(selected_ids) id)
      OR cardinality(selected_ids) <> (SELECT count(*) FROM community_posts WHERE tenant_id = p_tenant AND status = 'approved' AND id = ANY(selected_ids)) THEN
      RAISE EXCEPTION 'Invalid selection' USING ERRCODE = '22023';
    END IF;
    UPDATE community_posts SET homepage_order = NULL, updated_at = now() WHERE tenant_id = p_tenant AND homepage_order IS NOT NULL;
    UPDATE community_posts SET homepage_order = array_position(selected_ids, id), updated_at = now() WHERE tenant_id = p_tenant AND id = ANY(selected_ids);
  ELSE
    RAISE EXCEPTION 'Invalid action' USING ERRCODE = '22023';
  END IF;
  UPDATE community_post_state SET revision = revision + 1 WHERE tenant_id = p_tenant;
  after_workspace := community_post_workspace(p_tenant);
  INSERT INTO community_post_audit(tenant_id, actor_membership_id, revision, action, before_state, after_state)
  VALUES (p_tenant, p_actor, current_revision + 1, p_action, before_workspace, after_workspace);
  RETURN after_workspace;
END;
$$;
REVOKE ALL ON FUNCTION public.community_post_workspace(uuid), public.community_post_command(uuid, uuid, bigint, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_post_workspace(uuid), public.community_post_command(uuid, uuid, bigint, text, jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;