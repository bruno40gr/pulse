BEGIN;

CREATE TABLE public.website_content_state (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
  revision bigint NOT NULL DEFAULT 0
);
CREATE TABLE public.website_content (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  id uuid NOT NULL,
  slug text NOT NULL,
  draft jsonb NOT NULL,
  published jsonb,
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.tenant_memberships(id),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, slug)
);
CREATE TABLE public.website_content_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  actor_membership_id uuid NOT NULL REFERENCES public.tenant_memberships(id),
  action text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.website_content_assets (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  cloudinary_public_id text NOT NULL UNIQUE,
  cloudinary_asset_id text NOT NULL UNIQUE,
  format text NOT NULL CHECK (format IN ('jpg', 'jpeg', 'png', 'webp')),
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  created_by uuid NOT NULL REFERENCES public.tenant_memberships(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.website_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_content_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_content_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_content_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.website_content, public.website_content_state, public.website_content_audit, public.website_content_assets FROM anon, authenticated;
GRANT ALL ON public.website_content, public.website_content_state, public.website_content_audit, public.website_content_assets TO service_role;

CREATE FUNCTION public.website_content_workspace(p_tenant uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
 SELECT jsonb_build_object(
   'revision', COALESCE((SELECT revision FROM website_content_state WHERE tenant_id = p_tenant), 0),
   'items', COALESCE((SELECT jsonb_agg(draft || jsonb_build_object('slug', slug, 'hasPublishedVersion', published IS NOT NULL) ORDER BY updated_at DESC, id) FROM website_content WHERE tenant_id = p_tenant), '[]'::jsonb)
 );
$$;

CREATE FUNCTION public.website_content_command(p_tenant uuid, p_actor uuid, p_revision bigint, p_action text, p_item jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
 current_revision bigint;
 target uuid := (p_item->>'id')::uuid;
 prior jsonb;
 saved jsonb;
 live jsonb;
 publication_time timestamptz;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM tenant_memberships m JOIN roles r ON r.id = m.role_id AND r.tenant_id = m.tenant_id
   WHERE m.id = p_actor AND m.tenant_id = p_tenant AND m.status IN ('active','invited','unclaimed') AND r.key IN ('owner','admin')) THEN
   RAISE EXCEPTION 'Invalid actor' USING ERRCODE = '22023';
 END IF;
 IF p_action NOT IN ('save','publish','unpublish','archive') OR p_action IS NULL THEN RAISE EXCEPTION 'Invalid action' USING ERRCODE = '22023'; END IF;
 INSERT INTO website_content_state(tenant_id) VALUES(p_tenant) ON CONFLICT DO NOTHING;
 SELECT revision INTO current_revision FROM website_content_state WHERE tenant_id = p_tenant FOR UPDATE;
 IF p_revision IS DISTINCT FROM current_revision THEN RAISE EXCEPTION 'Stale workspace' USING ERRCODE = '40001'; END IF;
 SELECT to_jsonb(w), published, published_at INTO prior, live, publication_time FROM website_content w WHERE tenant_id = p_tenant AND id = target;
 IF p_action IN ('unpublish','archive') AND prior IS NULL THEN RAISE EXCEPTION 'Missing content' USING ERRCODE = '22023'; END IF;
 saved := p_item || jsonb_build_object('status', CASE WHEN p_action = 'publish' THEN 'published' WHEN p_action = 'archive' THEN 'archived' ELSE 'draft' END);
 IF p_action = 'publish' THEN
   publication_time := COALESCE(publication_time, now());
   saved := saved || jsonb_build_object('publishedAt', publication_time);
   live := saved;
 ELSIF p_action IN ('unpublish','archive') THEN live := NULL;
 END IF;
 INSERT INTO website_content(tenant_id, id, slug, draft, published, published_at, updated_by)
 VALUES(p_tenant, target, COALESCE(prior->>'slug', p_item->>'slug', 'story-' || target::text), saved, live, publication_time, p_actor)
 ON CONFLICT (tenant_id, id) DO UPDATE SET draft = EXCLUDED.draft, published = EXCLUDED.published, published_at = EXCLUDED.published_at, updated_by = p_actor, updated_at = now();
 UPDATE website_content_state SET revision = revision + 1 WHERE tenant_id = p_tenant;
 INSERT INTO website_content_audit(tenant_id, actor_membership_id, action, before_state, after_state)
 SELECT p_tenant, p_actor, p_action, prior, to_jsonb(w) FROM website_content w WHERE tenant_id = p_tenant AND id = target;
 RETURN website_content_workspace(p_tenant);
END;
$$;
REVOKE ALL ON FUNCTION public.website_content_workspace(uuid), public.website_content_command(uuid, uuid, bigint, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_content_workspace(uuid), public.website_content_command(uuid, uuid, bigint, text, jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;